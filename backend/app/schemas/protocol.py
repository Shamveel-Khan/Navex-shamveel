from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, model_validator

from app.schemas.actions import AgentAction
from app.schemas.ui import PageState


class SessionCreated(BaseModel):
    session_id: str


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1)
    message: str = Field(min_length=1, max_length=2000)
    page: PageState | None = None
    site: str | None = None  # if provided, bind session to this site map


class ActionResultPayload(BaseModel):
    status: Literal["success", "failed"]
    error: str | None = None
    page: PageState | None = None

    @model_validator(mode="after")
    def check_consistency(self) -> "ActionResultPayload":
        if self.status == "success" and self.page is None:
            raise ValueError("success results must include the observed page")
        if self.status == "failed" and not self.error:
            raise ValueError("failed results must include an error")
        return self


class ObservationRequest(BaseModel):
    session_id: str = Field(min_length=1)
    result: ActionResultPayload
    site: str | None = None  # optional re-bind to a different uploaded site map


class TurnAction(BaseModel):
    type: Literal["action"] = "action"
    step: int
    thought: str = ""
    action: AgentAction


class TurnFinal(BaseModel):
    type: Literal["final"] = "final"
    reason: Literal["complete", "failed", "max_steps"]
    message: str = ""


TurnResponse = Annotated[
    Union[TurnAction, TurnFinal], Field(discriminator="type")
]
