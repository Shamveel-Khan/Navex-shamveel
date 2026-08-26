from app.agent.decisions import AgentDecision
from app.schemas.actions import ClickAction, FillAction, NavigateAction
from app.session import Session

GOLDEN_PATH_SCRIPT: list[AgentDecision] = [
    AgentDecision(
        status="action",
        thought="Projects live on the projects page.",
        action=NavigateAction(type="navigate", path="/projects"),
    ),
    AgentDecision(
        status="action",
        thought="Open the creation form.",
        action=ClickAction(type="click", element_id="create_project_button"),
    ),
    AgentDecision(
        status="action",
        thought="Enter the requested project name.",
        action=FillAction(
            type="fill", element_id="project_name_input", value="Alpha"
        ),
    ),
    AgentDecision(
        status="action",
        thought="Save the project.",
        action=ClickAction(type="click", element_id="save_project_button"),
    ),
    AgentDecision(
        status="complete",
        message='Project "Alpha" was created successfully.',
    ),
]


class FakeLLM:
    def __init__(self, script: list[AgentDecision] | None = None) -> None:
        self.script = list(script if script is not None else GOLDEN_PATH_SCRIPT)

    def decide(self, session: Session) -> AgentDecision:
        if not self.script:
            return AgentDecision(status="complete", message="Done.")
        return self.script.pop(0)
