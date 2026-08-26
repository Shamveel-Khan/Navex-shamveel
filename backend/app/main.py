from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import chat, observations, sessions

settings = get_settings()

app = FastAPI(title="Navex Agent API", version="0.1.0")

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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
