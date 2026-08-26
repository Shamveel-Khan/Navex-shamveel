"""Drive the real agent loop over HTTP using a simulated browser.

The SimBrowser class mimics the demo app's behaviour: it knows which elements
are visible per route, opens/closes the project modal, stores typed values,
validates form input, and returns ActionResult payloads shaped exactly like
the SDK's. This lets us exercise the REAL LLM end-to-end without a browser.

Usage: backend must be running on localhost:8000 with NAVEX_USE_FAKE_LLM=false
    .venv/bin/python scripts/simulate_turn.py [scenario-number ...]
"""

import json
import sys
import time
from pathlib import Path

import httpx

BASE_URL = "http://localhost:8000"
BACKEND_DIR = Path(__file__).resolve().parent.parent
MAX_ROUNDS = 14


def load_dev_key() -> str:
    env_path = BACKEND_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("NAVEX_DEV_KEY="):
                return line.split("=", 1)[1].strip()
    return "dev-key-123"


HEADERS_BASE = {"Authorization": f"Bearer {load_dev_key()}"}


def el(id_, type_, label, **extra):
    return {"id": id_, "type": type_, "label": label, **extra}


class SimBrowser:
    ROUTES = {"/", "/projects", "/settings"}

    def __init__(self):
        self.path = "/"
        self.modal_open = False
        self.project_name = ""
        self.project_description = ""
        self.priority = "Medium"
        self.email_notifications = True
        self.created_projects: list[str] = []

    def _elements(self) -> list[dict]:
        if self.path == "/":
            return [
                el("go_to_projects_button", "button", "Go to Projects"),
                el("go_to_settings_button", "button", "Open Settings"),
            ]
        if self.path == "/settings":
            return [
                el("settings_form", "form", "Settings"),
                el("display_name_input", "input", "Display Name"),
                el(
                    "email_notifications_checkbox",
                    "checkbox",
                    "Email me about important updates",
                    disabled=False,
                ),
                el("save_settings_button", "button", "Save Settings"),
            ]
        elements = [
            el("search_projects_input", "input", "Search projects..."),
            el("create_project_button", "button", "+ Create Project"),
        ]
        if self.modal_open:
            elements += [
                el("new_project_form", "form", "Create Project"),
                el("project_name_input", "input", "Project Name"),
                el("project_description_input", "textarea", "Description"),
                el(
                    "priority_select",
                    "select",
                    "Priority",
                    options=["High", "Medium", "Low"],
                ),
                el("cancel_project_button", "button", "Cancel"),
                el("save_project_button", "button", "Save Project"),
            ]
        return elements

    def page(self) -> dict:
        title = {" /": "Dashboard", "/projects": "Projects", "/settings": "Settings"}
        return {
            "path": self.path,
            "title": title.get(self.path, self.path),
            "elements": self._elements(),
        }

    def fail(self, error: str) -> dict:
        return {"status": "failed", "error": error, "page": self.page()}

    def ok(self) -> dict:
        return {"status": "success", "page": self.page()}

    def execute(self, action: dict) -> dict:
        kind = action.get("type")

        if kind == "navigate":
            target = action.get("path", "")
            if target not in self.ROUTES:
                return self.fail(f"navigation_failed: no route '{target}'")
            self.path = target
            self.modal_open = False
            return self.ok()

        if kind == "click":
            element_id = action.get("element_id", "")
            visible_ids = {e["id"] for e in self._elements()}
            if element_id not in visible_ids:
                return self.fail(f"element_not_found: '{element_id}'")
            if element_id == "go_to_projects_button":
                self.path = "/projects"
            elif element_id == "go_to_settings_button":
                self.path = "/settings"
            elif element_id == "create_project_button":
                self.modal_open = True
            elif element_id == "cancel_project_button":
                self.modal_open = False
            elif element_id == "email_notifications_checkbox":
                self.email_notifications = not self.email_notifications
            elif element_id == "save_project_button":
                if not self.project_name.strip():
                    return self.fail("validation_error: Project name is required.")
                self.created_projects.append(self.project_name.strip())
                self.modal_open = False
            return self.ok()

        if kind == "fill":
            element_id = action.get("element_id", "")
            value = action.get("value", "")
            visible = {e["id"]: e for e in self._elements()}
            if element_id not in visible:
                return self.fail(f"element_not_found: '{element_id}'")
            if element_id == "project_name_input":
                self.project_name = value
            elif element_id == "project_description_input":
                self.project_description = value
            elif element_id == "search_projects_input":
                pass
            elif element_id == "display_name_input":
                pass
            else:
                return self.fail(f"unsupported_element: '{element_id}' cannot be filled")
            return self.ok()

        if kind == "select":
            element_id = action.get("element_id", "")
            value = action.get("value", "")
            if element_id != "priority_select":
                return self.fail(f"unsupported_element: '{element_id}' is not a select")
            if value not in ("High", "Medium", "Low"):
                return self.fail(f"invalid_option: '{value}'")
            self.priority = value
            return self.ok()

        if kind == "submit":
            form_id = action.get("form_id", "")
            if form_id == "new_project_form" and self.modal_open:
                if not self.project_name.strip():
                    return self.fail("validation_error: Project name is required.")
                self.created_projects.append(self.project_name.strip())
                self.modal_open = False
                return self.ok()
            return self.fail(f"element_not_found: form '{form_id}'")

        return self.fail(f"unsupported_action_type: {kind}")


