"""Health-check and system status endpoints."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/health", tags=["health"])
settings = get_settings()


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    llm_configured: bool
    embedding_configured: bool


@router.get("", response_model=HealthResponse)
async def health_check():
    """Basic health check – returns 200 when the API is up."""
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        environment=settings.app_env,
        llm_configured=settings.is_llm_configured,
        embedding_configured=settings.is_embedding_configured,
    )


@router.get("/ready")
async def readiness():
    """Readiness probe – check critical dependencies."""
    checks: dict[str, str] = {}

    # Database
    try:
        from app.db.session import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"unreachable ({type(exc).__name__})"

    # Qdrant
    try:
        from app.db.qdrant import get_qdrant_client
        client = get_qdrant_client()
        await client.get_collections()
        checks["qdrant"] = "ok"
    except Exception as exc:
        checks["qdrant"] = f"unreachable ({type(exc).__name__})"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}
