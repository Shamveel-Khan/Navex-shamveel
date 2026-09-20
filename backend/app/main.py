import json
import time
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.logger import log_http_request, log_http_response
from app.routes import chat, observations, sessions, site_maps

settings = get_settings()

app = FastAPI(title="Navex Agent API", version="0.1.0")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Read and cache request body
        try:
            req_body = await request.body()
            if req_body:
                try:
                    parsed_body = json.loads(req_body.decode("utf-8"))
                except Exception:
                    parsed_body = req_body.decode("utf-8", errors="replace")
            else:
                parsed_body = None
        except Exception:
            parsed_body = None

        log_http_request(request.method, request.url.path, parsed_body)

        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Read response body for logging
        res_body = None
        response_body = [section async for section in response.body_iterator]
        response.body_iterator = iterate_in_threadpool(iter(response_body)) if False else _make_async_iterator(response_body)
        raw_res = b"".join(response_body)
        try:
            res_body = json.loads(raw_res.decode("utf-8"))
        except Exception:
            res_body = raw_res.decode("utf-8", errors="replace")

        log_http_response(response.status_code, duration_ms, res_body)
        return Response(
            content=raw_res,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )


async def _make_async_iterator(items):
    for item in items:
        yield item


app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(sessions.router)
app.include_router(chat.router)
app.include_router(observations.router)
app.include_router(site_maps.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

