from typing import Annotated

from fastapi import Header, HTTPException, status

from app.agent.engine import AgentEngine, Decider
from app.agent.llm import RealLLM
from app.config import get_settings
from app.registry import SiteRegistry, load_registry
from app.storage.memory import SessionStore, SiteMapStore

store = SessionStore()
map_store = SiteMapStore()
registry: SiteRegistry = load_registry()


def get_registry() -> SiteRegistry:
    return registry


def build_engine() -> AgentEngine:
    llm: Decider = RealLLM(registry=registry)
    return AgentEngine(
        llm=llm, registry=registry, max_steps=get_settings().max_agent_steps
    )


engine = build_engine()


def get_store() -> SessionStore:
    return store


def get_map_store() -> SiteMapStore:
    return map_store


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