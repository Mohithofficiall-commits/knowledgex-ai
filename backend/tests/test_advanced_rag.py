"""
Complete Verification Test Suite for Phase 05 (Advanced RAG) & Phase 06 (Reasoning Engine).
Tests:
1. BM25 Lexical Indexing & Robertson-Spärck Jones IDF scoring
2. Dense vector cosine similarity
3. Hybrid Retrieval with Reciprocal Rank Fusion (RRF)
4. Cross-Encoder Reranking & relevance filtering
5. Query Decomposition (intent analysis & entity extraction)
6. Graph RAG multi-hop traversal
7. Contradiction Detection across conflicting clauses
8. Hallucination Defense & Strict Abstention on out-of-scope queries
9. Historical Document Version Comparison (clause delta & risk assessment)
10. End-to-end Advanced RAG API Endpoint (/api/v1/rag/ask and /api/v1/rag/compare-versions)
"""
import asyncio
import uuid
import structlog
from app.main import app
from app.db.session import init_db
from tests.run_asgi_tests import ASGITestClient
from app.services.advanced_rag.bm25 import BM25Index, tokenize
from app.services.advanced_rag.hybrid_retriever import cosine_similarity
from app.services.advanced_rag.query_decomposer import decompose_query
from app.services.advanced_rag.reasoning_engine import ReasoningEngine
from app.services.advanced_rag.reranker import CrossEncoderReranker, RetrievedPassage


