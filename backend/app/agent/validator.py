from dataclasses import dataclass, field

from app.registry import SiteRegistry
from app.schemas.actions import (
    AgentAction,
    ClickAction,
    FillAction,
    NavigateAction,
    SelectAction,
    SubmitAction,
)
from app.schemas.ui import PageState

CLICKABLE_TYPES = {"button", "checkbox", "radio"}
FILLABLE_TYPES = {"input", "textarea"}
MAX_VALUE_LENGTH = 500


@dataclass
class Verdict:
    ok: bool
    error: str = ""
    valid_ids: list[str] = field(default_factory=list)


def _reject(page_state: PageState, message: str) -> Verdict:
    return Verdict(
        ok=False,
        error=message,
        valid_ids=[e.id for e in page_state.elements],
    )


def _where_id_lives(registry: SiteRegistry, element_id: str) -> str | None:
    """Return the page path where this element id is registered, if any."""
    for page in registry.pages:
        if any(e.id == element_id for e in page.elements):
            return page.path
    return None


def _enrich_with_hint(
    registry: SiteRegistry, page_state: PageState, base: str, element_id: str
) -> str:
    """Append a navigation hint when the requested id lives on a different
    page than the one currently observed. This is what the LLM needs to recover
    from "wrong-page" mistakes without re-asking the user."""
    if page_state is None:
        return base
    where = _where_id_lives(registry, element_id)
    if where is None or where == page_state.path:
        return base
    return (
        f"{base}. Hint: '{element_id}' is registered on page '{where}', "
        f"not on '{page_state.path}'. You may need to navigate('{where}') "
        "first."
    )


def validate_action(
    action: AgentAction,
    registry: SiteRegistry,
    page_state: PageState | None,
) -> Verdict:
    if isinstance(action, NavigateAction):
        if registry.page(action.path) is None:
            known = ", ".join(p.path for p in registry.pages)
            return Verdict(
                ok=False,
                error=f"unknown_page: '{action.path}' is not registered. Known pages: {known}",
            )
        return Verdict(ok=True)

    if page_state is None:
        return Verdict(
            ok=False,
            error="no_page_observed: no page has been observed yet; navigate first",
        )

    if isinstance(action, ClickAction):
        el = page_state.element(action.element_id)
        if el is None:
            msg = f"element_not_found: '{action.element_id}' does not exist on '{page_state.path}'"
            return _reject(
                page_state,
                _enrich_with_hint(registry, page_state, msg, action.element_id),
            )
        if el.type not in CLICKABLE_TYPES:
            return _reject(
                page_state,
                f"wrong_element_type: '{el.id}' is a {el.type}, not clickable",
            )
        if el.disabled:
            return _reject(page_state, f"element_disabled: '{el.id}' is disabled")
        return Verdict(ok=True)

    if isinstance(action, FillAction):
        el = page_state.element(action.element_id)
        if el is None:
            msg = f"element_not_found: '{action.element_id}' does not exist on '{page_state.path}'"
            return _reject(
                page_state,
                _enrich_with_hint(registry, page_state, msg, action.element_id),
            )
        if el.type not in FILLABLE_TYPES:
            return _reject(
                page_state,
                f"wrong_element_type: '{el.id}' is a {el.type}, cannot be filled",
            )
        if el.disabled:
            return _reject(page_state, f"element_disabled: '{el.id}' is disabled")
        if len(action.value.strip()) == 0:
            return _reject(page_state, "invalid_value: value cannot be empty")
        if len(action.value) > MAX_VALUE_LENGTH:
            return _reject(page_state, "invalid_value: value too long")
        return Verdict(ok=True)

    if isinstance(action, SelectAction):
        el = page_state.element(action.element_id)
        if el is None:
            msg = f"element_not_found: '{action.element_id}' does not exist on '{page_state.path}'"
            return _reject(
                page_state,
                _enrich_with_hint(registry, page_state, msg, action.element_id),
            )
        if el.type != "select":
            return _reject(
                page_state,
                f"wrong_element_type: '{el.id}' is a {el.type}, not a select",
            )
        options = el.options or []
        if action.value not in options:
            return _reject(
                page_state, f"invalid_option: '{action.value}' not in {options}"
            )
        return Verdict(ok=True)

    if isinstance(action, SubmitAction):
        el = page_state.element(action.form_id)
        if el is None:
            msg = f"element_not_found: form '{action.form_id}' does not exist on '{page_state.path}'"
            return _reject(
                page_state,
                _enrich_with_hint(registry, page_state, msg, action.form_id),
            )
        if el.type != "form":
            return _reject(
                page_state,
                f"wrong_element_type: '{el.id}' is a {el.type}, not a form",
            )
        return Verdict(ok=True)

    return Verdict(ok=False, error=f"unsupported_action: {type(action).__name__}")
