"""
KnowledgeX AI - In-memory ASGI Integration Test Runner.
Executes end-to-end FastAPI requests through the ASGI pipeline:
- Authentication & JWT Token issuance
- User Profile updates & Role checks
- Collections CRUD
- Document Upload & Chunker extraction
- Document Metadata & Version control
- Search query & BM25 ranking
- Chat Session & Message turn with citations
- Knowledge Graph & RAG endpoints
"""
import asyncio
import json
import uuid
from io import BytesIO
from app.main import app
from app.db.session import init_db


class ASGITestClient:
    def __init__(self, asgi_app):
        self.app = asgi_app

    async def request(self, method: str, path: str, json_data=None, headers=None, form_fields=None, files=None):
        headers_list = []
        body_bytes = b""

        if headers:
            for k, v in headers.items():
                headers_list.append((k.lower().encode("latin-1"), v.encode("latin-1")))

        if files or form_fields:
            boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
            headers_list.append((b"content-type", f"multipart/form-data; boundary={boundary}".encode("latin-1")))
            stream = BytesIO()

            if form_fields:
                for k, v in form_fields.items():
                    stream.write(f"--{boundary}\r\n".encode("utf-8"))
                    stream.write(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
                    stream.write(f"{v}\r\n".encode("utf-8"))

            if files:
                for field_name, (filename, file_content, content_type) in files.items():
                    stream.write(f"--{boundary}\r\n".encode("utf-8"))
                    stream.write(
                        f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8")
                    )
                    stream.write(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
                    stream.write(file_content)
                    stream.write(b"\r\n")

            stream.write(f"--{boundary}--\r\n".encode("utf-8"))
            body_bytes = stream.getvalue()
        elif json_data is not None:
            headers_list.append((b"content-type", b"application/json"))
            body_bytes = json.dumps(json_data).encode("utf-8")

        headers_list.append((b"host", b"testserver"))
        headers_list.append((b"content-length", str(len(body_bytes)).encode("latin-1")))

        # Query string parsing
        raw_path = path.encode("latin-1")
        path_str = path
        query_bytes = b""
        if "?" in path:
            path_str, qs = path.split("?", 1)
            raw_path = path_str.encode("latin-1")
            query_bytes = qs.encode("latin-1")

        scope = {
            "type": "http",
            "http_version": "1.1",
            "method": method.upper(),
            "path": path_str,
            "raw_path": raw_path,
            "query_string": query_bytes,
            "headers": headers_list,
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
            "scheme": "http",
        }

        sent = False
        async def receive():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body_bytes, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        resp_meta = {}
        resp_body = []

        async def send(message):
            if message["type"] == "http.response.start":
                resp_meta["status"] = message["status"]
                resp_meta["headers"] = dict(message["headers"])
            elif message["type"] == "http.response.body":
                resp_body.append(message.get("body", b""))

        await self.app(scope, receive, send)
        content = b"".join(resp_body)
        status = resp_meta.get("status", 500)
        try:
            return status, json.loads(content.decode("utf-8"))
        except Exception:
            return status, content.decode("utf-8", errors="replace")


async def main():
    print("=" * 65)
    print(" KnowledgeX AI Backend - End-to-End Verification Test Suite")
    print("=" * 65)

    # Initialize tables
    await init_db()
    client = ASGITestClient(app)

    # 1. Health check
    status, res = await client.request("GET", "/api/v1/health")
    assert status == 200, f"Health check failed: {res}"
    print(f" [PASS] 1. GET /api/v1/health: {res['status']} (v{res['version']})")

    # 2. Readiness check
    status, res = await client.request("GET", "/api/v1/health/ready")
    assert status == 200, f"Readiness check failed: {res}"
    print(f" [PASS] 2. GET /api/v1/health/ready: status={res['status']}, db={res['checks'].get('database')}")

    # 3. User Registration
    test_email = f"lead_researcher_{uuid.uuid4().hex[:6]}@knowledgex.ai"
    reg_data = {
        "email": test_email,
        "password": "SuperSecretPassword123!",
        "full_name": "Dr. Eleanor Vance",
        "role": "researcher",
    }
    status, res = await client.request("POST", "/api/v1/auth/register", json_data=reg_data)
    assert status in (200, 201), f"Registration failed: {res}"
    print(f" [PASS] 3. POST /api/v1/auth/register: {res['email']} ({res['role']})")

    # 4. User Login & Token issuance
    login_data = {
        "email": test_email,
        "password": "SuperSecretPassword123!",
    }
    status, res = await client.request("POST", "/api/v1/auth/login", json_data=login_data)
    assert status == 200, f"Login failed: {res}"
    token = res["access_token"]
    assert token, "Token not returned"
    print(f" [PASS] 4. POST /api/v1/auth/login: JWT token received (type={res['token_type']})")

    auth_headers = {"Authorization": f"Bearer {token}"}

    # 5. Auth /me verification
    status, res = await client.request("GET", "/api/v1/auth/me", headers=auth_headers)
    assert status == 200, f"/me failed: {res}"
    print(f" [PASS] 5. GET /api/v1/auth/me: user={res['full_name']}, id={res['id']}")

    # 6. Profile Update
    profile_update = {
        "bio": "Lead researcher in multimodal knowledge graphs and Advanced RAG architectures.",
        "preferences": {"theme": "dark", "locale": "en", "default_top_k": 5},
    }
    status, res = await client.request("PUT", "/api/v1/users/profile", json_data=profile_update, headers=auth_headers)
    assert status == 200, f"Profile update failed: {res}"
    print(f" [PASS] 6. PUT /api/v1/users/profile: bio updated successfully")

    # 7. Collection Creation
    col_data = {
        "name": "Machine Learning & RAG Research",
        "description": "Foundational papers on dense-sparse retrieval and multi-hop graph QA.",
        "color": "#53B54F",
        "is_private": True,
    }
    status, col = await client.request("POST", "/api/v1/collections", json_data=col_data, headers=auth_headers)
    assert status in (200, 201), f"Create collection failed: {col}"
    col_id = col["id"]
    print(f" [PASS] 7. POST /api/v1/collections: '{col['name']}' (ID: {col_id})")

    # 8. List Collections
    status, col_list = await client.request("GET", "/api/v1/collections", headers=auth_headers)
    assert status == 200, f"List collections failed: {col_list}"
    assert col_list["total"] >= 1, "Expected at least 1 collection"
    print(f" [PASS] 8. GET /api/v1/collections: total={col_list['total']}")

    # 9. Document Upload
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
        "is_demo": "false",
    }
    status, upload_res = await client.request(
        "POST", "/api/v1/documents/upload", headers=auth_headers, files=files, form_fields=form_data
    )
    assert status in (200, 201), f"Document upload failed: {upload_res}"
    doc = upload_res["document"]
    doc_id = doc["id"]
    print(f" [PASS] 9. POST /api/v1/documents/upload: '{doc['title']}' (chunks={doc['chunk_count']})")

    # 10. Document Metadata Update
    meta_update = {
        "title": "RAG Architecture Overview v1.1",
        "metadata_json": {"tags": ["rag", "ai", "architecture"], "description": "Comprehensive design document"}
    }
    status, doc_updated = await client.request("PUT", f"/api/v1/documents/{doc_id}/metadata", json_data=meta_update, headers=auth_headers)
    assert status == 200, f"Update metadata failed: {doc_updated}"
    print(f" [PASS] 10. PUT /api/v1/documents/{doc_id}/metadata: updated title='{doc_updated['title']}'")

    # 11. Document Version Upload
    doc_v2 = b"""KnowledgeX AI: Advanced Retrieval-Augmented Generation Architecture v2.0
Updated with hybrid dense-sparse retrieval pipelines combining BM25 and vector embeddings.
Includes cross-encoder reranking and automated knowledge graph entity extraction."""
    v_files = {
        "file": ("rag_overview_v2.txt", doc_v2, "text/plain")
    }
    status, v_res = await client.request(
        "POST", f"/api/v1/documents/{doc_id}/versions", headers=auth_headers, files=v_files, form_fields={"change_summary": "Added hybrid retrieval section"}
    )
    assert status in (200, 201), f"Upload version failed: {v_res}"
    print(f" [PASS] 11. POST /api/v1/documents/{doc_id}/versions: created version {v_res['current_version']}")

    # 12. List Document Versions
    status, versions = await client.request("GET", f"/api/v1/documents/{doc_id}/versions", headers=auth_headers)
    assert status == 200, f"List versions failed: {versions}"
    assert len(versions) >= 2, f"Expected at least 2 versions, found {len(versions)}"
    print(f" [PASS] 12. GET /api/v1/documents/{doc_id}/versions: verified {len(versions)} versions")

    # 13. Search Query
    search_req = {
        "query": "retrieval augmented generation architecture",
        "top_k": 5,
    }
    status, search_res = await client.request("POST", "/api/v1/search/query", json_data=search_req, headers=auth_headers)
    assert status == 200, f"Search failed: {search_res}"
    print(f" [PASS] 13. POST /api/v1/search/query: hits={search_res['total_hits']}")

    # 14. Chat Session Creation
    status, chat_sess = await client.request(
        "POST", "/api/v1/chat/sessions", json_data={"title": "RAG Deep Dive Session", "collection_id": col_id}, headers=auth_headers
    )
    assert status in (200, 201), f"Create chat session failed: {chat_sess}"
    sess_id = chat_sess["id"]
    print(f" [PASS] 14. POST /api/v1/chat/sessions: '{chat_sess['title']}' (ID: {sess_id})")

    # 15. Chat Message Turn with Grounded Citations
    msg_req = {"content": "What is the role of knowledge graphs in the KnowledgeX architecture?"}
    status, turn = await client.request(
        "POST", f"/api/v1/chat/sessions/{sess_id}/messages", json_data=msg_req, headers=auth_headers
    )
    assert status == 200, f"Chat message turn failed: {turn}"
    citations = turn["assistant_message"].get("citations", [])
    print(f" [PASS] 15. POST /api/v1/chat/sessions/{sess_id}/messages: citations={len(citations)}")
    print(f"       Response excerpt: {turn['assistant_message']['content'][:100]}...")

    # 16. Knowledge Graph Generation
    status, graph = await client.request("GET", "/api/v1/knowledge/graph", headers=auth_headers)
    assert status == 200, f"Knowledge graph failed: {graph}"
    print(f" [PASS] 16. GET /api/v1/knowledge/graph: nodes={len(graph['nodes'])}, edges={len(graph['edges'])}")

    # 17. RAG Ask Endpoint
    rag_req = {"query": "Explain hybrid dense-sparse retrieval pipelines."}
    status, rag_resp = await client.request("POST", "/api/v1/rag/ask", json_data=rag_req, headers=auth_headers)
    assert status == 200, f"RAG ask failed: {rag_resp}"
    print(f" [PASS] 17. POST /api/v1/rag/ask: answer received ({len(rag_resp['citations'])} citations)")

    # 18. RAG Summarize Endpoint
    status, summary_resp = await client.request("POST", "/api/v1/rag/summarize", json_data={"document_id": doc_id}, headers=auth_headers)
    assert status == 200, f"RAG summarize failed: {summary_resp}"
    print(f" [PASS] 18. POST /api/v1/rag/summarize: summary generated successfully")

    print("\n" + "=" * 65)
    print(" ALL 18 END-TO-END BACKEND INTEGRATION TESTS PASSED PERFECTLY!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
