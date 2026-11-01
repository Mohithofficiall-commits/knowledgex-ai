"""
Hybrid Retrieval Engine for KnowledgeX AI.
Fuses BM25 Lexical Keyword Search with Dense Vector Embedding Search using Reciprocal Rank Fusion (RRF).
"""
from __future__ import annotations

import math
import uuid
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentChunk
from app.services.advanced_rag.bm25 import BM25Index
from app.services.embeddings import get_embedding_provider


class RetrievedPassage(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    chunk_index: int
    page_hint: Optional[int] = None
    section_heading: Optional[str] = None
    content: str
    token_count: int
    dense_score: float = 0.0
    sparse_score: float = 0.0
    hybrid_score: float = 0.0
    embedding_model: Optional[str] = None
    is_mock_embedding: bool = True


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 <= 1e-9 or norm2 <= 1e-9:
        return 0.0
    return max(0.0, min(1.0, dot / (norm1 * norm2)))


class HybridRetriever:
    """
    Executes dense vector search and sparse BM25 search over database chunks,
    fusing results via Reciprocal Rank Fusion (RRF).
    """

    def __init__(self, alpha: float = 0.5, rrf_k: int = 60):
        """
        alpha: Weight for dense vector search (0.0 = pure BM25, 1.0 = pure dense, 0.5 = balanced).
        rrf_k: Constant smoothing parameter in Reciprocal Rank Fusion formula (default 60).
        """
        self.alpha = max(0.0, min(1.0, alpha))
        self.rrf_k = rrf_k

    async def retrieve(
        self,
        db: AsyncSession,
        query: str,
        collection_id: Optional[uuid.UUID] = None,
        document_ids: Optional[List[uuid.UUID]] = None,
        top_k: int = 10,
    ) -> List[RetrievedPassage]:
        """
        Execute hybrid search across document chunks.
        """
        # 1. Fetch Candidate Chunks
        stmt = select(DocumentChunk, Document.title).join(
            Document, Document.id == DocumentChunk.document_id
        )
        if collection_id:
            stmt = stmt.where(Document.collection_id == collection_id)
        if document_ids:
            stmt = stmt.where(DocumentChunk.document_id.in_(document_ids))

        res = await db.execute(stmt.limit(1000))
        rows = res.all()
        if not rows:
            return []

        # 2. Build BM25 Index over fetched passages
        bm25 = BM25Index(k1=1.5, b=0.75)
        doc_tuples = [(str(chunk.id), chunk.content) for chunk, _ in rows]
        bm25.fit(doc_tuples)
        sparse_ranked = bm25.score_query(query)

        sparse_ranks: Dict[str, int] = {}
        sparse_scores_dict: Dict[str, float] = {}
        for rank, (doc_id_str, sc) in enumerate(sparse_ranked, start=1):
            sparse_ranks[doc_id_str] = rank
            sparse_scores_dict[doc_id_str] = sc

        # 3. Dense Vector Retrieval
        provider = get_embedding_provider()
        query_emb = await provider.embed_query(query)
        q_vec = query_emb.vector

        # Calculate vector similarities
        dense_scored: List[Tuple[str, float]] = []
        chunk_map: Dict[str, Tuple[DocumentChunk, str]] = {}

        for chunk, doc_title in rows:
            c_id_str = str(chunk.id)
            chunk_map[c_id_str] = (chunk, doc_title)

            # Generate or compare embedding vector
            c_emb = await provider.embed_texts([chunk.content])
            sim = cosine_similarity(q_vec, c_emb[0].vector) if c_emb else 0.0
            dense_scored.append((c_id_str, sim))

        dense_scored.sort(key=lambda x: x[1], reverse=True)
        dense_ranks: Dict[str, int] = {}
        dense_scores_dict: Dict[str, float] = {}
        for rank, (doc_id_str, sim) in enumerate(dense_scored, start=1):
            dense_ranks[doc_id_str] = rank
            dense_scores_dict[doc_id_str] = sim

        # 4. Reciprocal Rank Fusion (RRF)
        all_candidate_ids = set(chunk_map.keys())
        fused_scores: List[Tuple[str, float]] = []

        for cid in all_candidate_ids:
            # Dense RRF component
            rank_dense = dense_ranks.get(cid, 9999)
            dense_rrf = self.alpha / (self.rrf_k + rank_dense)

            # Sparse RRF component
            rank_sparse = sparse_ranks.get(cid, 9999)
            sparse_rrf = (1.0 - self.alpha) / (self.rrf_k + rank_sparse)

            total_rrf = dense_rrf + sparse_rrf
            fused_scores.append((cid, total_rrf))

        fused_scores.sort(key=lambda x: x[1], reverse=True)

        # 5. Build Final Retrieved Passages
        results: List[RetrievedPassage] = []
        max_rrf = fused_scores[0][1] if fused_scores else 1.0

        for cid, rrf_score in fused_scores[:top_k]:
            chunk, doc_title = chunk_map[cid]
            # Normalized hybrid score 0.0 - 1.0
            norm_hybrid = round(rrf_score / max_rrf, 4) if max_rrf > 0 else 0.0

            results.append(
                RetrievedPassage(
                    chunk_id=chunk.id,
                    document_id=chunk.document_id,
                    document_title=doc_title,
                    chunk_index=chunk.chunk_index,
                    page_hint=chunk.page_hint,
                    section_heading=chunk.section_heading,
                    content=chunk.content,
                    token_count=chunk.token_count,
                    dense_score=round(dense_scores_dict.get(cid, 0.0), 4),
                    sparse_score=round(sparse_scores_dict.get(cid, 0.0), 4),
                    hybrid_score=norm_hybrid,
                    embedding_model=chunk.embedding_model,
                    is_mock_embedding=chunk.is_mock_embedding,
                )
            )

        return results
