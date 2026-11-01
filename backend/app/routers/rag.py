"""
RAG (Retrieval-Augmented Generation) & Reasoning Endpoints.
Features Hybrid Search, BM25 + Dense RRF, Cross-Encoder Reranking, Graph RAG,
Contradiction Detection, Evidence Verification, Hallucination Abstention, and Version Comparison.
"""
from __future__ import annotations

from pathlib import Path
import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_db
from app.models.document import Document, DocumentChunk, DocumentVersion
from app.schemas.rag import (
    AskRequest,
    AskResponse,
    Citation,
    CompareRequest,
    CompareResponse,
    SummarizeRequest,
    SummarizeResponse,
    VersionCompareRequest,
    VersionCompareResponse,
)
from app.services.advanced_rag.rag_coordinator import answer_advanced_rag
from app.services.advanced_rag.reasoning_engine import ReasoningEngine

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/rag", tags=["rag"])
settings = get_settings()


@router.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest, db: AsyncSession = Depends(get_db)):
    """
    Advanced RAG Question Answering:
    - Query understanding & decomposition
    - Hybrid Retrieval (BM25 + Vector Embedding RRF)
    - Graph RAG multi-hop traversal
    - Cross-Encoder reranking
    - Evidence verification & Hallucination defense (Abstention)
    - Provider-independent LLM generation (Mock, OpenAI, Anthropic, Gemini)
    - Page-level source citations
    """
    rag_out = await answer_advanced_rag(
        db=db,
        query=request.query,
        collection_id=request.collection_id,
        document_ids=request.document_ids or None,
        rag_mode=request.rag_mode,
        language=request.language,
        conversation_history=request.conversation_history,
        override_llm_provider=request.override_llm_provider,
        override_api_key=request.override_api_key,
        alpha=request.alpha,
        top_k=8,
    )

    return AskResponse(
        query=rag_out.query,
        answer=rag_out.answer,
        confidence=rag_out.confidence,
        support_score=rag_out.support_score,
        citations=rag_out.citations,
        contradictions=[c.model_dump() for c in rag_out.contradictions],
        abstain=rag_out.abstain,
        rag_mode_used=rag_out.rag_mode_used,
        llm_provider=rag_out.llm_provider,
        llm_model=rag_out.llm_model,
        is_mock_llm=rag_out.is_mock_llm,
        graph_context=rag_out.graph_context,
        processing_time_ms=rag_out.processing_time_ms,
        llm_used=not rag_out.is_mock_llm,
    )


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest, db: AsyncSession = Depends(get_db)):
    """Summarize a document using structure-aware passage extraction and sentence compression."""
    doc_result = await db.execute(
        select(Document).where(Document.id == request.document_id)
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks_result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == request.document_id)
        .order_by(DocumentChunk.chunk_index)
    )
    chunks = chunks_result.scalars().all()
    if not chunks:
        return SummarizeResponse(
            points=[], document_title=doc.title, coverage=0.0, word_count=0, llm_used=False
        )

    points = []
    for chunk in chunks[: request.max_points * 2]:
        sentences = [s.strip() for s in chunk.content.split(".") if len(s.strip()) > 20]
        if sentences:
            points.append(sentences[0] + ".")
        if len(points) >= request.max_points:
            break

    total_words = sum(len(c.content.split()) for c in chunks)
    coverage = min(len(points) / max(request.max_points, 1), 1.0)

    return SummarizeResponse(
        points=points[: request.max_points],
        document_title=doc.title,
        coverage=coverage,
        word_count=total_words,
        llm_used=False,
    )


