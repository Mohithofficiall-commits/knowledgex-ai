"""
Advanced RAG Coordinator for KnowledgeX AI.
Orchestrates:
1. Query decomposition & intent analysis
2. Hybrid Retrieval (BM25 + Vector Embedding RRF)
3. Graph RAG entity-edge traversal
4. Cross-Encoder reranking & noise elimination
5. Contradiction & conflicting-claim detection
6. Evidence verification & Hallucination defense (Abstention)
7. Source-grounded answer generation with page-level citations
"""
from __future__ import annotations

import re
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.rag import Citation
from app.services.advanced_rag.hybrid_retriever import HybridRetriever, RetrievedPassage
from app.services.advanced_rag.reranker import CrossEncoderReranker, RerankedPassage
from app.services.advanced_rag.query_decomposer import decompose_query, DecomposedQuery
from app.services.advanced_rag.graph_rag import traverse_graph_context, GraphContext
from app.services.advanced_rag.reasoning_engine import (
    ReasoningEngine,
    ContradictionAlert,
    EvidenceVerification,
)
from app.services.advanced_rag.llm_manager import resolve_llm_client, BaseLLMClient


class AdvancedRAGResponse(BaseModel):
    query: str
    answer: str
    confidence: str  # "high" | "medium" | "low"
    support_score: float  # 0.0 to 1.0
    citations: List[Citation]
    contradictions: List[ContradictionAlert]
    abstain: bool
    rag_mode_used: str  # "hybrid" | "graph_rag" | "corrective" | "agentic"
    llm_provider: str
    llm_model: str
    is_mock_llm: bool
    graph_context: Optional[str] = None
    processing_time_ms: float = 0.0


