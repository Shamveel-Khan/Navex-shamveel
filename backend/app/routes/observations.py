from fastapi import APIRouter, Depends, HTTPException, status

from app.agent.engine import AgentEngine
from app.deps import get_engine, get_map_store, get_store, require_api_key
from app.schemas.protocol import ObservationRequest, TurnResponse
from app.storage.memory import SessionNotFoundError, SessionStore, SiteMapStore

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.post("/api/agent/observation")
def observation(
    payload: ObservationRequest,
    store: SessionStore = Depends(get_store),
    map_store: SiteMapStore = Depends(get_map_store),
    engine: AgentEngine = Depends(get_engine),
) -> TurnResponse:
    try:
        session = store.get(payload.session_id)
        lock = store.lock_for(payload.session_id)
    except SessionNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="unknown session"
        )

    if not lock.acquire(timeout=10):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="another turn step is already in progress",
        )
    try:
        if payload.site:
            site_registry = map_store.get(payload.site)
            if site_registry is not None:
                session.site = payload.site
        active_registry = None
        if session.site:
            active_registry = map_store.get(session.site)
        return engine.advance(
            session, observation=payload.result, registry=active_registry
        )
    finally:
        lock.release()
