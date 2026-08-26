from typing import Literal

from pydantic import BaseModel, model_validator

from app.schemas.actions import AgentAction


class AgentDecision(BaseModel):
    status: Literal["action", "complete", "failed"]
    thought: str = ""
    action: AgentAction | None = None
    message: str = ""

    @model_validator(mode="after")
    def check_shape(self) -> "AgentDecision":
        if self.status == "action" and self.action is None:
            raise ValueError("status 'action' requires an action")
        if self.status in {"complete", "failed"} and not self.message:
            raise ValueError("terminal statuses require a user-facing message")
        return self
