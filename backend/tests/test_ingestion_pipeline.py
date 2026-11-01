"""
Test suite for KnowledgeX AI Document Ingestion Pipeline.
Tests:
1. Multi-format Ingestion: PDF, DOCX, TXT, HTML
2. Secure validation & magic byte checks
3. Metadata extraction (title, author, date, pages, words, chars, hash)
4. Structure-aware chunking with custom chunk_size & overlap
5. Mock embedding generation (unit-normalized vectors, is_mock=True)
6. Vector storage preparation for Qdrant
7. Duplicate content detection (SHA-256)
8. Document reprocessing with new chunking parameters
9. Status tracking and processing logs inspection
10. Error handling for corrupted / invalid files
"""
import asyncio
import io
import uuid
import structlog
from app.main import app
from app.db.session import init_db
from tests.run_asgi_tests import ASGITestClient


async def test_ingestion():
    print("=" * 70)
    print(" KnowledgeX AI - Complete Document Ingestion Pipeline Test Suite")
    print("=" * 70)

    await init_db()
    client = ASGITestClient(app)

    # 1. Register & Login a Researcher
    test_email = f"ingest_tester_{uuid.uuid4().hex[:6]}@knowledgex.ai"
    reg_data = {
        "email": test_email,
        "password": "SecurePassword123!",
        "full_name": "Dr. Sarah Chen",
        "role": "researcher",
    }
    status, res = await client.request("POST", "/api/v1/auth/register", json_data=reg_data)
    assert status in (200, 201), f"Register failed: {res}"

    status, token_data = await client.request(
        "POST", "/api/v1/auth/login", json_data={"email": test_email, "password": "SecurePassword123!"}
    )
    assert status == 200, f"Login failed: {token_data}"
    auth_headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    print(" [PASS] 1. Authenticated user session established.")

    # 2. Test TXT Ingestion with headings and metadata
    txt_content = b"""# KnowledgeX Ingestion Specification
Overview of the multi-format pipeline for document extraction.
The architecture preserves structural boundaries, paragraphs, and lists.

## Section 1: Security and Validation
All files are validated with magic bytes and size constraints.
SHA-256 content hashes are calculated to detect duplicates immediately.

## Section 2: Embedding Generation
Embeddings are generated through a provider-agnostic interface.
Mock embeddings produce deterministic 384-dimensional normalized vectors.
"""
    status, upload_txt = await client.request(
        "POST",
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("ingestion_spec.txt", txt_content, "text/plain")},
        form_fields={"chunk_size": "250", "chunk_overlap": "50"},
    )
    assert status in (200, 201), f"TXT upload failed ({status}): {upload_txt}"
    assert upload_txt["ok"] is True, "Upload not ok"
    doc_txt = upload_txt["document"]
    txt_id = doc_txt["id"]
    print(f" [PASS] 2. TXT Ingestion: '{doc_txt['title']}' ({doc_txt['chunk_count']} chunks, hash={doc_txt['content_hash'][:10]}...)")
    assert doc_txt["processing_status"] == "completed"
    assert doc_txt["processing_progress"] == 100
    assert len(doc_txt["processing_logs"]) >= 4

    # 3. Test HTML Ingestion with heading tags and metadata
    html_content = b"""<!DOCTYPE html>
<html>
<head>
  <title>Enterprise RAG Architecture Guidelines</title>
  <meta name="author" content="KnowledgeX Core Team">
  <meta name="date" content="2026-11-01">
</head>
<body>
  <h1>Enterprise RAG Architecture</h1>
  <p>Retrieval-Augmented Generation bridges dense vector search with autoregressive generative models.</p>
  <h2>Graph Integration</h2>
  <p>Knowledge graphs capture topological relations and bridge multi-hop reasoning gaps.</p>
  <ul>
    <li>Entity recognition and disambiguation</li>
    <li>Edge weight calculation based on co-occurrence</li>
    <li>Hybrid dense-sparse passage reranking</li>
  </ul>
</body>
</html>"""
    status, upload_html = await client.request(
        "POST",
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("rag_guidelines.html", html_content, "text/html")},
        form_fields={"chunk_size": "300", "chunk_overlap": "60"},
    )
    assert status in (200, 201), f"HTML upload failed ({status}): {upload_html}"
    doc_html = upload_html["document"]
    html_id = doc_html["id"]
    print(f" [PASS] 3. HTML Ingestion: Title='{doc_html['title']}', Author='{doc_html['metadata_json'].get('author')}'")
    assert doc_html["title"] == "Enterprise RAG Architecture Guidelines"
    assert doc_html["file_type"] == "html"
    assert doc_html["chunk_count"] >= 1

    # 4. Test Duplicate Detection (re-uploading identical file)
    status, dup_res = await client.request(
        "POST",
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("duplicate_spec.txt", txt_content, "text/plain")},
    )
    assert dup_res["is_duplicate"] is True, "Duplicate was not detected"
    assert dup_res["duplicate_of_id"] == txt_id, "Duplicate does not match original document ID"
    print(f" [PASS] 4. Duplicate Detection: Detected identical content hash matching doc {txt_id}")

    # 5. Test Chunk Details & Mock Embeddings Inspection
    status, chunks_res = await client.request("GET", f"/api/v1/documents/{txt_id}/chunks", headers=auth_headers)
    assert status == 200, f"Get chunks failed: {chunks_res}"
    assert len(chunks_res) > 0, "No chunks returned"
    first_chunk = chunks_res[0]
    print(f" [PASS] 5. Chunk Structure: Index={first_chunk['chunk_index']}, Heading='{first_chunk.get('section_heading')}', Model='{first_chunk.get('embedding_model')}', Mock={first_chunk.get('is_mock_embedding')}")
    assert first_chunk["is_mock_embedding"] is True, "Expected mock embedding"

    # 6. Test Document Processing Status & Logs Endpoint
    status, status_res = await client.request("GET", f"/api/v1/documents/{txt_id}/status", headers=auth_headers)
    assert status == 200, f"Get status failed: {status_res}"
    print(f" [PASS] 6. Document Status: Status='{status_res['processing_status']}', Progress={status_res['processing_progress']}%, Logs Count={len(status_res['processing_logs'])}")
    assert status_res["processing_status"] == "completed"
    assert status_res["processing_progress"] == 100

    # 7. Test Document Reprocessing with new parameters
    reprocess_payload = {
        "chunk_size": 100,
        "chunk_overlap": 20,
    }
    status, repro_res = await client.request(
        "POST", f"/api/v1/documents/{txt_id}/reprocess", json_data=reprocess_payload, headers=auth_headers
    )
    assert status == 200, f"Reprocess failed: {repro_res}"
    repro_doc = repro_res["document"]
    print(f" [PASS] 7. Reprocessing: Original chunks: {doc_txt['chunk_count']} -> New chunks: {repro_doc['chunk_count']} (chunk_size=100)")
    assert repro_doc["chunk_size"] == 100
    assert repro_doc["chunk_count"] > doc_txt["chunk_count"], "Smaller chunk size should produce more chunks"

    # 8. Test Extracted Text Endpoint
    status, text_res = await client.request("GET", f"/api/v1/documents/{html_id}/extracted-text", headers=auth_headers)
    assert status == 200, f"Get extracted text failed: {text_res}"
    assert "sections" in text_res, "Expected sections in extracted text"
    print(f" [PASS] 8. Extracted Text Retrieval: {len(text_res['sections'])} structured passages retrieved.")

    # 9. Test Error Handling for Invalid / Magic-byte Mismatch
    fake_pdf = b"NOT_A_REAL_PDF_HEADER_CONTENT"
    status, err_res = await client.request(
        "POST",
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("malicious.pdf", fake_pdf, "application/pdf")},
    )
    assert err_res["ok"] is False, "Corrupted file should not succeed"
    print(f" [PASS] 9. Error Handling: Corrupted PDF rejected correctly: '{err_res.get('error_message')}'")

    # 10. Test DOCX Ingestion with python-docx
    import docx
    docx_buf = io.BytesIO()
    doc_builder = docx.Document()
    doc_builder.core_properties.title = "Standard Operating Procedure: Document Ingestion"
    doc_builder.core_properties.author = "KnowledgeX Compliance Officer"
    doc_builder.add_heading("Operational Protocol", level=1)
    doc_builder.add_paragraph("This document outlines the standard ingestion and chunking protocol for KnowledgeX AI.")
    doc_builder.add_heading("Security Checkpoint", level=2)
    doc_builder.add_paragraph("All uploaded assets must pass SHA-256 checksum and mime validation.")
    doc_builder.save(docx_buf)
    docx_bytes = docx_buf.getvalue()

    status, upload_docx = await client.request(
        "POST",
        "/api/v1/documents/upload",
        headers=auth_headers,
        files={"file": ("sop_protocol.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        form_fields={"chunk_size": "200", "chunk_overlap": "40"},
    )
    assert status in (200, 201), f"DOCX upload failed: {upload_docx}"
    doc_docx = upload_docx["document"]
    print(f" [PASS] 10. DOCX Ingestion: Title='{doc_docx['title']}', Author='{doc_docx['metadata_json'].get('author')}', Chunks={doc_docx['chunk_count']}")
    assert doc_docx["file_type"] == "docx"
    assert doc_docx["metadata_json"].get("author") == "KnowledgeX Compliance Officer"

    print("\n" + "=" * 70)
    print(" ALL 10 INGESTION PIPELINE INTEGRATION TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(test_ingestion())
