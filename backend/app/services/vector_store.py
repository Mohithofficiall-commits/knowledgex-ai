"""
Vector storage abstraction for KnowledgeX AI.
Manages Qdrant vector indexing with graceful fallback when Qdrant is deferred or unreachable.
"""
from __future__ import annotations

import uuid
from typing import List, Dict, Any, Optional
import structlog
from pydantic import BaseModel

from app.config import get_settings
from app.services.embeddings import EmbeddingResult
from app.services.chunker import ProcessedChunk

log = structlog.get_logger(__name__)
settings = get_settings()


class VectorIndexOutcome(BaseModel):
    indexed_in_qdrant: bool
    total_vectors: int
    collection_name: str
    dimension: int
    message: str


async def sync_vectors_to_qdrant(
    document_id: uuid.UUID,
    chunks: List[ProcessedChunk],
    embeddings: List[EmbeddingResult],
    document_metadata: Dict[str, Any],
) -> VectorIndexOutcome:
    """
    Upsert chunk embeddings and payloads into Qdrant collection.
    If Qdrant is not available, safely return deferred status.
    """
    total = len(embeddings)
    dim = embeddings[0].dimension if embeddings else 384
    col_name = settings.qdrant_collection

    try:
        from qdrant_client import AsyncQdrantClient
        from qdrant_client.models import Distance, VectorParams, PointStruct

        client = AsyncQdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
            api_key=settings.qdrant_api_key or None,
            timeout=3.0,
        )

        # Check or create collection
        collections = await client.get_collections()
        existing = {c.name for c in collections.collections}
        if col_name not in existing:
            await client.create_collection(
                collection_name=col_name,
                vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
            )
            log.info("qdrant.collection_created", collection=col_name, dim=dim)

        # Build points
        points = []
        for chunk, emb in zip(chunks, embeddings):
            point_id = str(uuid.uuid5(document_id, f"chunk_{chunk.chunk_index}"))
            points.append(
                PointStruct(
                    id=point_id,
                    vector=emb.vector,
                    payload={
                        "document_id": str(document_id),
                        "chunk_index": chunk.chunk_index,
                        "page_hint": chunk.page_hint,
                        "section_heading": chunk.section_heading,
                        "content": chunk.content,
                        "token_count": chunk.token_count,
                        "is_mock_embedding": emb.is_mock,
                        "embedding_model": emb.model_name,
                        "metadata": document_metadata,
                    },
                )
            )

        if points:
            await client.upsert(collection_name=col_name, points=points)
            log.info("qdrant.upsert_success", count=len(points), document_id=str(document_id))
            return VectorIndexOutcome(
                indexed_in_qdrant=True,
                total_vectors=len(points),
                collection_name=col_name,
                dimension=dim,
                message=f"Successfully indexed {len(points)} vectors in Qdrant collection '{col_name}'.",
            )
    except Exception as exc:
        msg = f"Qdrant vector store deferred: {type(exc).__name__} ({str(exc)[:100]}). Chunk vectors preserved in database."
        log.info("qdrant.deferred", reason=msg)
        return VectorIndexOutcome(
            indexed_in_qdrant=False,
            total_vectors=total,
            collection_name=col_name,
            dimension=dim,
            message=msg,
        )

    return VectorIndexOutcome(
        indexed_in_qdrant=False,
        total_vectors=total,
        collection_name=col_name,
        dimension=dim,
        message="No vectors to index.",
    )
