import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("NAVEX_DEV_KEY", "test-key")

import pytest
from fastapi.testclient import TestClient

from app import deps
from app.agent.stub_llm import StubLLM
from app.agent.decisions import AgentDecision
from app.main import app


@pytest.fixture(autouse=True)
def force_stub_llm():
    original = deps.engine.llm
    deps.engine.llm = StubLLM()
    yield
    deps.engine.llm = original


@pytest.fixture()
def client():
    deps.store.reset()
    deps.engine.llm.script = []
    return TestClient(app)


@pytest.fixture()
def auth_headers():
    return {"Authorization": "Bearer test-key"}