def run_turn(client: httpx.Client, session_id: str, message: str) -> dict:
    browser = SimBrowser()
    steps = []

    turn = client.post(
        "/api/chat",
        json={"session_id": session_id, "message": message},
    ).json()

    rounds = 0
    while turn.get("type") == "action" and rounds < MAX_ROUNDS:
        rounds += 1
        action = turn["action"]
        steps.append(action)
        print(f"    step {turn['step']}: {json.dumps(action)}  ({turn.get('thought','')[:70]})")
        result = browser.execute(action)
        if result["status"] == "failed":
            print(f"      browser rejected: {result['error']}")
        turn = client.post(
            "/api/agent/observation",
            json={"session_id": session_id, "result": result},
        ).json()

    if turn.get("type") != "final":
        turn = {"type": "stalled", "reason": "round-limit", "message": ""}

    print(f"    FINAL [{turn.get('reason')}]: {turn.get('message','')}")
    print(f"    browser state: path={browser.path} created={browser.created_projects}")
    return {
        "steps": steps,
        "final": turn,
        "browser": browser,
    }


SCENARIOS = [
    ("golden-path", "Create a project called Alpha."),
    ("off-topic", "What can you do?"),
    ("impossible-delete", "Delete all projects."),
    ("unknown-page", "Open the admin panel."),
    ("settings-toggle", 'Set display name to "Shamveel K." and save.'),
]


def main() -> int:
    requested = {int(a) for a in sys.argv[1:] if a.isdigit()}
    failures = 0

    with httpx.Client(base_url=BASE_URL, headers=HEADERS_BASE, timeout=120) as client:
        health = client.get("/api/health").json()
        print(f"health: {health}\n")

        for index, (name, message) in enumerate(SCENARIOS, start=1):
            if requested and index not in requested:
                continue
            print(f"=== [{index}] {name}: \"{message}\" ===")
            started = time.time()
            try:
                session_id = client.post("/api/sessions").json()["session_id"]
                outcome = run_turn(client, session_id, message)
            except Exception as err:
                print(f"    EXCEPTION: {err}")
                failures += 1
                continue

            elapsed = time.time() - started
            final = outcome["final"]
            print(f"    ({len(outcome['steps'])} actions, {elapsed:.1f}s)\n")

            reason = final.get("reason") or final.get("type", "?")
            if name == "golden-path" and (
                reason != "complete" or "Alpha" not in outcome["browser"].created_projects
            ):
                failures += 1
            if name == "settings-toggle" and reason != "complete":
                failures += 1

    print(f"=== {failures} scenario failure(s) ===")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
