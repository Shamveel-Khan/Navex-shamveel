from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.deps import get_map_store, get_store, require_api_key
from app.storage.memory import SessionStore, SiteMapStore

router = APIRouter(dependencies=[Depends(require_api_key)])


class SiteMapUpload(BaseModel):
    map: dict  # the site map as produced by the extension (SiteMap shape)


class BindSite(BaseModel):
    site: str


@router.post("/api/site-maps")
def upload_site_map(
    payload: SiteMapUpload,
    map_store: SiteMapStore = Depends(get_map_store),
) -> dict:
    """Receive a site map from the extension.

    The map is stored per-site. It is *not* used as the global agent registry
    because multiple browser sessions may operate against different sites
    concurrently. Instead, each chat session binds to a site via
    `POST /api/sessions/{id}/site`.
    """
    from app.registry import SiteRegistry

    try:
        registry = SiteRegistry.model_validate(payload.map)
    except Exception as err:  # pydantic ValidationError or similar
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"invalid site map: {err}",
        )
    map_store.put(registry)
    return {
        "site": registry.site,
        "pages": len(registry.pages),
        "elements": registry.element_count(),
    }


@router.get("/api/site-maps")
def list_site_maps(
    map_store: SiteMapStore = Depends(get_map_store),
) -> dict:
    all_maps = [m.model_dump() for m in map_store.all()]
    return {"maps": all_maps}


@router.post("/api/sessions/{session_id}/site")
def bind_session_to_site(
    session_id: str,
    payload: BindSite,
    store: SessionStore = Depends(get_store),
    map_store: SiteMapStore = Depends(get_map_store),
) -> dict:
    """Bind a chat session to a specific uploaded site map."""
    from app.storage.memory import SessionNotFoundError

    try:
        session = store.get(session_id)
    except SessionNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="unknown session"
        )
    if map_store.get(payload.site) is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=(
                f"site '{payload.site}' is not uploaded yet — call "
                "POST /api/site-maps first"
            ),
        )
    session.site = payload.site
    return {"session_id": session_id, "site": payload.site}