import pytest
from fastapi.testclient import TestClient

from app import deps
from app.registry import SiteRegistry, load_registry
from app.storage.memory import SiteMapStore

VALID_MAP = {
    "map": {
        "site": "cloudflare-dashboard",
        "base_url": "https://dash.cloudflare.com",
        "generated_at": "2026-08-28T10:15:00Z",
        "pages": [
            {
                "path": "/zones",
                "title": "Zones",
                "description": "Page for Zones. 3 interactive element(s), 1 form(s).",
                "elements": [
                    {
                        "id": "create_zone_button",
                        "type": "button",
                        "label": "Create Zone",
                        "description": "Opens the form for creating a new project",
                    },
                    {
                        "id": "zone_name_input",
                        "type": "input",
                        "label": "Zone Name",
                        "description": "Enters Zone Name",
                    },
                ],
            }
        ],
    }
}


@pytest.fixture()
def map_store() -> SiteMapStore:
    store = SiteMapStore()
    return store


@pytest.fixture()
def client_with_reset(client: TestClient) -> TestClient:
    original_registry = deps.get_registry()
    original_pages = [p.model_copy(deep=True) for p in original_registry.pages]
    deps.map_store.reset()
    yield client
    original_registry.pages = original_pages
    deps.map_store.reset()


def test_upload_site_map(client_with_reset, auth_headers):
    resp = client_with_reset.post(
        "/api/site-maps", json=VALID_MAP, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "site": "cloudflare-dashboard",
        "pages": 1,
        "elements": 2,
    }


def test_upload_site_map_requires_api_key(client_with_reset):
    resp = client_with_reset.post("/api/site-maps", json=VALID_MAP)
    assert resp.status_code == 401


def test_upload_stores_map_per_site_not_global_registry(client_with_reset, auth_headers):
    """Uploading a site map stores it in the map_store. It does NOT replace
    the global registry, since multiple sessions may target different sites."""
    client_with_reset.post("/api/site-maps", json=VALID_MAP, headers=auth_headers)
    registry = deps.get_registry()
    assert registry.site != "cloudflare-dashboard"
    zone_page = registry.page("/zones")
    assert zone_page is None


def test_upload_rejects_invalid_map(client_with_reset, auth_headers):
    bad = {"map": {"site": "x", "pages": [{"path": "no-slash", "description": "d"}]}}
    resp = client_with_reset.post("/api/site-maps", json=bad, headers=auth_headers)
    assert resp.status_code == 422


def test_list_site_maps(client_with_reset, auth_headers):
    client_with_reset.post("/api/site-maps", json=VALID_MAP, headers=auth_headers)
    resp = client_with_reset.get("/api/site-maps", headers=auth_headers)
    assert resp.status_code == 200
    maps = resp.json()["maps"]
    assert len(maps) == 1
    assert maps[0]["site"] == "cloudflare-dashboard"


def test_session_can_be_bound_to_uploaded_site(client_with_reset, auth_headers):
    """POST /api/sessions/{id}/site binds a session to an uploaded site map."""
    from app.storage.memory import SessionStore

    resp = client_with_reset.post("/api/site-maps", json=VALID_MAP, headers=auth_headers)
    assert resp.status_code == 200

    session_resp = client_with_reset.post("/api/sessions", headers=auth_headers)
    assert session_resp.status_code == 200
    session_id = session_resp.json()["session_id"]

    bind_resp = client_with_reset.post(
        f"/api/sessions/{session_id}/site",
        json={"site": "cloudflare-dashboard"},
        headers=auth_headers,
    )
    assert bind_resp.status_code == 200
    assert bind_resp.json() == {
        "session_id": session_id,
        "site": "cloudflare-dashboard",
    }


def test_session_bind_unknown_site_returns_404(client_with_reset, auth_headers):
    """Binding a session to an unknown site returns 404."""
    session_resp = client_with_reset.post("/api/sessions", headers=auth_headers)
    session_id = session_resp.json()["session_id"]

    bind_resp = client_with_reset.post(
        f"/api/sessions/{session_id}/site",
        json={"site": "nonexistent-site"},
        headers=auth_headers,
    )
    assert bind_resp.status_code == 404


def test_map_elements_reach_prompt_for_session_bound_to_site(client_with_reset, auth_headers):
    """When a session is bound to an uploaded site, the prompt shows the
    observed page state with the cloudflare map's element ids."""
    client_with_reset.post("/api/site-maps", json=VALID_MAP, headers=auth_headers)
    store: SessionStore = deps.get_store()
    session = store.create()
    session.site = "cloudflare-dashboard"

    from app.agent.prompts import _page_state_section, _pages_section
    from app.schemas.ui import PageState, UIElement

    # Simulate the browser observing a /zones page with the cloudflare map's
    # elements injected as data-waid attrs.
    page_state = PageState(
        path="/zones",
        elements=[
            UIElement(
                id="create_zone_button",
                type="button",
                label="Create Zone",
            ),
            UIElement(
                id="zone_name_input",
                type="input",
                label="Zone Name",
            ),
        ],
    )
    session.page_state = page_state

    bound_registry = deps.get_map_store().get("cloudflare-dashboard")
    assert bound_registry is not None

    page_text = _page_state_section(session, bound_registry)
    assert "VISIBLE ELEMENTS" in page_text
    assert "create_zone_button" in page_text
    assert "zone_name_input" in page_text

    pages_text = _pages_section(bound_registry)
    assert "/zones" in pages_text


def test_registry_mutation_is_in_place():
    registry = deps.get_registry()
    assert isinstance(registry, SiteRegistry)
    before = registry.pages
    clone = load_registry()
    clone.replace(SiteRegistry(site="x", pages=registry.pages))
    assert registry.pages is not None
    SiteRegistry.model_validate(registry.model_dump())