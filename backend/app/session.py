import time
import uuid
from dataclasses import dataclass, field

from app.schemas.actions import AgentAction
from app.schemas.ui import PageState


@dataclass
class StepRecord:
    step: int
    action: AgentAction
    outcome: str = "pending"


@dataclass
class Session:
    id: str
    user_request: str = ""
    current_page: str | None = None
    page_state: PageState | None = None
    history: list[StepRecord] = field(default_factory=list)
    feedback: list[str] = field(default_factory=list)
    steps_taken: int = 0
    invalid_streak: int = 0
    repeat_streak: int = 0
    premature_failure_nudged: bool = False
    status: str = "idle"
    created_at: float = field(default_factory=time.time)
    site: str | None = None  # which site map this session operates against

    def start_turn(self, message: str) -> None:
        self.user_request = message
        self.history.clear()
        self.feedback.clear()
        self.steps_taken = 0
        self.invalid_streak = 0
        self.repeat_streak = 0
        self.premature_failure_nudged = False
        self.status = "running"

    @staticmethod
    def create() -> "Session":
        return Session(id=str(uuid.uuid4()))
