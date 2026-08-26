from fastapi import APIRouter, Depends, HTTPException, status

from app.agent.engine import AgentEngine
from app.deps import get_engine, get_store, require_api_key
from app.schemas.protocol import ObservationRequest, TurnResponse
from app.storage.memory import SessionNotFoundError, SessionStore

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.post("/api/agent/observation")
def observation(
    payload: ObservationRequest,
    store: SessionStore = Depends(get_store),
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
        return engine.advance(session, observation=payload.result)
    finally:
        lock.release()
