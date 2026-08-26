from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class NavigateAction(BaseModel):
    type: Literal["navigate"]
    path: str = Field(min_length=1, max_length=200)


class ClickAction(BaseModel):
    type: Literal["click"]
    element_id: str = Field(min_length=1, max_length=100)


class FillAction(BaseModel):
    type: Literal["fill"]
    element_id: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=500)


class SelectAction(BaseModel):
    type: Literal["select"]
    element_id: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=200)


class SubmitAction(BaseModel):
    type: Literal["submit"]
    form_id: str = Field(min_length=1, max_length=100)


AgentAction = Annotated[
    NavigateAction
    | ClickAction
    | FillAction
    | SelectAction
    | SubmitAction,
    Field(discriminator="type"),
]
