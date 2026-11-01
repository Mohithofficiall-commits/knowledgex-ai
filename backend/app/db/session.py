"""
Async SQLAlchemy Engine and Session factory.
Works uniformly with PostgreSQL (asyncpg) and SQLite (aiosqlite).
"""
import json
from typing import AsyncGenerator
import structlog
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

log = structlog.get_logger(__name__)
settings = get_settings()

# Engine creation with dialect-specific options and safe JSON serializer
connect_args = {}
if settings.async_database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,
    connect_args=connect_args,
    pool_pre_ping=True,
    json_serializer=lambda obj: json.dumps(obj, default=str),
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for obtaining an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables on application startup."""
    async with engine.begin() as conn:
        # Import all model modules so Base.metadata is populated
        from app.models import user, document, collection, chat, knowledge  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
        log.info("db.tables.initialized", url=settings.async_database_url.split("@")[-1])
