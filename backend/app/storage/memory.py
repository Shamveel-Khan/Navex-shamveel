import threading

from app.registry import SiteRegistry
from app.session import Session


class SessionNotFoundError(KeyError):
    pass


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._mutex = threading.Lock()

    def create(self) -> Session:
        session = Session.create()
        with self._mutex:
            self._sessions[session.id] = session
            self._locks[session.id] = threading.Lock()
        return session

    def get(self, session_id: str) -> Session:
        with self._mutex:
            try:
                return self._sessions[session_id]
            except KeyError:
                raise SessionNotFoundError(session_id)

    def lock_for(self, session_id: str) -> threading.Lock:
        with self._mutex:
            try:
                return self._locks[session_id]
            except KeyError:
                raise SessionNotFoundError(session_id)

    def reset(self) -> None:
        with self._mutex:
            self._sessions.clear()
            self._locks.clear()


class SiteMapStore:
    """Keeps uploaded site maps (originals) keyed by site name.

    The live registry used by the agent loop lives in app.deps; this store is
    the audit/review copy of every map that has been uploaded.
    """

    def __init__(self) -> None:
        self._maps: dict[str, SiteRegistry] = {}
        self._mutex = threading.Lock()

    def put(self, registry: SiteRegistry) -> None:
        with self._mutex:
            self._maps[registry.site] = registry

    def get(self, site: str) -> SiteRegistry | None:
        with self._mutex:
            return self._maps.get(site)

    def all(self) -> list[SiteRegistry]:
        with self._mutex:
            return list(self._maps.values())

    def reset(self) -> None:
        with self._mutex:
            self._maps.clear()
