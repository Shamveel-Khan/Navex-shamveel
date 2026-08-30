from app.registry import SiteRegistry
from app.schemas.actions import AgentAction
from app.session import Session

HISTORY_WINDOW = 8
FEEDBACK_WINDOW = 4


def format_action(action: AgentAction) -> str:
    kind = action.type
    if kind == "navigate":
        return f"navigate({action.path})"
    if kind == "click":
        return f"click({action.element_id})"
    if kind == "fill":
        return f'fill({action.element_id}, "{action.value}")'
    if kind == "select":
        return f'select({action.element_id}, "{action.value}")'
    if kind == "submit":
        return f"submit({action.form_id})"
    return kind


RULES = """\
RULES
1. Perform exactly ONE action per response, then stop and await the next observation.
2. Check VISIBLE ELEMENTS before acting: if the fields or buttons you need are already visible, use them directly. Do not click a button meant to open a dialog whose elements are already shown - that dialog is open.
3. Only use page paths and element ids EXACTLY as listed below. Never invent ids, paths, values, or actions.
4. If an element you need is not in VISIBLE ELEMENTS, navigate to the page whose description mentions that capability, then act after observing its elements.
5. For select actions, use one of the listed options verbatim.
6. Respond with status "complete" only when the user's goal is achieved and confirmed by an observation.
7. For greetings, small talk, capability questions, or anything that is not a task in this app, respond with status "complete" and a short friendly message. Do not navigate or click for those.
8. If a requested TASK is impossible with the available pages and elements, respond with status "failed".
9. Output nothing except the JSON object. Never output JavaScript, CSS selectors, or explanations outside JSON."""

OUTPUT_CONTRACT = """\
OUTPUT FORMAT (mandatory, single JSON object)
{"status":"action","thought":"<one short sentence>","action":{"type":"navigate","path":"/projects"}}
{"status":"action","thought":"...","action":{"type":"click","element_id":"create_project_button"}}
{"status":"action","thought":"...","action":{"type":"fill","element_id":"project_name_input","value":"Alpha"}}
{"status":"action","thought":"...","action":{"type":"select","element_id":"priority_select","value":"High"}}
{"status":"action","thought":"...","action":{"type":"submit","form_id":"new_project_form"}}
{"status":"complete","thought":"...","message":"<short confirmation for the user>"}
{"status":"failed","thought":"...","message":"<why the request cannot be done>"}"""


def _pages_section(registry: SiteRegistry) -> str:
    lines = ["AVAILABLE PAGES"]
    for page in registry.pages:
        lines.append(f"- {page.path}: {page.description}")
    return "\n".join(lines)


def _page_state_section(session: Session, registry: SiteRegistry) -> str:
    if session.page_state is None:
        return (
            "CURRENT PAGE\n"
            "No page has been observed yet, so NO element ids are known to "
            'you yet. Do NOT return status "failed" at this point. Pick the '
            "page matching the user's goal from AVAILABLE PAGES and respond "
            "with a navigate action as your first move."
        )
    state = session.page_state
    lines = [f"CURRENT PAGE: {state.path}", "VISIBLE ELEMENTS"]
    if not state.elements:
        lines.append("(none)")
    for el in state.elements:
        line = f"- {el.id} | {el.type} | {el.label}"
        if el.disabled:
            line += " | DISABLED"
        if el.options:
            line += f" | options: {', '.join(el.options)}"
        lines.append(line)
    return "\n".join(lines)


def _history_section(session: Session) -> str:
    if not session.history:
        return ""
    lines = ["ACTION HISTORY (most recent last)"]
    for record in session.history[-HISTORY_WINDOW:]:
        lines.append(
            f"step {record.step}: {format_action(record.action)} -> {record.outcome}"
        )
    return "\n".join(lines)


def _feedback_section(session: Session) -> str:
    recent = session.feedback[-FEEDBACK_WINDOW:]
    if not recent:
        return ""
    lines = ["VALIDATOR FEEDBACK (fix these problems)"]
    lines.extend(f"- {item}" for item in recent)
    return "\n".join(lines)


def build_system_prompt(session: Session, registry: SiteRegistry) -> str:
    parts = [
        "You are Navex, an AI assistant embedded in a web application. "
        "You operate the app on the user's behalf by choosing UI actions, "
        "one step at a time, based on observed screen state.",
        RULES,
        OUTPUT_CONTRACT,
        _pages_section(registry),
        _page_state_section(session, registry),
    ]
    history = _history_section(session)
    if history:
        parts.append(history)
    feedback = _feedback_section(session)
    if feedback:
        parts.append(feedback)
    return "\n\n".join(parts)


def build_messages(session: Session, registry: SiteRegistry) -> list[dict]:
    messages = [
        {"role": "system", "content": build_system_prompt(session, registry)},
        {"role": "user", "content": f'User request: "{session.user_request}"'},
    ]
    for index, item in enumerate(session.feedback[-FEEDBACK_WINDOW:], start=1):
        messages.append(
            {"role": "user", "content": f"Validator correction {index}: {item}"}
        )
    return messages