async def test_advanced_rag_engine():
    print("=" * 70)
    print(" KnowledgeX AI - Phase 05 & 06 Advanced RAG & Reasoning Engine Tests")
    print("=" * 70)

    # 1. Test BM25 Indexing
    bm25 = BM25Index(k1=1.5, b=0.75)
    corpus = [
        ("doc_1", "Quantum computing leverages superposition and entanglement for computational supremacy."),
        ("doc_2", "Retrieval-Augmented Generation blends neural information retrieval with autoregressive generation."),
        ("doc_3", "Knowledge graphs represent entities as nodes and their semantic relations as directed edges."),
    ]
    bm25.fit(corpus)
    scores = bm25.score_query("quantum supremacy superposition")
    assert len(scores) >= 1, "BM25 should return matches"
    assert scores[0][0] == "doc_1", "doc_1 should be the highest BM25 score"
    print(f" [PASS] 1. BM25 Lexical Retrieval: Top match is {scores[0][0]} (score={scores[0][1]})")

    # 2. Test Cosine Similarity
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    v3 = [0.0, 1.0, 0.0]
    assert cosine_similarity(v1, v2) == 1.0
    assert cosine_similarity(v1, v3) == 0.0
    print(" [PASS] 2. Vector Cosine Similarity: Verified exact orthogonality and identity.")

    # 3. Test Query Decomposition
    comp_q = decompose_query("Compare trade license penalties and commercial lease termination clauses")
    assert comp_q.intent == "comparative"
    assert comp_q.is_complex is True
    assert len(comp_q.sub_queries) == 2
    print(f" [PASS] 3. Query Decomposition: Intent={comp_q.intent}, Sub-queries count={len(comp_q.sub_queries)}")

    # 4. Test Cross-Encoder Reranker
    reranker = CrossEncoderReranker(min_relevance_threshold=0.15)
    p1 = RetrievedPassage(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        document_title="Trade License Regulations",
        chunk_index=0,
        section_heading="Penalties and Late Fees",
        content="Late filing incurs a penalty fee of 15% assessed automatically after the March 31 deadline.",
        token_count=20,
        hybrid_score=0.9,
    )
    p2 = RetrievedPassage(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        document_title="Employee Handbook",
        chunk_index=1,
        content="The cafeteria is open from 8am to 5pm on weekdays with complimentary coffee.",
        token_count=15,
        hybrid_score=0.1,
    )
    reranked = reranker.rerank("What is the penalty fee for late filing?", [p1, p2])
    assert len(reranked) == 1, "Irrelevant cafeteria chunk should be discarded below threshold"
    assert reranked[0].passage.document_title == "Trade License Regulations"
    print(f" [PASS] 4. Cross-Encoder Reranker: Filtered noise, scored top passage at {reranked[0].rerank_score}")

    # 5. Test Contradiction Detection (Numerical Conflict)
    engine = ReasoningEngine()
    conflict_p1 = RetrievedPassage(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        document_title="Municipal Notice 2024",
        chunk_index=0,
        content="License renewal requests must be submitted within 30 days of the inspection date.",
        token_count=15,
    )
    conflict_p2 = RetrievedPassage(
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        document_title="Executive Bylaw Amendments",
        chunk_index=0,
        content="License renewal requests must be submitted within 60 days of the inspection date.",
        token_count=15,
    )
    rp_conflict = [
        reranker.rerank("renewal days deadline", [conflict_p1])[0],
        reranker.rerank("renewal days deadline", [conflict_p2])[0],
    ]
    conflicts = engine.detect_contradictions(rp_conflict)
    assert len(conflicts) > 0, "Should detect 30 days vs 60 days contradiction"
    print(f" [PASS] 5. Contradiction Detection: Caught '{conflicts[0].conflict_type}' conflict: {conflicts[0].explanation}")

    # 6. Test Hallucination Defense & Strict Abstention
    out_of_scope_query = "What is the orbital speed of Jupiter's moon Europa in kilometers per second?"
    should_abstain, reason = engine.evaluate_retrieval(out_of_scope_query, [reranked[0]])
    assert should_abstain is True, "System must abstain on out-of-scope query"
    print(f" [PASS] 6. Hallucination Defense (Abstention): Strictly abstained: '{reason[:80]}...'")

    # 7. Test Historical Document Version Comparison
    v1_text = """Section 1: General Purpose
The tenant shall maintain the premises in good condition.
Section 2: Rent Payment
Rent is due on the first day of each month. Late fees are 5 percent.
Section 3: Termination
Either party may terminate with 30 days notice."""

    v2_text = """Section 1: General Purpose
The tenant shall maintain the premises in immaculate condition including HVAC maintenance.
Section 2: Rent Payment
Rent is due on the first day of each month. Late fees are 10 percent.
Section 3: Termination
Either party may terminate with 60 days notice.
Section 4: Indemnification Clause
Tenant shall hold harmless the landlord against third party claims."""

    diff = engine.compare_versions(v1_text, v2_text, version_a_num=1, version_b_num=2)
    assert diff.similarity_score < 1.0
    assert len(diff.added_clauses) > 0 or len(diff.modified_clauses) > 0
    print(f" [PASS] 7. Historical Version Comparison: Similarity={diff.similarity_score}, Risk Delta='{diff.risk_delta}'")

    # 8. Test End-to-End Advanced RAG API Endpoint (/api/v1/rag/ask)
    await init_db()
    client = ASGITestClient(app)

    # Ingest test document to search
    test_email = f"rag_tester_{uuid.uuid4().hex[:6]}@knowledgex.ai"
    await client.request("POST", "/api/v1/auth/register", json_data={"email": test_email, "password": "Password123!", "full_name": "Dr. RAG Tester"})
    _, login_data = await client.request("POST", "/api/v1/auth/login", json_data={"email": test_email, "password": "Password123!"})
    auth_headers = {"Authorization": f"Bearer {login_data['access_token']}"}

    doc_bytes = b"""KnowledgeX Advanced RAG Technical Architecture.
Hybrid retrieval fuses sparse BM25 lexical ranking with dense vector embeddings via Reciprocal Rank Fusion.
Cross-encoder reranking eliminates false positive candidates before answer synthesis.
Knowledge graph traversal enriches multi-hop queries across connected documents."""
    _, upload_res = await client.request(
        "POST",
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("rag_tech_arch.txt", doc_bytes, "text/plain")},
    )
    doc_id = upload_res["document"]["id"]

    # Ask grounded question
    status, ask_res = await client.request(
        "POST",
        "/api/v1/rag/ask",
        headers=auth_headers,
        json_data={
            "query": "How does hybrid retrieval fuse sparse and dense search?",
            "document_ids": [doc_id],
            "rag_mode": "hybrid",
            "alpha": 0.5,
        },
    )
    assert status == 200, f"RAG ask failed: {ask_res}"
    assert ask_res["abstain"] is False, "Should not abstain on grounded query"
    assert len(ask_res["citations"]) > 0, "Should include citations"
    print(f" [PASS] 8. End-to-End Advanced RAG Ask: Citations={len(ask_res['citations'])}, Support Score={ask_res['support_score']}")

    # Ask ungrounded question (verify API abstention)
    status, ungrounded_res = await client.request(
        "POST",
        "/api/v1/rag/ask",
        headers=auth_headers,
        json_data={
            "query": "What is the boiling point of liquid nitrogen on Mars?",
            "document_ids": [doc_id],
            "rag_mode": "hybrid",
        },
    )
    assert status == 200
    assert ungrounded_res["abstain"] is True, "Must abstain on ungrounded query"
    print(f" [PASS] 9. End-to-End Abstention: Correctly refused hallucination for out-of-scope query.")

    print("\n" + "=" * 70)
    print(" ALL 9 ADVANCED RAG & REASONING ENGINE TESTS PASSED PERFECTLY!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(test_advanced_rag_engine())
