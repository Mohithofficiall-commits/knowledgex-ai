"""
KnowledgeX AI – FastAPI Application Entry Point.
Modular Backend with Authentication, Documents, Collections, Chat, and Knowledge Graph.
"""
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db.session import init_db
from app.routers import (
    auth,
    chat,
    collections,
    documents,
    health,
    knowledge,
    rag,
    search,
    users,
)

log = structlog.get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle startup and shutdown logic."""
    log.info(
        "knowledgex.backend.starting",
        version=settings.app_version,
        env=settings.app_env,
        db_url=settings.async_database_url.split("@")[-1],
    )
    # Automatically initialize tables on start
    try:
        await init_db()
    except Exception as exc:
        log.error("db.init_failed", error=str(exc))

    yield

    log.info("knowledgex.backend.shutdown")


app = FastAPI(
    title="KnowledgeX AI API",
    description="Backend engine for KnowledgeX AI: Document Ingestion, Retrieval, Collections, and Chat",
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── CORS Middleware ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Exception Handlers ─────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("unhandled_exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again."},
    )


# ── API Routers ───────────────────────────────────────────────────────
API_PREFIX = "/api/v1"
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(collections.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(search.router, prefix=API_PREFIX)
app.include_router(rag.router, prefix=API_PREFIX)
app.include_router(knowledge.router, prefix=API_PREFIX)


# ── Root ──────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "operational",
        "docs": "/api/docs",
        "health": "/api/v1/health",
    }
