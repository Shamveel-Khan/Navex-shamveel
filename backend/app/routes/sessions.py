from fastapi import APIRouter, Depends

from app.deps import get_store, require_api_key
from app.schemas.protocol import SessionCreated
from app.storage.memory import SessionStore

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.post("/api/sessions", response_model=SessionCreated)
def create_session(
    store: SessionStore = Depends(get_store),
) -> SessionCreated:
    session = store.create()
    return SessionCreated(session_id=session.id)