async def answer_advanced_rag(
    db: AsyncSession,
    query: str,
    collection_id: Optional[uuid.UUID] = None,
    document_ids: Optional[List[uuid.UUID]] = None,
    rag_mode: str = "hybrid",  # "hybrid" | "graph_rag" | "corrective" | "agentic"
    language: str = "en",
    conversation_history: Optional[List[Dict[str, str]]] = None,
    override_llm_provider: Optional[str] = None,
    override_api_key: Optional[str] = None,
    alpha: float = 0.5,
    top_k: int = 8,
) -> AdvancedRAGResponse:
    """
    Executes the complete Advanced RAG workflow.
    """
    import time
    start_time = time.perf_counter()

    # 1. Query Understanding & Decomposition
    decomposed: DecomposedQuery = decompose_query(query)

    # 2. Hybrid Retrieval
    retriever = HybridRetriever(alpha=alpha, rrf_k=60)
    candidate_passages: List[RetrievedPassage] = []

    # Run retrieval across decomposed sub-queries
    for sub_q in decomposed.sub_queries[:3]:
        sub_results = await retriever.retrieve(
            db=db,
            query=sub_q,
            collection_id=collection_id,
            document_ids=document_ids,
            top_k=top_k,
        )
        for p in sub_results:
            if not any(cp.chunk_id == p.chunk_id for cp in candidate_passages):
                candidate_passages.append(p)

    # 3. Graph RAG Traversal (if requested or complex entities found)
    graph_ctx_summary: Optional[str] = None
    if rag_mode in ("graph_rag", "agentic") or (decomposed.entities and len(candidate_passages) < 3):
        graph_data: GraphContext = await traverse_graph_context(db, decomposed.entities)
        graph_ctx_summary = graph_data.explanation
        if graph_data.enriched_chunk_ids:
            # Augment candidate passages with graph-connected chunks
            graph_retrieved = await retriever.retrieve(
                db=db,
                query=query,
                document_ids=None,
                top_k=4,
            )
            for gp in graph_retrieved:
                if gp.chunk_id in graph_data.enriched_chunk_ids and not any(cp.chunk_id == gp.chunk_id for cp in candidate_passages):
                    candidate_passages.append(gp)

    # 4. Cross-Encoder Reranking
    reranker = CrossEncoderReranker(min_relevance_threshold=0.18)
    reranked: List[RerankedPassage] = reranker.rerank(query, candidate_passages, top_n=6)

    # 5. Reasoning Engine & Hallucination Defense (Abstention)
    reasoning = ReasoningEngine(abstention_threshold=0.20)
    should_abstain, abstain_reason = reasoning.evaluate_retrieval(query, reranked)

    if should_abstain:
        abstain_msg = (
            f"KnowledgeX strictly abstains from generating unsupported claims: {abstain_reason}\n"
            f"The indexed documents do not contain sufficient verified evidence to answer this question accurately."
        ) if language == "en" else (
            f"சான்றுகள் போதுமானதாக இல்லை: {abstain_reason}"
        )
        elapsed = round((time.perf_counter() - start_time) * 1000, 2)
        return AdvancedRAGResponse(
            query=query,
            answer=abstain_msg,
            confidence="low",
            support_score=0.0,
            citations=[],
            contradictions=[],
            abstain=True,
            rag_mode_used=rag_mode,
            llm_provider="abstention_guard",
            llm_model="none",
            is_mock_llm=True,
            graph_context=graph_ctx_summary,
            processing_time_ms=elapsed,
        )

    # 6. Contradiction Detection
    contradictions = reasoning.detect_contradictions(reranked)

    # 7. Citations & Context Extraction
    citations: List[Citation] = []
    formatted_passages: List[str] = []

    for idx, rp in enumerate(reranked, start=1):
        excerpt = rp.best_matching_sentence
        formatted_passages.append(f"[{idx}] (Source: {rp.passage.document_title}, Page {rp.passage.page_hint or 1}): {excerpt}")
        citations.append(
            Citation(
                marker=idx,
                document_id=rp.passage.document_id,
                document_title=rp.passage.document_title,
                chunk_id=rp.passage.chunk_id,
                page=rp.passage.page_hint,
                excerpt=excerpt,
            )
        )

    # 8. Answer Generation (Provider-Independent LLM or Extractive Synthesis)
    llm_client: BaseLLMClient = resolve_llm_client(
        override_provider=override_llm_provider,
        override_api_key=override_api_key,
    )

    final_answer = ""
    if not llm_client.is_mock:
        # Construct prompt for real LLM
        history_context = ""
        if conversation_history:
            history_context = "\nRecent Conversation:\n" + "\n".join(
                f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}"
                for m in conversation_history[-4:]
            ) + "\n"

        passages_block = "\n".join(formatted_passages)
        prompt = (
            f"Question: {query}\n\n"
            f"{history_context}"
            f"Evidence Passages:\n{passages_block}\n\n"
            f"Instructions: Synthesize a concise, rigorous response grounded strictly in the evidence above. "
            f"Place citation markers [1], [2] directly after facts you assert. "
            f"Respond in {'Tamil' if language == 'ta' else 'English'}."
        )
        try:
            generated = await llm_client.generate(prompt)
            if generated.strip():
                final_answer = generated.strip()
        except Exception as exc:
            final_answer = ""

    # If mock or LLM call returned empty, use extractive synthesis
    if not final_answer:
        # Structure-grounded extractive assembly
        assembled_parts = []
        for c in citations[:4]:
            assembled_parts.append(f"{c.excerpt} [{c.marker}]")
        final_answer = " ".join(assembled_parts)

    # 9. Evidence Verification
    verification: EvidenceVerification = reasoning.verify_answer_evidence(query, final_answer, reranked)

    confidence = "high" if verification.support_score >= 0.75 else "medium" if verification.support_score >= 0.40 else "low"
    elapsed = round((time.perf_counter() - start_time) * 1000, 2)

    return AdvancedRAGResponse(
        query=query,
        answer=final_answer,
        confidence=confidence,
        support_score=verification.support_score,
        citations=citations,
        contradictions=contradictions,
        abstain=False,
        rag_mode_used=rag_mode,
        llm_provider=llm_client.provider_name,
        llm_model=llm_client.model_name,
        is_mock_llm=llm_client.is_mock,
        graph_context=graph_ctx_summary,
        processing_time_ms=elapsed,
    )
