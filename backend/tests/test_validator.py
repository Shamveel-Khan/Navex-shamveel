import pytest

from app.agent.validator import validate_action
from app.registry import load_registry
from app.schemas.actions import (
    ClickAction,
    FillAction,
    NavigateAction,
    SelectAction,
    SubmitAction,
)
from app.schemas.ui import PageState, UIElement


@pytest.fixture()
def page() -> PageState:
    return PageState(
        path="/projects",
        elements=[
            UIElement(
                id="create_project_button", type="button", label="Create"
            ),
            UIElement(id="search_projects_input", type="input", label="Search"),
            UIElement(
                id="priority_select",
                type="select",
                label="Priority",
                options=["High", "Medium", "Low"],
            ),
            UIElement(id="new_project_form", type="form", label="New project"),
            UIElement(
                id="blocked_button", type="button", label="Blocked", disabled=True
            ),
        ],
    )


def judge(action, page):
    return validate_action(action, load_registry(), page)


def test_navigate_to_registered_page_is_valid(page):
    assert judge(NavigateAction(type="navigate", path="/projects"), page).ok


def test_navigate_to_unknown_page_is_rejected(page):
    verdict = judge(NavigateAction(type="navigate", path="/admin"), page)

    assert not verdict.ok
    assert "/projects" in verdict.error


def test_click_existing_element_is_valid(page):
    assert (
        judge(
            ClickAction(type="click", element_id="create_project_button"), page
        ).ok
    )


def test_click_unknown_element_lists_valid_ids(page):
    verdict = judge(ClickAction(type="click", element_id="delete_all"), page)

    assert not verdict.ok
    assert "delete_all" in verdict.error
    assert "create_project_button" in verdict.valid_ids


def test_click_disabled_element_is_rejected(page):
    assert not judge(ClickAction(type="click", element_id="blocked_button"), page).ok


def test_click_non_clickable_element_is_rejected(page):
    assert not judge(
        ClickAction(type="click", element_id="project_name_input"), page
    ).ok


def test_fill_input_is_valid(page):
    assert (
        judge(
            FillAction(
                type="fill", element_id="search_projects_input", value="alpha"
            ),
            page,
        ).ok
    )


def test_fill_on_button_is_rejected(page):
    verdict = judge(
        FillAction(type="fill", element_id="create_project_button", value="x"),
        page,
    )

    assert not verdict.ok
    assert "cannot be filled" in verdict.error


def test_select_with_known_option_is_valid(page):
    assert (
        judge(
            SelectAction(
                type="select", element_id="priority_select", value="High"
            ),
            page,
        ).ok
    )


def test_select_with_unknown_option_is_rejected(page):
    verdict = judge(
        SelectAction(type="select", element_id="priority_select", value="999"),
        page,
    )

    assert not verdict.ok
    assert "High" in verdict.error


def test_submit_form_is_valid(page):
    assert (
        judge(SubmitAction(type="submit", form_id="new_project_form"), page).ok
    )


def test_submit_non_form_is_rejected(page):
    assert not judge(SubmitAction(type="submit", form_id="priority_select"), page).ok


def test_any_element_action_without_observed_page_is_rejected():
    verdict = validate_action(
        ClickAction(type="click", element_id="x"), load_registry(), None
    )

    assert not verdict.ok
    assert "no_page_observed" in verdict.error


def test_element_not_found_includes_hint_when_id_lives_on_different_page():
    """When an element id is not on the observed page but IS registered on
    another page, the error hint tells the LLM which page to navigate to."""
    from app.agent.validator import _reject

    custom_registry = load_registry()
    custom_registry.pages = [
        _make_page_def("/zones", elements=[
            UIElement(id="create_zone_button", type="button", label="Create Zone"),
        ]),
    ]

    state = PageState(
        path="/",
        elements=[UIElement(id="home_button", type="button", label="Home")],
    )

    verdict = validate_action(
        ClickAction(type="click", element_id="create_zone_button"),
        custom_registry,
        state,
    )

    assert not verdict.ok
    assert "element_not_found" in verdict.error
    assert "/zones" in verdict.error
    assert "navigate" in verdict.error
    assert "create_zone_button" not in verdict.valid_ids
    assert "home_button" in verdict.valid_ids


def _make_page_def(path: str, elements: list[UIElement] = None):
    from app.registry import PageDef
    page = PageDef.model_validate({
        "path": path,
        "description": f"Page at {path}",
        "elements": [e.model_dump() for e in (elements or [])],
    })
    return page
