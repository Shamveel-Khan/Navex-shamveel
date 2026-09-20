from fastapi import APIRouter, Depends, HTTPException, status

from app.agent.engine import AgentEngine
from app.deps import get_engine, get_map_store, get_store, require_api_key
from app.schemas.protocol import ChatRequest, TurnFinal, TurnResponse
from app.storage.memory import SessionNotFoundError, SessionStore, SiteMapStore

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.post("/api/chat")
def chat(
    payload: ChatRequest,
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
            detail="another turn is already in progress",
        )
    try:
        session.start_turn(payload.message)

        # Bind session to the uploaded site map if one was provided.
        if payload.site:
            site_registry = map_store.get(payload.site)
            if site_registry is None:
                norm = payload.site.replace("-", "").replace(":", "").replace(".", "")
                for existing_site in map_store.all():
                    exist_norm = existing_site.site.replace("-", "").replace(":", "").replace(".", "")
                    if norm in exist_norm or exist_norm in norm:
                        site_registry = existing_site
                        break

            if site_registry is None:
                if any(k in payload.site for k in ["localhost", "127-0-0-1", "127.0.0.1", "demo-app"]):
                    from app.deps import get_registry
                    site_registry = get_registry()
                elif payload.page is not None:
                    from app.registry import PageDef, SiteRegistry
                    site_registry = SiteRegistry(
                        site=payload.site,
                        pages=[
                            PageDef(
                                path=payload.page.path,
                                description=payload.page.title or "Current observed page",
                                elements=payload.page.elements,
                            )
                        ],
                    )
                    map_store.put(site_registry)

            if site_registry is not None:
                session.site = site_registry.site
            else:
                return TurnFinal(
                    type="final",
                    reason="failed",
                    message=(
                        f"The site map for '{payload.site}' has not been uploaded yet. "
                        "Please upload the site map first by calling POST /api/site-maps."
                    ),
                )


        if payload.page is not None:
            session.page_state = payload.page
            session.current_page = payload.page.path

        active_registry = None
        if session.site:
            active_registry = map_store.get(session.site)

        return engine.advance(
            session, observation=None, registry=active_registry
        )
    finally:
        lock.release()
