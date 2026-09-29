from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.db import Base, engine
from app.models import models  # noqa: F401  (register tables)
from app.routers import ai, assets, auth, projects, public, publish, references, rsvp

settings = get_settings()



@asynccontextmanager
async def lifespan(_: FastAPI):
    # Alembic migrations are the production path (apps/api/alembic, `make migrate`,
    # docker-compose runs `alembic upgrade head` on API start). create_all is kept
    # only for dev/test so a fresh checkout runs without a migration step.
    if settings.app_env in ("development", "test"):
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Invito AI API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_origin_regex=r"https://.*\.e2b\.app" if settings.app_env == "development" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


API = "/api"
for r in (auth.router, projects.router, references.router, assets.router, ai.router, publish.router, rsvp.router, public.router):
    app.include_router(r, prefix=API)

if settings.storage_backend == "local":
    import os

    os.makedirs(settings.local_storage_dir, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.local_storage_dir), name="media")


@app.get("/api/health")
def health():
    return {"ok": True, "ai_provider": settings.ai_provider}
