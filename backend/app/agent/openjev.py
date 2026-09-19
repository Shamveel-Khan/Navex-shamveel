"""OpenJev Decision Client and Decider for NAVEX.

Implements the Decider protocol using candidate choices and prompt/instruction context.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.agent.decisions import AgentDecision
from app.agent.mapper import GeminiSiteMapper, OpenJevChoice
from app.agent.prompts import format_action
from app.config import get_settings
from app.registry import SiteRegistry
from app.schemas.actions import AgentAction
from app.schemas.ui import PageState
from app.session import Session

logger = logging.getLogger(__name__)


def summarize_page_state(page_state: PageState | None) -> str:
    if page_state is None:
        return "No page state observed yet."
    elements_summary = ", ".join(
        f"{el.id} ({el.type}: '{el.label}')" for el in page_state.elements[:15]
    )
    if len(page_state.elements) > 15:
        elements_summary += f" ...and {len(page_state.elements) - 15} more"
    return f"Page '{page_state.path}' with visible elements: [{elements_summary or 'none'}]"


def build_openjev_instructions(
    session: Session,
    registry: SiteRegistry,
    choices: list[OpenJevChoice],
) -> str:
    """Builds the comprehensive instructions and context string for OpenJev."""
    prev_state_str = summarize_page_state(session.previous_page_state)

    if session.previous_action is not None:
        outcome = "pending"
        for rec in reversed(session.history):
            if rec.action == session.previous_action:
                outcome = rec.outcome
                break
        prev_action_str = f"{format_action(session.previous_action)} (Label: '{session.previous_action_label or ''}', Result: {outcome})"
    else:
        prev_action_str = "None (this is the first step of the job)"

    curr_state_str = summarize_page_state(session.page_state)

    pages_list = "\n".join(
        f"  - {p.path}: {p.description}" for p in registry.pages
    )

    choices_list = "\n".join(
        f"  [{i+1}] ID: '{c.id}' -> {c.label}" for i, c in enumerate(choices)
    )

    feedback_str = ""
    if session.feedback:
        feedback_str = "\nVALIDATOR / REPEAT CORRECTIONS:\n" + "\n".join(
            f"  * {fb}" for fb in session.feedback[-3:]
        ) + "\n"

    return f"""\
You are OpenJev, the decision-making brain of an AI browser agent operating a web application.
Your task is to select the SINGLE best next action ID from the available choices.

USER GOAL:
"{session.user_request}"

PREVIOUS STATE:
{prev_state_str}

PREVIOUS ACTION:
{prev_action_str}

CURRENT BROWSER STATE:
{curr_state_str}

SITEMAP OVERVIEW:
{pages_list}
{feedback_str}
AVAILABLE CHOICES:
{choices_list}

RULES:
1. Select 'job_already_done' ONLY when the user's goal has been completely accomplished on screen.
2. If the goal is not yet finished, select the single next logical action ID from AVAILABLE CHOICES.
3. If the necessary form or button is not on the current page, choose a navigation action to the appropriate page.
4. Output a JSON object with:
   {{"choice_id": "<exact choice ID>", "thought": "<short reason for choice>"}}
