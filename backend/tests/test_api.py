from fastapi.testclient import TestClient

from app import deps
from app.agent.decisions import AgentDecision
from app.schemas.actions import ClickAction

PROJECTS_LIST_PAGE = {
    "path": "/projects",
    "title": "Projects",
    "elements": [
        {
            "id": "search_projects_input",
            "type": "input",
            "label": "Search projects...",
        },
        {
            "id": "create_project_button",
            "type": "button",
            "label": "+ Create Project",
        },
    ],
}

PROJECTS_MODAL_PAGE = {
    "path": "/projects",
    "title": "Projects",
    "elements": [
        *PROJECTS_LIST_PAGE["elements"],
        {"id": "new_project_form", "type": "form", "label": "Create Project"},
        {
            "id": "project_name_input",
            "type": "input",
            "label": "Project Name",
        },
        {
            "id": "project_description_input",
            "type": "textarea",
            "label": "Description",
        },
        {
            "id": "priority_select",
            "type": "select",
            "label": "Priority",
            "options": ["High", "Medium", "Low"],
        },
        {"id": "cancel_project_button", "type": "button", "label": "Cancel"},
        {
            "id": "save_project_button",
            "type": "button",
            "label": "Save Project",
        },
    ],
}


def create_session(client: TestClient, headers) -> str:
    resp = client.post("/api/sessions", headers=headers)
    assert resp.status_code == 200
    return resp.json()["session_id"]


def send_observation(client: TestClient, headers, session_id: str, page) -> dict:
    resp = client.post(
        "/api/agent/observation",
        json={
            "session_id": session_id,
            "result": {"status": "success", "page": page},
        },
        headers=headers,
    )
    assert resp.status_code == 200
    return resp.json()


def test_health_is_open(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_sessions_require_api_key(client):
    assert client.post("/api/sessions").status_code == 401
    assert (
        client.post(
            "/api/sessions", headers={"Authorization": "Bearer wrong"}
        ).status_code
        == 401
    )


def test_chat_requires_known_session(client, auth_headers):
    resp = client.post(
        "/api/chat",
        json={"session_id": "does-not-exist", "message": "hi"},
        headers=auth_headers,
    )

    assert resp.status_code == 404


def test_chat_rejects_malformed_body(client, auth_headers):
    session_id = create_session(client, auth_headers)

    resp = client.post(
        "/api/chat",
        json={"session_id": session_id},
        headers=auth_headers,
    )

    assert resp.status_code == 422


def test_golden_path_full_turn(client, auth_headers):
    session_id = create_session(client, auth_headers)

    first = client.post(
        "/api/chat",
        json={
            "session_id": session_id,
            "message": "Create a project called Alpha.",
        },
        headers=auth_headers,
    ).json()

    assert first["type"] == "action"
    assert first["step"] == 1
    assert first["action"] == {"type": "navigate", "path": "/projects"}

    second = send_observation(client, auth_headers, session_id, PROJECTS_LIST_PAGE)
    assert second["action"] == {
        "type": "click",
        "element_id": "create_project_button",
    }

    third = send_observation(
        client, auth_headers, session_id, PROJECTS_MODAL_PAGE
    )
    assert third["action"] == {
        "type": "fill",
        "element_id": "project_name_input",
        "value": "Alpha",
    }

    fourth = send_observation(
        client, auth_headers, session_id, PROJECTS_MODAL_PAGE
    )
    assert fourth["action"] == {
        "type": "click",
        "element_id": "save_project_button",
    }

    final = send_observation(
        client, auth_headers, session_id, PROJECTS_LIST_PAGE
    )
    assert final["type"] == "final"
    assert final["reason"] == "complete"
    assert "Alpha" in final["message"]

    session = deps.store.get(session_id)
    assert session.status == "done"
    assert session.current_page == "/projects"
    assert [record.outcome for record in session.history] == ["ok"] * 4


def test_observation_after_finished_turn_short_circuits(client, auth_headers):
    session_id = create_session(client, auth_headers)
    client.post(
        "/api/chat",
        json={"session_id": session_id, "message": "Create a project called Alpha."},
        headers=auth_headers,
    )
    deps.store.get(session_id).status = "done"

    resp = client.post(
        "/api/agent/observation",
        json={
            "session_id": session_id,
            "result": {"status": "success", "page": PROJECTS_LIST_PAGE},
        },
        headers=auth_headers,
    ).json()

    assert resp["type"] == "final"
    assert "already finished" in resp["message"]


def test_chat_accepts_current_page_snapshot(client, auth_headers):
    session_id = create_session(client, auth_headers)

    resp = client.post(
        "/api/chat",
        json={
            "session_id": session_id,
            "message": "Create a project called Alpha.",
            "page": PROJECTS_LIST_PAGE,
        },
        headers=auth_headers,
    )

    assert resp.status_code == 200
    session = deps.store.get(session_id)
    assert session.current_page == "/projects"
    assert session.page_state is not None
    assert any(
        element.id == "create_project_button"
        for element in session.page_state.elements
    )


def test_engine_recovers_from_invalid_action_then_completes(
    client, auth_headers
):
    deps.engine.llm.script = [
        AgentDecision(
            status="action",
            action=ClickAction(type="click", element_id="delete_everything"),
        ),
        AgentDecision(status="complete", message="Nothing to delete."),
    ]

    session_id = create_session(client, auth_headers)

    final = client.post(
        "/api/chat",
        json={"session_id": session_id, "message": "Delete everything."},
        headers=auth_headers,
    ).json()

    assert final["type"] == "final"
    assert final["reason"] == "complete"
    assert len(deps.store.get(session_id).history) == 0
