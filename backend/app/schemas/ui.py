from typing import Literal

from pydantic import BaseModel, Field

ElementType = Literal[
    "button", "input", "textarea", "select", "checkbox", "radio", "form"
]


class UIElement(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    type: ElementType
    label: str = ""
    disabled: bool = False
    options: list[str] | None = None


class PageState(BaseModel):
    path: str = Field(min_length=1, max_length=200)
    title: str | None = None
    elements: list[UIElement] = []

    def element(self, element_id: str) -> UIElement | None:
        return next((e for e in self.elements if e.id == element_id), None)
