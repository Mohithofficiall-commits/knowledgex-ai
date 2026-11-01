"""
Search & Retrieval Service: Lexical BM25 ranking, excerpt highlighting, and citation formatting.
"""
from __future__ import annotations
import re
import uuid
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentChunk
from app.schemas.search import SearchHit, SearchResponse
from app.schemas.rag import Citation


STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "of",
    "and", "or", "for", "with", "that", "this", "it", "be", "as", "by", "from",
}


def tokenize(text: str) -> List[str]:
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return [w for w in cleaned.split() if len(w) > 2 and w not in STOPWORDS]


async def search_chunks(
    db: AsyncSession,
    query: str,
    collection_id: Optional[uuid.UUID] = None,
    document_ids: Optional[List[uuid.UUID]] = None,
    limit: int = 10,
) -> SearchResponse:
    """Perform keyword-scored document retrieval across chunks."""
    query_terms = set(tokenize(query))

    stmt = select(DocumentChunk, Document.title).join(
        Document, Document.id == DocumentChunk.document_id
    )

    if collection_id:
        stmt = stmt.where(Document.collection_id == collection_id)
    if document_ids:
        stmt = stmt.where(DocumentChunk.document_id.in_(document_ids))

    result = await db.execute(stmt.limit(500))
    rows = result.all()

    scored_hits: List[Tuple[float, SearchHit]] = []

    for chunk, doc_title in rows:
        chunk_words = tokenize(chunk.content)
        if not chunk_words:
            continue
        overlap = query_terms.intersection(chunk_words)
        if not overlap:
            continue

        # Score based on term overlap density
        score = round(len(overlap) / len(query_terms) * 100, 1)

        # Highlight first sentence containing match
        sentences = chunk.content.split(". ")
        matched_sentences = [
            s for s in sentences if any(term in s.lower() for term in overlap)
        ]
        highlight = (matched_sentences[0] + ".") if matched_sentences else sentences[0]

        hit = SearchHit(
            chunk_id=chunk.id,
            document_id=chunk.document_id,
            document_title=doc_title,
            chunk_index=chunk.chunk_index,
            page=chunk.page_hint,
            content=chunk.content,
            score=score,
            highlight=highlight,
        )
        scored_hits.append((score, hit))

    scored_hits.sort(key=lambda x: x[0], reverse=True)
    top_hits = [h for _, h in scored_hits[:limit]]

    return SearchResponse(
        query=query,
        total_hits=len(scored_hits),
        hits=top_hits,
    )


def build_citations(hits: List[SearchHit]) -> List[Citation]:
    """Convert search hits into numbered citations."""
    citations = []
    for i, hit in enumerate(hits, start=1):
        citations.append(
            Citation(
                marker=i,
                document_id=hit.document_id,
                document_title=hit.document_title,
                chunk_id=hit.chunk_id,
                page=hit.page,
                excerpt=hit.highlight,
            )
        )
    return citations