@router.post("/compare", response_model=CompareResponse)
async def compare(request: CompareRequest, db: AsyncSession = Depends(get_db)):
    """Compare two documents for shared concepts, unique clauses, and contradictory terms."""
    from collections import Counter
    from app.services.advanced_rag.reasoning_engine import ReasoningEngine
    from app.services.advanced_rag.reranker import RerankedPassage
    from app.services.advanced_rag.hybrid_retriever import RetrievedPassage

    async def load_doc(doc_id):
        doc_r = await db.execute(select(Document).where(Document.id == doc_id))
        doc = doc_r.scalar_one_or_none()
        chunks_r = await db.execute(
            select(DocumentChunk).where(DocumentChunk.document_id == doc_id)
        )
        return doc, chunks_r.scalars().all()

    doc_a, chunks_a = await load_doc(request.document_id_a)
    doc_b, chunks_b = await load_doc(request.document_id_b)

    if not doc_a or not doc_b:
        raise HTTPException(status_code=404, detail="One or both documents not found")

    STOPWORDS = {"the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "of", "and", "or", "for", "with", "that", "this", "it", "be"}

    def extract_terms(chunks):
        text = " ".join(c.content for c in chunks).lower()
        words = [w.strip(".,;:!?()[]\"'") for w in text.split()]
        return Counter(w for w in words if len(w) > 4 and w not in STOPWORDS)

    terms_a = extract_terms(chunks_a)
    terms_b = extract_terms(chunks_b)

    shared_terms = {k for k in terms_a if k in terms_b}
    unique_a_terms = {k for k in terms_a if k not in terms_b}
    unique_b_terms = {k for k in terms_b if k not in terms_a}

    all_terms = len(terms_a | terms_b)
    similarity = len(shared_terms) / max(all_terms, 1)

    def top_terms(terms_set, counter, n=5):
        return sorted(terms_set, key=lambda k: counter.get(k, 0), reverse=True)[:n]

    # Contradiction detection between Doc A and Doc B chunks
    passages_for_check = []
    for c in chunks_a[:4]:
        p = RetrievedPassage(
            chunk_id=c.id, document_id=doc_a.id, document_title=doc_a.title,
            chunk_index=c.chunk_index, content=c.content, token_count=c.token_count
        )
        passages_for_check.append(RerankedPassage(passage=p, rerank_score=0.8, relevance_grade="high", matched_terms=[], best_matching_sentence=c.content[:100]))
    for c in chunks_b[:4]:
        p = RetrievedPassage(
            chunk_id=c.id, document_id=doc_b.id, document_title=doc_b.title,
            chunk_index=c.chunk_index, content=c.content, token_count=c.token_count
        )
        passages_for_check.append(RerankedPassage(passage=p, rerank_score=0.8, relevance_grade="high", matched_terms=[], best_matching_sentence=c.content[:100]))

    engine = ReasoningEngine()
    conflicts = engine.detect_contradictions(passages_for_check)

    return CompareResponse(
        similarity=round(similarity, 3),
        document_a=doc_a.title,
        document_b=doc_b.title,
        shared=top_terms(shared_terms, terms_a),
        unique_a=top_terms(unique_a_terms, terms_a),
        unique_b=top_terms(unique_b_terms, terms_b),
        key_points_a=[c.content.split(".")[0] + "." for c in chunks_a[:3] if c.content],
        key_points_b=[c.content.split(".")[0] + "." for c in chunks_b[:3] if c.content],
        contradictions=[c.model_dump() for c in conflicts],
        llm_used=False,
    )


@router.post("/compare-versions", response_model=VersionCompareResponse)
async def compare_document_versions(
    request: VersionCompareRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Historical Document Version Comparison (Phase 06):
    Reads Version A and Version B from disk/database, detects added/removed/modified
    clauses, and evaluates risk delta.
    """
    doc_res = await db.execute(select(Document).where(Document.id == request.document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    versions_res = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == request.document_id)
    )
    versions = {v.version_number: v for v in versions_res.scalars().all()}

    v_a = versions.get(request.version_a)
    v_b = versions.get(request.version_b)

    if not v_a or not v_b:
        raise HTTPException(
            status_code=400,
            detail=f"Requested versions {request.version_a} and/or {request.version_b} do not exist for this document.",
        )

    text_a = Path(v_a.file_path).read_text(errors="replace") if v_a.file_path and Path(v_a.file_path).exists() else ""
    text_b = Path(v_b.file_path).read_text(errors="replace") if v_b.file_path and Path(v_b.file_path).exists() else ""

    engine = ReasoningEngine()
    diff = engine.compare_versions(
        text_v1=text_a,
        text_v2=text_b,
        version_a_num=request.version_a,
        version_b_num=request.version_b,
    )

    return VersionCompareResponse(
        document_id=doc.id,
        title=doc.title,
        version_a=diff.version_a,
        version_b=diff.version_b,
        similarity_score=diff.similarity_score,
        added_clauses=diff.added_clauses,
        removed_clauses=diff.removed_clauses,
        modified_clauses=diff.modified_clauses,
        risk_delta=diff.risk_delta,
    )
