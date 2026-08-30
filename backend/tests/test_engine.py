from app.agent.decisions import AgentDecision
from app.agent.engine import AgentEngine
from app.agent.stub_llm import StubLLM
from app.registry import load_registry
from app.schemas.actions import ClickAction, FillAction, NavigateAction
from app.schemas.protocol import ActionResultPayload
from app.schemas.ui import PageState, UIElement
from app.session import Session


def decision(action):
    return AgentDecision(status="action", thought="", action=action)


def completed(message: str = "Done."):
    return AgentDecision(status="complete", message=message)


def make_engine(script) -> AgentEngine:
    return AgentEngine(
        llm=StubLLM(list(script)), registry=load_registry(), max_invalid_streak=2
    )


PAGE = PageState(
    path="/projects",
    elements=[
        UIElement(id="btn_a", type="button", label="A"),
        UIElement(id="btn_b", type="button", label="B"),
        UIElement(id="name_input", type="input", label="Name"),
    ],
)


def make_session() -> Session:
    session = Session.create()
    session.user_request = "test"
    session.page_state = PAGE.model_copy(deep=True)
    return session


def ok_observation() -> ActionResultPayload:
    return ActionResultPayload(
        status="success", page=PAGE.model_copy(deep=True)
    )


def test_first_time_action_is_returned_normally():
    engine = make_engine([decision(ClickAction(type="click", element_id="btn_a"))])
    session = make_session()

    turn = engine.advance(session, registry=load_registry())

    assert turn.type == "action"
    assert turn.step == 1


def test_identical_action_triggers_warning_then_recovers():
    engine = make_engine(
        [
            decision(ClickAction(type="click", element_id="btn_a")),
            decision(ClickAction(type="click", element_id="btn_a")),
            completed("Recovered."),
        ]
    )
    session = make_session()
    first = engine.advance(session, registry=load_registry())
    assert first.type == "action"

    second = engine.advance(session, ok_observation(), registry=load_registry())

    assert second.type == "final"
    assert second.reason == "complete"
    assert any("repeated_action" in item for item in session.feedback)
    assert len(session.history) == 1


def test_three_identical_actions_abort_the_turn():
    engine = make_engine(
        [
            decision(ClickAction(type="click", element_id="btn_a")),
            decision(ClickAction(type="click", element_id="btn_a")),
            decision(ClickAction(type="click", element_id="btn_a")),
        ]
    )
    session = make_session()
    engine.advance(session, registry=load_registry())

    final = engine.advance(session, ok_observation(), registry=load_registry())

    assert final.type == "final"
    assert final.reason == "failed"
    assert "stuck repeating" in final.message
    assert session.status == "done"


def test_alternating_different_actions_are_not_flagged():
    engine = make_engine(
        [
            decision(ClickAction(type="click", element_id="btn_a")),
            decision(FillAction(type="fill", element_id="name_input", value="x")),
            completed("All done."),
        ]
    )
    session = make_session()

    first = engine.advance(session, registry=load_registry())
    assert first.type == "action"

    second = engine.advance(session, ok_observation(), registry=load_registry())
    assert second.type == "action"

    final = engine.advance(session, ok_observation(), registry=load_registry())
    assert final.type == "final"
    assert final.reason == "complete"
    assert not [item for item in session.feedback if "repeated_action" in item]


def test_premature_failure_at_step_zero_gets_one_nudge_then_recovers():
    engine = make_engine(
        [
            AgentDecision(
                status="failed",
                message="The input field does not exist.",
            ),
            decision(NavigateAction(type="navigate", path="/projects")),
            completed("Explored."),
        ]
    )
    session = make_session()

    final = engine.advance(session, registry=load_registry())

    assert final.type == "final"
    assert final.reason == "complete"
    assert any("premature_failure" in item for item in session.feedback)
    assert session.premature_failure_nudged is True


def test_persistent_immediate_failure_is_accepted_after_nudge():
    engine = make_engine(
        [
            AgentDecision(status="failed", message="Impossible."),
            AgentDecision(status="failed", message="Really impossible."),
        ]
    )
    session = make_session()

    first = engine.advance(session, registry=load_registry())
    assert first.type == "final"
    assert first.message == "Impossible."

    second_session = make_session()
    second_session.premature_failure_nudged = True
    second = engine.advance(second_session, registry=load_registry())
    assert second.type == "final"
    assert second.message == "Really impossible."
    assert len(engine.llm.script) == 0


def test_new_turn_resets_repeat_tracking():
    engine = make_engine(
        [
            decision(ClickAction(type="click", element_id="btn_a")),
            decision(ClickAction(type="click", element_id="btn_a")),
            completed("First task done."),
            decision(ClickAction(type="click", element_id="btn_a")),
        ]
    )
    session = make_session()

    engine.advance(session, registry=load_registry())
    engine.advance(session, ok_observation(), registry=load_registry())
    session.start_turn("second task")

    turn = engine.advance(session, registry=load_registry())

    assert turn.type == "action"
    assert turn.step == 1
    assert session.repeat_streak == 0
