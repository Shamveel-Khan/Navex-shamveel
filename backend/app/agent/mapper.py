"""Gemini Site Mapping & Parameter Extraction Service for NAVEX.

Handles:
1. Converting SiteRegistry / PageState into structured semantic maps and candidate action choices.
2. Extracting entity parameters (values to fill/select) from user queries for target form elements.
"""

from __future__ import annotations

import re
from typing import Any

from app.registry import PageDef, SiteRegistry
from app.schemas.actions import (
    AgentAction,
    ClickAction,
    FillAction,
    NavigateAction,
    SelectAction,
    SubmitAction,
)
from app.schemas.ui import PageState, UIElement
from app.session import Session


class OpenJevChoice:
    def __init__(
        self,
        id: str,
        label: str,
        action: AgentAction | None = None,
        is_terminal: bool = False,
    ) -> None:
        self.id = id
        self.label = label
        self.action = action
        self.is_terminal = is_terminal

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
        }


def extract_quoted_or_named_values(user_query: str) -> dict[str, str]:
    """Fast deterministic extractor for common patterns in user requests."""
    extracted: dict[str, str] = {}

    # Extract quoted text: "Security Research Dashboard" or 'Alpha'
    quoted = re.findall(r'["\']([^"\']+)["\']', user_query)
    if quoted:
        extracted["primary_name"] = quoted[0]

    # Pattern: "called <Name>" or "named <Name>"
    match_called = re.search(
        r'(?:called|named)\s+(.+?)(?:\s+(?:with|and|priority|in)\b|[.,;]|$)',
        user_query,
        re.IGNORECASE,
    )
    if match_called and "primary_name" not in extracted:
        extracted["primary_name"] = match_called.group(1).strip()

    # Pattern: "priority (High|Medium|Low)" or "with High priority"
    match_priority = re.search(
        r'(?:priority\s+(?:to\s+|as\s+)?|with\s+)(High|Medium|Low)\b',
        user_query,
        re.IGNORECASE,
    )

    if match_priority:
        extracted["priority"] = match_priority.group(1).capitalize()

    # Pattern: "amount <num>" or "$<num>"
    match_amount = re.search(r'\$?\b(\d+(?:\.\d{1,2})?)\b', user_query)
    if match_amount:
        extracted["amount"] = match_amount.group(1)

    return extracted



class GeminiSiteMapper:
    """Provides semantic site mapping and parameter mapping for OpenJev choices."""

    def __init__(self, registry: SiteRegistry | None = None) -> None:
        self.registry = registry

    def resolve_fill_value(
        self,
        element: UIElement,
        user_query: str,
        extracted_params: dict[str, str],
    ) -> str:
        """Determines the best value to fill for a given input element."""
        el_id = element.id.lower()
        label = element.label.lower()

        if "priority" in el_id or "priority" in label:
            if "priority" in extracted_params:
                return extracted_params["priority"]
            if "high" in user_query.lower():
                return "High"
            if "low" in user_query.lower():
                return "Low"
            return "Medium"

        if "amount" in el_id or "budget" in el_id or "amount" in label or "budget" in label:
            if "amount" in extracted_params:
                return extracted_params["amount"]
            return "1000"

        if "email" in el_id or "email" in label:
            match_email = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', user_query)
            if match_email:
                return match_email.group(0)
            if "primary_name" in extracted_params:
                clean = re.sub(r'\s+', '.', extracted_params["primary_name"].lower())
                return f"{clean}@example.com"
            return "user@example.com"

        if "name" in el_id or "title" in el_id or "name" in label or "title" in label:
            if "primary_name" in extracted_params:
                return extracted_params["primary_name"]
            # Fallback: clean the query
            return user_query.strip("\"' .")

        if "primary_name" in extracted_params:
            return extracted_params["primary_name"]

        return user_query.strip("\"' .")

    def build_candidate_choices(
        self,
        session: Session,
        registry: SiteRegistry,
    ) -> list[OpenJevChoice]:
        """Constructs the complete candidate choices list for OpenJev."""
        choices: list[OpenJevChoice] = []

        # 1. Terminal option: job_already_done
        choices.append(
            OpenJevChoice(
                id="job_already_done",
                label="job_already_done: The user's goal has been completely achieved on screen. Stop and finish.",
                action=None,
                is_terminal=True,
            )
        )

        extracted = extract_quoted_or_named_values(session.user_request)
        page_state = session.page_state

        # 2. Page elements visible right now
        if page_state and page_state.elements:
            for el in page_state.elements:
                if el.disabled:
                    continue

                if el.type in {"button", "checkbox", "radio"}:
                    choices.append(
                        OpenJevChoice(
                            id=f"click:{el.id}",
                            label=f"Click '{el.label or el.id}' (button/control)",
                            action=ClickAction(type="click", element_id=el.id),
                        )
                    )
                elif el.type in {"input", "textarea"}:
                    val = self.resolve_fill_value(el, session.user_request, extracted)
                    choices.append(
                        OpenJevChoice(
                            id=f"fill:{el.id}",
                            label=f"Fill '{el.label or el.id}' with \"{val}\"",
                            action=FillAction(type="fill", element_id=el.id, value=val),
                        )
                    )
                elif el.type == "select":
                    options = el.options or ["High", "Medium", "Low"]
                    target_opt = options[0]
                    for opt in options:
                        if opt.lower() in session.user_request.lower():
                            target_opt = opt
                            break
                    choices.append(
                        OpenJevChoice(
                            id=f"select:{el.id}",
                            label=f"Select '{target_opt}' in '{el.label or el.id}'",
                            action=SelectAction(
                                type="select", element_id=el.id, value=target_opt
                            ),
                        )
                    )
                elif el.type == "form":
                    choices.append(
                        OpenJevChoice(
                            id=f"submit:{el.id}",
                            label=f"Submit form '{el.label or el.id}'",
                            action=SubmitAction(type="submit", form_id=el.id),
                        )
                    )

        # 3. Navigation options to other registered pages
        current_path = page_state.path if page_state else session.current_page or "/"
        for page in registry.pages:
            if page.path != current_path:
                choices.append(
                    OpenJevChoice(
                        id=f"navigate:{page.path}",
                        label=f"Navigate to '{page.path}' ({page.description})",
                        action=NavigateAction(type="navigate", path=page.path),
                    )
                )

        return choices
