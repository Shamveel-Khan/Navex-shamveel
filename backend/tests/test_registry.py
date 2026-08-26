from app.registry import load_registry

DEMO_APP_ROUTES = {"/", "/projects", "/settings"}


def test_registry_loads_and_validates() -> None:
    registry = load_registry()

    assert registry.site == "demo-app"
    assert len(registry.pages) >= 3


def test_registry_paths_match_demo_app_routes() -> None:
    paths = {p.path for p in load_registry().pages}

    assert paths == DEMO_APP_ROUTES


def test_every_page_has_a_description() -> None:
    for page in load_registry().pages:
        assert len(page.description.strip()) >= 10


def test_page_lookup_helper() -> None:
    registry = load_registry()

    assert registry.page("/projects") is not None
    assert registry.page("/nope") is None
