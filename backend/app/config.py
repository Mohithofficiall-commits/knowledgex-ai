"""
Centralized application settings loaded from environment variables.
Supports both PostgreSQL and local SQLite fallback.
Never hardcodes secrets.
"""
from functools import lru_cache
from pathlib import Path
from typing import List, Literal, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────
    app_env: Literal["development", "staging", "production"] = "development"
    app_name: str = "KnowledgeX AI"
    app_version: str = "1.0.0"
    debug: bool = False

    # ── JWT Security ─────────────────────────────────────────
    secret_key: str = Field(
        default="knowledgex-dev-secret-key-32-characters-min",
        description="JWT encryption secret key",
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # ── Database ─────────────────────────────────────────────
    # By default, use SQLite async for portable out-of-the-box local execution,
    # or override with POSTGRES_URL / DATABASE_URL in .env
    database_url: Optional[str] = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "knowledgex"
    postgres_user: str = "knowledgex_user"
    postgres_password: str = ""

    @property
    def async_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        if self.postgres_password:
            return (
                f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
                f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )
        # Default portable SQLite fallback stored in backend/data/
        db_path = BASE_DIR / "data" / "knowledgex.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{db_path}"

    # ── Storage ──────────────────────────────────────────────
    storage_dir: Path = BASE_DIR / "storage" / "documents"

    # ── Qdrant Vector Store ───────────────────────────────────
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "knowledgex_chunks"
    qdrant_api_key: str = ""

    # ── LLM & Embeddings (Optional - works 100% without keys) ─
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""
    llm_provider: Literal["openai", "anthropic", "google", "none"] = "none"
    embedding_provider: Literal["openai", "local"] = "local"
    embedding_model: str = "text-embedding-3-small"

    # ── CORS ─────────────────────────────────────────────────
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8080",
    ]

    log_level: str = "INFO"

    @property
    def is_llm_configured(self) -> bool:
        if self.llm_provider == "openai" and self.openai_api_key:
            return True
        if self.llm_provider == "anthropic" and self.anthropic_api_key:
            return True
        if self.llm_provider == "google" and self.google_api_key:
            return True
        return False

    @property
    def is_embedding_configured(self) -> bool:
        if self.embedding_provider == "openai" and self.openai_api_key:
            return True
        return False


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.storage_dir.mkdir(parents=True, exist_ok=True)
    return s
