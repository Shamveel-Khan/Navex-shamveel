from typing import Annotated

from fastapi import Header, HTTPException, status

from app.agent.engine import AgentEngine, Decider
from app.agent.fake_llm import FakeLLM
from app.agent.llm import RealLLM
from app.config import get_settings
from app.registry import load_registry
from app.storage.memory import SessionStore

store = SessionStore()


def build_engine() -> AgentEngine:
    settings = get_settings()
    registry = load_registry()
    llm: Decider
    if settings.use_fake_llm:
        llm = FakeLLM()
    else:
        llm = RealLLM(registry=registry)
    return AgentEngine(
        llm=llm, registry=registry, max_steps=settings.max_agent_steps
    )


engine = build_engine()


def get_store() -> SessionStore:
    return store


def get_engine() -> AgentEngine:
    return engine


def require_api_key(
    authorization: Annotated[str, Header()] = "",
) -> None:
    expected = f"Bearer {get_settings().dev_key}"
    if authorization != expected:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )
