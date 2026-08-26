import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("NAVEX_DEV_KEY", "test-key")

import pytest
from fastapi.testclient import TestClient

from app import deps
from app.agent.fake_llm import GOLDEN_PATH_SCRIPT, FakeLLM
from app.main import app


@pytest.fixture(autouse=True)
def force_fake_llm():
    original = deps.engine.llm
    if not isinstance(original, FakeLLM):
        deps.engine.llm = FakeLLM()
    yield
    deps.engine.llm = original


@pytest.fixture()
def client():
    deps.store.reset()
    deps.engine.llm.script = list(GOLDEN_PATH_SCRIPT)
    return TestClient(app)


@pytest.fixture()
def auth_headers():
    return {"Authorization": "Bearer test-key"}
