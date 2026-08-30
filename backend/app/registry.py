import json
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field

from app.schemas.ui import UIElement


class PageDef(BaseModel):
    path: str = Field(pattern=r"^/[\w.\-/]*$")
    description: str = Field(min_length=1)
    notes: str = ""
    elements: list[UIElement] = []


class SiteRegistry(BaseModel):
    site: str = Field(min_length=1)
    pages: list[PageDef] = Field(min_length=1)

    def page(self, path: str) -> PageDef | None:
        return next((p for p in self.pages if p.path == path), None)

    def replace(self, other: "SiteRegistry") -> None:
        self.site = other.site
        self.pages = other.pages

    def element_count(self) -> int:
        return sum(len(p.elements) for p in self.pages)


REGISTRY_PATH = Path(__file__).resolve().parent / "data" / "demo_site.json"


@lru_cache
def load_registry() -> SiteRegistry:
    return SiteRegistry.model_validate(json.loads(REGISTRY_PATH.read_text("utf-8")))