"""


class OpenJevDecider:
    """Evaluates candidate choices and selects the next action via OpenJev."""

    def __init__(
        self,
        mapper: GeminiSiteMapper | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:
        settings = get_settings()
        self.mapper = mapper or GeminiSiteMapper()
        self.base_url = base_url or settings.openjev_base_url
        self.api_key = api_key or settings.openjev_api_key
        self.model = model or settings.openjev_model

    def decide(self, session: Session, registry: SiteRegistry) -> AgentDecision:
        choices = self.mapper.build_candidate_choices(session, registry)
        choice_map = {c.id: c for c in choices}

        instructions = build_openjev_instructions(session, registry, choices)

        # Call OpenJev API or fall back to choice resolution heuristic
        selected_id, thought = self._call_openjev(session, registry, choices, instructions)

        if selected_id not in choice_map:
            # Fallback to smart heuristic if selected_id is invalid
            selected_id, thought = self._heuristic_choice(session, registry, choices)

        chosen = choice_map.get(selected_id)
        if chosen is None:
            return AgentDecision(
                status="failed",
                message="OpenJev could not determine a valid next action.",
            )

        if chosen.is_terminal or chosen.id == "job_already_done":
            return AgentDecision(
                status="complete",
                thought=thought or "Goal is accomplished.",
                message="The requested task is complete.",
                choice_id=chosen.id,
                choice_label=chosen.label,
            )

        return AgentDecision(
            status="action",
            thought=thought or f"Selected {chosen.label}",
            action=chosen.action,
            choice_id=chosen.id,
            choice_label=chosen.label,
        )

    def _call_openjev(
        self,
        session: Session,
        registry: SiteRegistry,
        choices: list[OpenJevChoice],
        instructions: str,
    ) -> tuple[str, str]:
        """Calls the OpenJev endpoint or OpenAI-compatible choice endpoint."""
        settings = get_settings()
        api_key = self.api_key or settings.llm_api_key

        if not api_key:
            return self._heuristic_choice(session, registry, choices)

        endpoint = f"{self.base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": instructions},
                {"role": "user", "content": f'Select the next action for: "{session.user_request}"'},
            ],
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(endpoint, json=payload, headers=headers)
                if res.is_success:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    return parsed.get("choice_id", ""), parsed.get("thought", "")
        except Exception as err:
            logger.warning(f"OpenJev API call failed ({err}), falling back to heuristic choice.")

        return self._heuristic_choice(session, registry, choices)

    def _heuristic_choice(
        self,
        session: Session,
        registry: SiteRegistry,
        choices: list[OpenJevChoice],
    ) -> tuple[str, str]:
        """Deterministic goal-seeking choice solver for offline/test environments."""
        user_req = session.user_request.lower()
        page_state = session.page_state
        current_path = page_state.path if page_state else session.current_page or "/"

        # If we have completed actions and the last action was save/submit/checkbox and modal/form closed
        if session.steps_taken > 0:
            last_record = session.history[-1] if session.history else None
            if last_record and last_record.outcome == "ok":
                action_type = last_record.action.type
                if action_type in {"submit"} or (
                    action_type == "click"
                    and any(k in str(last_record.action) for k in ["save", "done", "confirm", "invite", "delete"])
                ):
                    return "job_already_done", "The creation/update action succeeded and task is finished."

        # Navigation check: are we on the right page?
        target_path = "/"
        if any(w in user_req for w in ["project", "projects"]):
            target_path = "/projects"
        elif any(w in user_req for w in ["task", "tasks"]):
            target_path = "/tasks"
        elif any(w in user_req for w in ["team", "member", "invite"]):
            target_path = "/team"
        elif any(w in user_req for w in ["invoice", "invoices", "pay", "paid"]):
            target_path = "/invoices"
        elif any(w in user_req for w in ["report", "reports"]):
            target_path = "/reports"
        elif any(w in user_req for w in ["activity", "log"]):
            target_path = "/activity"
        elif any(w in user_req for w in ["setting", "settings", "profile"]):
            target_path = "/settings"

        if current_path != target_path:
            nav_choice = f"navigate:{target_path}"
            if any(c.id == nav_choice for c in choices):
                return nav_choice, f"Navigating to {target_path} to perform task"

        # On the page: check if create modal/form needs opening
        has_modal_elements = any(
            (c.id.startswith("fill:") and not any(k in c.id for k in ["search", "filter"]))
            or c.id.startswith("submit:")
            for c in choices
        )

        if not has_modal_elements and any(w in user_req for w in ["create", "add", "new", "invite"]):
            # Look for create button
            for c in choices:
                if c.id.startswith("click:") and any(
                    k in c.id for k in ["create", "add", "new", "invite"]
                ):
                    return c.id, f"Opening action modal/dialog via {c.id}"

        # If modal/form is open, fill required inputs first
        for c in choices:
            if c.id.startswith("fill:") and not any(k in c.id for k in ["search", "filter"]):
                if not any(
                    r.action.type == "fill" and getattr(r.action, "element_id", "") in c.id
                    for r in session.history
                ):
                    return c.id, f"Filling form element: {c.label}"

        # Then select dropdowns if relevant to user query
        for c in choices:
            if c.id.startswith("select:") and not any(k in c.id for k in ["filter", "sort"]):
                field_name = c.id.split(":", 1)[1]
                if any(w in user_req for w in [field_name, "priority", "status", "role", "category"]):
                    if not any(
                        r.action.type == "select" and getattr(r.action, "element_id", "") in c.id
                        for r in session.history
                    ):
                        return c.id, f"Selecting dropdown option: {c.label}"


        # Then submit or save button
        for c in choices:
            if c.id.startswith("click:") and any(
                k in c.id for k in ["save", "submit", "invite", "confirm", "generate"]
            ):
                return c.id, f"Saving/submitting form via {c.id}"
            if c.id.startswith("submit:"):
                return c.id, f"Submitting form: {c.label}"


        # If nothing else left and we took at least one step, goal is done
        if session.steps_taken > 0:
            return "job_already_done", "All steps completed."

        # Default to first non-terminal choice or job_already_done
        for c in choices:
            if not c.is_terminal:
                return c.id, f"Proceeding with {c.label}"

        return "job_already_done", "Task appears complete."
