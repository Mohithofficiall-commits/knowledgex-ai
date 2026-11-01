"""
Qdrant vector store client factory.
The collection is created lazily so the app boots without Qdrant running.
"""
from __future__ import annotations

import structlog
from functools import lru_cache
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams

from app.config import get_settings

log = structlog.get_logger(__name__)
settings = get_settings()

VECTOR_SIZE = 1536  # OpenAI text-embedding-3-small; adjust for other models
VECTOR_SIZE_LOCAL = 384  # sentence-transformers/all-MiniLM-L6-v2


@lru_cache
def get_qdrant_client() -> AsyncQdrantClient:
    return AsyncQdrantClient(
        host=settings.qdrant_host,
        port=settings.qdrant_port,
        api_key=settings.qdrant_api_key or None,
    )


async def ensure_collection(client: AsyncQdrantClient | None = None) -> None:
    """Create the Qdrant collection if it does not already exist."""
    client = client or get_qdrant_client()
    vector_size = (
        VECTOR_SIZE if settings.embedding_provider == "openai" else VECTOR_SIZE_LOCAL
    )
    collections = await client.get_collections()
    names = {c.name for c in collections.collections}
    if settings.qdrant_collection not in names:
        await client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
        log.info("qdrant.collection.created", name=settings.qdrant_collection)
    else:
        log.info("qdrant.collection.exists", name=settings.qdrant_collection)
