"""
Integration test suite for KnowledgeX AI backend endpoints.
Uses only standard library (urllib.request, json) to run anywhere without extra dependencies.
"""
import io
import json
import mimetypes
import sys
import uuid
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"

def make_request(method, path, body=None, headers=None, files=None, form_data=None):
    url = f"{BASE_URL}{path}"
    req_headers = headers.copy() if headers else {}
    data = None

    if files:
        boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
        req_headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        body_stream = io.BytesIO()

        if form_data:
            for k, v in form_data.items():
                body_stream.write(f"--{boundary}\r\n".encode("utf-8"))
                body_stream.write(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
                body_stream.write(f"{v}\r\n".encode("utf-8"))

        for field_name, (filename, file_bytes, content_type) in files.items():
            body_stream.write(f"--{boundary}\r\n".encode("utf-8"))
            body_stream.write(
                f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8")
            )
            body_stream.write(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
            body_stream.write(file_bytes)
            body_stream.write(b"\r\n")

        body_stream.write(f"--{boundary}--\r\n".encode("utf-8"))
        data = body_stream.getvalue()
    elif body is not None:
        req_headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            content_type = resp.headers.get("Content-Type", "")
            return resp.status, json.loads(resp_body) if "application/json" in content_type else resp_body
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = err_body
        return e.code, parsed


def run_tests():
    print(f"=== KnowledgeX AI Backend Verification against {BASE_URL} ===")

    # 1. Health check
    status, health = make_request("GET", "/api/v1/health")
    assert status == 200, f"Health check failed ({status}): {health}"
    print(" [PASS] 1. Health check:", health)

    status, ready = make_request("GET", "/api/v1/health/ready")
    assert status == 200, f"Readiness check failed ({status}): {ready}"
    print(" [PASS] 2. Readiness check:", ready)

    # 2. Registration
    test_email = f"researcher_{uuid.uuid4().hex[:6]}@knowledgex.ai"
    test_password = "SecurePassword123!"
    reg_payload = {
        "email": test_email,
        "password": test_password,
        "full_name": "Dr. Eleanor Vance",
        "role": "researcher"
    }
    status, res = make_request("POST", "/api/v1/auth/register", body=reg_payload)
    assert status in (200, 201), f"Registration failed ({status}): {res}"
    print(" [PASS] 3. Registration succeeded for:", res["email"])

    # 3. Login
    login_payload = {
        "email": test_email,
        "password": test_password
    }
    status, token_data = make_request("POST", "/api/v1/auth/login", body=login_payload)
    assert status == 200, f"Login failed ({status}): {token_data}"
    access_token = token_data["access_token"]
    assert access_token, "No access token in response"
    print(" [PASS] 4. Login succeeded. JWT token acquired.")

    headers = {"Authorization": f"Bearer {access_token}"}

    # 4. Auth Me
    status, user = make_request("GET", "/api/v1/auth/me", headers=headers)
    assert status == 200, f"/auth/me failed ({status}): {user}"
    print(f" [PASS] 5. Auth /me verified for: {user['full_name']} ({user['role']})")

    # 5. Profile Update
    status, prof = make_request(
        "PUT",
        "/api/v1/users/profile",
        body={"bio": "Lead researcher in multimodal knowledge graphs and RAG systems.", "preferences": {"theme": "dark", "locale": "en"}},
        headers=headers
    )
    assert status == 200, f"Profile update failed ({status}): {prof}"
    print(" [PASS] 6. Profile updated:", prof.get("bio"))

    # 6. Collections CRUD
    col_payload = {
        "name": "Machine Learning Research",
        "description": "Foundational papers on transformer models and retrieval.",
        "color": "#53B54F",
        "is_private": True
    }
    status, collection = make_request("POST", "/api/v1/collections", body=col_payload, headers=headers)
    assert status in (200, 201), f"Create collection failed ({status}): {collection}"
    col_id = collection["id"]
    print(f" [PASS] 7. Collection created: {collection['name']} (ID: {col_id})")

    status, cols = make_request("GET", "/api/v1/collections", headers=headers)
    assert status == 200, f"List collections failed ({status}): {cols}"
    assert cols["total"] >= 1, "Expected at least 1 collection"
    print(f" [PASS] 8. Listed collections. Total: {cols['total']}")

    # 7. Document Upload
    doc_content = b"""KnowledgeX AI: Advanced Retrieval-Augmented Generation Architecture
Retrieval-Augmented Generation (RAG) blends neural information retrieval with autoregressive language generation.
By indexing source documents into vector representations and lexical indices, the system retrieves relevant chunks.
Knowledge graphs further capture entity-relationship topologies to bridge multi-hop reasoning gaps.
This architecture guarantees grounded factual accuracy with verifiable citations."""
    files = {
        "file": ("rag_overview.txt", doc_content, "text/plain")
    }
    form_data = {
        "title": "RAG Architecture Overview",
        "collection_id": col_id,
        "is_demo": "false"
    }
    status, doc = make_request("POST", "/api/v1/documents/upload", headers=headers, files=files, form_data=form_data)
    assert status in (200, 201), f"Document upload failed ({status}): {doc}"
    doc_id = doc["id"]
    print(f" [PASS] 9. Document uploaded: {doc['title']} (ID: {doc_id}, chunks: {doc['chunk_count']})")

    # 8. Document Metadata Update
    status, updated_doc = make_request("PUT", f"/api/v1/documents/{doc_id}/metadata", body={"title": "RAG Architecture Overview v1.1", "tags": ["rag", "ai", "architecture"]}, headers=headers)
    assert status == 200, f"Update metadata failed ({status}): {updated_doc}"
    print(" [PASS] 10. Document metadata updated:", updated_doc["title"])

    # 9. Document Version Upload
    doc_v2 = b"""KnowledgeX AI: Advanced Retrieval-Augmented Generation Architecture v2.0
Updated with hybrid dense-sparse retrieval pipelines combining BM25 and vector embeddings.
Includes reranking via cross-encoders and automated graph extraction."""
    v_files = {
        "file": ("rag_overview_v2.txt", doc_v2, "text/plain")
    }
    status, v_data = make_request("POST", f"/api/v1/documents/{doc_id}/versions", headers=headers, files=v_files, form_data={"change_summary": "Added hybrid dense-sparse retrieval section."})
    assert status in (200, 201), f"Upload version failed ({status}): {v_data}"
    print(f" [PASS] 11. New document version created. Version number: {v_data['version_number']}")

    # 10. Document Versions List
    status, versions = make_request("GET", f"/api/v1/documents/{doc_id}/versions", headers=headers)
    assert status == 200, f"List versions failed ({status}): {versions}"
    assert len(versions) >= 2, f"Expected at least 2 versions, found {len(versions)}"
    print(f" [PASS] 12. Document versions verified. Count: {len(versions)}")

    # 11. Search Query
    search_payload = {
        "query": "retrieval augmented generation architecture",
        "top_k": 5
    }
    status, search_results = make_request("POST", "/api/v1/search/query", body=search_payload, headers=headers)
    assert status == 200, f"Search query failed ({status}): {search_results}"
    print(f" [PASS] 13. Search query returned hits: {search_results['total_hits']}")

    # 12. Chat Session & Message
    status, session = make_request("POST", "/api/v1/chat/sessions", body={"title": "RAG Deep Dive Session", "collection_id": col_id}, headers=headers)
    assert status in (200, 201), f"Create chat session failed ({status}): {session}"
    session_id = session["id"]
    print(f" [PASS] 14. Chat session created: {session['title']} (ID: {session_id})")

    status, turn = make_request(
        "POST",
        f"/api/v1/chat/sessions/{session_id}/messages",
        body={"content": "What is the role of knowledge graphs in the KnowledgeX architecture?"},
        headers=headers
    )
    assert status == 200, f"Send chat message failed ({status}): {turn}"
    citations = turn["assistant_message"].get("citations", [])
    print(f" [PASS] 15. Chat message responded with citations: {len(citations)}")
    print(f"      Assistant excerpt: {turn['assistant_message']['content'][:120]} ...")

    # 13. Knowledge Graph
    status, graph = make_request("GET", "/api/v1/knowledge/graph", headers=headers)
    assert status == 200, f"Knowledge graph failed ({status}): {graph}"
    print(f" [PASS] 16. Knowledge graph verified. Nodes: {len(graph['nodes'])}, Edges: {len(graph['edges'])}")

    # 14. RAG Ask endpoint
    status, rag_resp = make_request("POST", "/api/v1/rag/ask", body={"query": "Explain hybrid dense-sparse retrieval."}, headers=headers)
    assert status == 200, f"RAG ask failed ({status}): {rag_resp}"
    print(f" [PASS] 17. RAG Ask endpoint verified. Answer excerpt: {rag_resp['answer'][:100]} ...")

    print("\n ALL 17 API INTEGRATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n[FAIL] Test failure: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
