"""Manual smoke test for the real LLM connection.

Run AFTER adding your OpenRouter key to backend/.env:

    cd backend
    .venv/bin/python scripts/smoke_llm.py

It exercises three realistic decisions directly against the configured model,
without needing the demo app or the SDK.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.agent.llm import RealLLM
from app.config import get_settings
from app.registry import load_registry
from app.schemas.ui import PageState, UIElement
from app.session import Session


def make_session(request: str, page: PageState | None = None) -> Session:
    session = Session.create()
    session.user_request = request
    session.page_state = page
    return session


PROJECTS_PAGE = PageState(
    path="/projects",
    title="Projects",
    elements=[
        UIElement(
            id="search_projects_input", type="input", label="Search projects..."
        ),
        UIElement(
            id="create_project_button", type="button", label="+ Create Project"
        ),
    ],
)

MODAL_PAGE = PageState(
    path="/projects",
    title="Projects",
    elements=[
        *PROJECTS_PAGE.elements,
        UIElement(id="new_project_form", type="form", label="Create Project"),
        UIElement(id="project_name_input", type="input", label="Project Name"),
        UIElement(
            id="priority_select",
            type="select",
            label="Priority",
            options=["High", "Medium", "Low"],
        ),
        UIElement(id="save_project_button", type="button", label="Save Project"),
    ],
)


SCENARIOS = [
    ("routing from dashboard", make_session("Create a project called Alpha.")),
    (
        "first click on projects page",
        make_session("Create a project called Alpha.", PROJECTS_PAGE),
    ),
    (
        "fill inside open modal",
        make_session("Create a project called Alpha.", MODAL_PAGE),
    ),
    ("off-topic question", make_session("What is the capital of France?")),
]


def main() -> int:
    settings = get_settings()
    if not settings.llm_api_key:
        print("NAVEX_LLM_API_KEY is not set - add it to backend/.env first.")
        return 1

    print(f"model: {settings.llm_model} @ {settings.llm_base_url}\n")
    llm = RealLLM(registry=load_registry())
    failures = 0

    for name, session in SCENARIOS:
        decision = llm.decide(session)
        print(f"=== {name} ===")
        print(decision.model_dump_json(indent=2))
        print()
        if decision.status == "failed":
            failures += 1

    print(f"{len(SCENARIOS) - failures}/{len(SCENARIOS)} scenarios succeeded")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
