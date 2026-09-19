import pytest

from app.agent.decisions import AgentDecision
from app.agent.engine import AgentEngine
from app.agent.mapper import GeminiSiteMapper, extract_quoted_or_named_values
from app.agent.openjev import OpenJevDecider, build_openjev_instructions
from app.registry import load_registry
from app.schemas.actions import ClickAction, FillAction, NavigateAction
from app.schemas.protocol import ActionResultPayload
from app.schemas.ui import PageState, UIElement
from app.session import Session


def sample_projects_page() -> PageState:
    return PageState(
        path="/projects",
        title="Projects",
        elements=[
            UIElement(id="search_projects_input", type="input", label="Search projects"),
            UIElement(id="create_project_button", type="button", label="+ Create Project"),
        ],
    )


def sample_modal_page() -> PageState:
    return PageState(
        path="/projects",
        title="Projects",
        elements=[
            UIElement(id="project_name_input", type="input", label="Project Name"),
            UIElement(id="priority_select", type="select", label="Priority", options=["High", "Medium", "Low"]),
            UIElement(id="save_project_button", type="button", label="Save Project"),
            UIElement(id="cancel_project_button", type="button", label="Cancel"),
            UIElement(id="new_project_form", type="form", label="New Project Form"),
        ],
    )


def test_parameter_extraction():
    query1 = 'Create a project called "Security Research Dashboard" with High priority'
    params1 = extract_quoted_or_named_values(query1)
    assert params1.get("primary_name") == "Security Research Dashboard"
    assert params1.get("priority") == "High"

    query2 = "Create project named Cloud Infrastructure and priority Low"
    params2 = extract_quoted_or_named_values(query2)
    assert params2.get("primary_name") == "Cloud Infrastructure"
    assert params2.get("priority") == "Low"


def test_mapper_candidate_choices_includes_job_already_done():
    registry = load_registry()
    mapper = GeminiSiteMapper(registry=registry)
    session = Session.create()
    session.start_turn('Create a project called "Security Research Dashboard"')
    session.page_state = sample_projects_page()

    choices = mapper.build_candidate_choices(session, registry)
    choice_ids = [c.id for c in choices]

    # Must contain job_already_done
    assert "job_already_done" in choice_ids

    # Must contain visible elements
    assert "click:create_project_button" in choice_ids
    assert "fill:search_projects_input" in choice_ids

    # Must contain navigation options to other pages
    assert "navigate:/" in choice_ids
    assert "navigate:/tasks" in choice_ids


def test_openjev_instructions_format():
    registry = load_registry()
    mapper = GeminiSiteMapper(registry=registry)
    session = Session.create()
    session.start_turn("Create a project called Alpha")
    session.page_state = sample_modal_page()
    session.previous_page_state = sample_projects_page()
    session.previous_action = ClickAction(type="click", element_id="create_project_button")
    session.previous_action_label = "Click '+ Create Project'"

    choices = mapper.build_candidate_choices(session, registry)
    instructions = build_openjev_instructions(session, registry, choices)

    assert "USER GOAL:" in instructions
    assert "Create a project called Alpha" in instructions
    assert "PREVIOUS STATE:" in instructions
    assert "PREVIOUS ACTION:" in instructions
    assert "CURRENT BROWSER STATE:" in instructions
    assert "AVAILABLE CHOICES:" in instructions
    assert "job_already_done" in instructions


def test_openjev_decider_job_already_done():
    registry = load_registry()
    decider = OpenJevDecider()
    session = Session.create()
    session.start_turn("Check dashboard")
    session.page_state = PageState(path="/", elements=[])
    session.steps_taken = 1

    # Heuristic/decider terminates when no further actions needed
    decision = decider.decide(session, registry)
    assert decision.status == "complete"
    assert decision.choice_id == "job_already_done"


def test_fresh_per_query_memory_isolation():
    session = Session.create()

    # Job 1
    session.start_turn("Task 1: Create Project A")
    session.steps_taken = 3
    session.previous_action = ClickAction(type="click", element_id="save_button")
    session.previous_action_label = "Save"
    session.previous_page_state = sample_projects_page()
    session.page_state = sample_modal_page()
    session.feedback.append("Some previous feedback")
    assert len(session.feedback) == 1

    # Job 2 starts - MUST wipe all previous job memory
    session.start_turn("Task 2: Delete Project B")

    assert session.user_request == "Task 2: Delete Project B"
    assert session.steps_taken == 0
    assert session.previous_action is None
    assert session.previous_action_label is None
    assert session.previous_page_state is None
    assert len(session.history) == 0
    assert len(session.feedback) == 0
    assert session.invalid_streak == 0
    assert session.repeat_streak == 0


def test_hybrid_engine_full_flow():
    registry = load_registry()
    decider = OpenJevDecider(mapper=GeminiSiteMapper(registry=registry))
    engine = AgentEngine(llm=decider, registry=registry)

    session = Session.create()
    session.start_turn('Create a project called "Security Research Dashboard"')
    session.page_state = PageState(
        path="/",
        elements=[
            UIElement(id="go_to_projects_button", type="button", label="Go to Projects"),
        ],
    )

    # Step 1: Navigates to /projects
    step1 = engine.advance(session, registry=registry)
    assert step1.type == "action"
    assert step1.action.type == "navigate"
    assert step1.action.path == "/projects"

    # Step 2: On /projects, clicks create_project_button
    obs1 = ActionResultPayload(
        status="success",
        page=sample_projects_page(),
    )
    step2 = engine.advance(session, observation=obs1, registry=registry)
    assert step2.type == "action"
    assert step2.action.type == "click"
    assert step2.action.element_id == "create_project_button"

    # Step 3: In modal, fills project name
    obs2 = ActionResultPayload(
        status="success",
        page=sample_modal_page(),
    )
    step3 = engine.advance(session, observation=obs2, registry=registry)
    assert step3.type == "action"
    assert step3.action.type == "fill"
    assert step3.action.element_id == "project_name_input"
    assert step3.action.value == "Security Research Dashboard"

    # Step 4: Clicks save_project_button
    obs3 = ActionResultPayload(
        status="success",
        page=sample_modal_page(),
    )
    step4 = engine.advance(session, observation=obs3, registry=registry)
    assert step4.type == "action"
    assert step4.action.type == "click"
    assert step4.action.element_id == "save_project_button"

    # Step 5: Modal closed, back on /projects -> job_already_done
    obs4 = ActionResultPayload(
        status="success",
        page=sample_projects_page(),
    )
    step5 = engine.advance(session, observation=obs4, registry=registry)
    assert step5.type == "final"
    assert step5.reason == "complete"
