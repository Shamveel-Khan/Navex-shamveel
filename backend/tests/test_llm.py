import json
from types import SimpleNamespace

import httpx
import pytest
from openai import BadRequestError

from app.agent.engine import AgentEngine
from app.agent.llm import RealLLM, parse_decision
from app.registry import load_registry
from app.schemas.actions import NavigateAction
from app.schemas.ui import PageState, UIElement
from app.session import Session

VALID_ACTION_JSON = json.dumps(
    {
        "status": "action",
        "thought": "go to projects",
        "action": {"type": "navigate", "path": "/projects"},
        "message": "",
    }
)


class StubCompletions:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=reply))]
        )


class StubClient:
    def __init__(self, replies):
        self.chat = SimpleNamespace(completions=StubCompletions(replies))


def bad_request_error() -> BadRequestError:
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    response = httpx.Response(400, request=request)
    return BadRequestError(
        "response_format json_schema is not supported",
        response=response,
        body=None,
    )


def rate_limit_error() -> Exception:
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    response = httpx.Response(429, request=request)
    from openai import RateLimitError

    return RateLimitError(
        "rate limited upstream", response=response, body=None
    )


def make_llm(replies) -> tuple[RealLLM, StubClient]:
    client = StubClient(replies)
    return RealLLM(registry=load_registry(), client=client), client


def base_session(page_elements=None) -> Session:
    session = Session.create()
    session.user_request = "Create a project called Alpha."
    if page_elements is not None:
        session.page_state = PageState(path="/projects", elements=page_elements)
    return session


def test_parse_decision_accepts_valid_action():
    decision = parse_decision(VALID_ACTION_JSON)

    assert decision.status == "action"
    assert decision.action == NavigateAction(type="navigate", path="/projects")


def test_parse_decision_rejects_invented_action_type():
    with pytest.raises(Exception):
        parse_decision('{"status":"action","action":{"type":"javascript"}}')


def test_decide_uses_strict_schema_and_parses_action():
    llm, stub = make_llm([VALID_ACTION_JSON])

    decision = llm.decide(base_session())

    assert decision.status == "action"
    assert decision.action.path == "/projects"
    used_format = stub.chat.completions.calls[0]["response_format"]
    assert used_format["type"] == "json_schema"
    assert used_format["json_schema"]["strict"] is True


def test_prompt_contains_pages_rules_elements_and_request():
    llm, stub = make_llm([VALID_ACTION_JSON])
    session = base_session(
        page_elements=[
            UIElement(id="create_project_button", type="button", label="Create")
        ]
    )

    llm.decide(session)

    kwargs = stub.chat.completions.calls[0]
    system = kwargs["messages"][0]["content"]
    assert "/projects" in system
    assert "AVAILABLE PAGES" in system
    assert "VISIBLE ELEMENTS" in system
    assert "create_project_button" in system
    assert (
        'User request: "Create a project called Alpha."'
        == kwargs["messages"][1]["content"]
    )


def test_repairs_invalid_json_on_second_call():
    llm, stub = make_llm(["sorry, here is my plan instead", VALID_ACTION_JSON])

    decision = llm.decide(base_session())

    assert decision.status == "action"
    assert len(stub.chat.completions.calls) == 2
    retry_messages = stub.chat.completions.calls[1]["messages"]
    assert any(
        "not valid according to the schema" in message["content"]
        for message in retry_messages
    )


def test_unusable_output_becomes_failed_decision():
    llm, _stub = make_llm(["garbage", "still garbage"])

    decision = llm.decide(base_session())

    assert decision.status == "failed"
    assert "could not use" in decision.message


def test_falls_back_to_json_object_when_schema_unsupported():
    llm, stub = make_llm(
        [bad_request_error(), VALID_ACTION_JSON, VALID_ACTION_JSON]
    )
    session = base_session()

    first = llm.decide(session)
    second = llm.decide(session)

    assert first.status == "action"
    assert second.status == "action"
    formats = [
        call["response_format"]["type"] for call in stub.chat.completions.calls
    ]
    assert formats[0] == "json_schema"
    assert formats[1] == "json_object"
    assert formats[2] == "json_object"


def test_transport_error_becomes_failed_decision():
    llm, _stub = make_llm([ConnectionError("network down")])

    decision = llm.decide(base_session())

    assert decision.status == "failed"
    assert "reach the AI backend" in decision.message


def test_rate_limit_errors_are_retried_then_succeed():
    llm, stub = make_llm(
        [rate_limit_error(), rate_limit_error(), VALID_ACTION_JSON]
    )
    llm.retry_delays = (0.0, 0.0)

    decision = llm.decide(base_session())

    assert decision.status == "action"
    assert len(stub.chat.completions.calls) == 3


def test_rate_limit_exhaustion_fails_gracefully():
    llm, stub = make_llm([rate_limit_error(), rate_limit_error(), rate_limit_error()])
    llm.retry_delays = (0.0, 0.0)

    decision = llm.decide(base_session())

    assert decision.status == "failed"
    assert "reach the AI backend" in decision.message
    assert len(stub.chat.completions.calls) == 3


def test_missing_key_returns_config_hint(monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("NAVEX_LLM_API_KEY", "")
    monkeypatch.setattr("app.agent.llm.OpenAI", lambda **kwargs: StubClient([]))

    get_settings.cache_clear()
    try:
        llm = RealLLM(registry=load_registry())
        decision = llm.decide(base_session())
    finally:
        get_settings.cache_clear()

    assert decision.status == "failed"
    assert "NAVEX_LLM_API_KEY" in decision.message


def test_llm_base_url_is_configurable(monkeypatch):
    from app.config import Settings, get_settings

    monkeypatch.setenv(
        "NAVEX_LLM_BASE_URL", "http://localhost:11434/v1"
    )
    get_settings.cache_clear()
    try:
        settings = Settings()
        captured = {}
        monkeypatch.setattr(
            "app.agent.llm.OpenAI",
            lambda **kwargs: captured.update(kwargs) or StubClient([]),
        )

        llm = RealLLM(registry=load_registry())
    finally:
        get_settings.cache_clear()

    assert settings.llm_base_url == "http://localhost:11434/v1"
    assert captured["base_url"] == "http://localhost:11434/v1"


def test_engine_accepts_real_llm_as_decider():
    llm, _stub = make_llm(['{"status":"complete","message":"Done."}'])
    engine = AgentEngine(llm=llm, registry=load_registry())

    final = engine.advance(base_session())

    assert final.type == "final"
    assert final.reason == "complete"
    assert final.message == "Done."
