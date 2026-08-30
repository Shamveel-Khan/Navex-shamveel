import json
import time
from typing import Any

from openai import BadRequestError, OpenAI, RateLimitError
from pydantic import ValidationError

from app.agent.decisions import AgentDecision
from app.agent.prompts import build_messages
from app.config import get_settings
from app.registry import SiteRegistry
from app.session import Session

REPAIR_INSTRUCTION = (
    "Your previous reply was not valid according to the schema. "
    "Return exactly one corrected JSON object and nothing else."
)

DECISION_JSON_SCHEMA: dict[str, Any] = {
    "name": "navex_decision",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["action", "complete", "failed"],
            },
            "thought": {"type": "string"},
            "action": {
                "anyOf": [
                    {"$ref": "#/$defs/navigate_action"},
                    {"$ref": "#/$defs/click_action"},
                    {"$ref": "#/$defs/fill_action"},
                    {"$ref": "#/$defs/select_action"},
                    {"$ref": "#/$defs/submit_action"},
                    {"type": "null"},
                ]
            },
            "message": {"type": "string"},
        },
        "required": ["status", "thought", "action", "message"],
        "additionalProperties": False,
        "$defs": {
            "navigate_action": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["navigate"]},
                    "path": {"type": "string"},
                },
                "required": ["type", "path"],
                "additionalProperties": False,
            },
            "click_action": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["click"]},
                    "element_id": {"type": "string"},
                },
                "required": ["type", "element_id"],
                "additionalProperties": False,
            },
            "fill_action": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["fill"]},
                    "element_id": {"type": "string"},
                    "value": {"type": "string"},
                },
                "required": ["type", "element_id", "value"],
                "additionalProperties": False,
            },
            "select_action": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["select"]},
                    "element_id": {"type": "string"},
                    "value": {"type": "string"},
                },
                "required": ["type", "element_id", "value"],
                "additionalProperties": False,
            },
            "submit_action": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["submit"]},
                    "form_id": {"type": "string"},
                },
                "required": ["type", "form_id"],
                "additionalProperties": False,
            },
        },
    },
}


def parse_decision(raw: str) -> AgentDecision:
    data = json.loads(raw)
    return AgentDecision.model_validate(data)


class RealLLM:
    def __init__(
        self,
        registry: SiteRegistry,
        client: Any | None = None,
        model: str | None = None,
        retry_delays: tuple[float, ...] = (2.0, 5.0),
    ) -> None:
        settings = get_settings()
        self.registry = registry
        self.model = model or settings.llm_model
        self.retry_delays = retry_delays
        self._owns_client = client is None
        if client is not None:
            self._client = client
        else:
            self._client = OpenAI(
                base_url=settings.llm_base_url,
                api_key=settings.llm_api_key or "missing-key",
            )
        self._structured_mode: bool | None = None

    def decide(self, session: Session, registry: SiteRegistry) -> AgentDecision:
        if self._owns_client and not get_settings().llm_api_key:
            return AgentDecision(
                status="failed",
                message=(
                    "The AI backend is not configured. "
                    "Set NAVEX_LLM_API_KEY in backend/.env."
                ),
            )

        messages = build_messages(session, registry)
        try:
            raw = self._complete(messages)
        except Exception as err:
            return AgentDecision(
                status="failed",
                message=f"I could not reach the AI backend ({err}).",
            )

        decision = self._safe_parse(raw)
        if decision is not None:
            return decision

        repaired_raw = self._repair(messages, raw)
        if repaired_raw is not None:
            decision = self._safe_parse(repaired_raw)
            if decision is not None:
                return decision

        return AgentDecision(
            status="failed",
            message="The AI returned a response I could not use.",
        )

    def _call(self, messages: list[dict], response_format: dict) -> str:
        response = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=get_settings().llm_temperature,
            max_tokens=get_settings().llm_max_tokens,
            response_format=response_format,
        )
        return response.choices[0].message.content or ""

    def _call_with_retries(self, messages: list[dict], response_format: dict) -> str:
        attempts = len(self.retry_delays) + 1
        for attempt in range(attempts):
            try:
                return self._call(messages, response_format)
            except RateLimitError:
                if attempt >= attempts - 1:
                    raise
                time.sleep(self.retry_delays[attempt])
        raise RuntimeError("unreachable")

    def _complete(self, messages: list[dict]) -> str:
        if self._structured_mode is not False:
            try:
                output = self._call_with_retries(
                    messages,
                    {"type": "json_schema", "json_schema": DECISION_JSON_SCHEMA},
                )
                self._structured_mode = True
                return output
            except BadRequestError:
                self._structured_mode = False
        return self._call_with_retries(messages, {"type": "json_object"})

    def _safe_parse(self, raw: str) -> AgentDecision | None:
        try:
            return parse_decision(raw)
        except (json.JSONDecodeError, ValidationError, TypeError):
            return None

    def _repair(self, messages: list[dict], bad_raw: str) -> str | None:
        retry = messages + [
            {"role": "assistant", "content": bad_raw[:2000]},
            {"role": "user", "content": REPAIR_INSTRUCTION},
        ]
        try:
            return self._complete(retry)
        except Exception:
            return None
