# KnowledgeX AI – Backend Service

The modular Python FastAPI backend powering **KnowledgeX AI**, a Personal Knowledge Intelligence Platform with normalized PostgreSQL / SQLite persistence, document ingestion, chunking, version control, full-text search, chat session history, and RAG preparation.

---

## Architecture Overview

```
backend/
├── alembic/                  # Database migration scripts & async environment
│   └── versions/             # Migration revisions
├── app/
│   ├── config.py             # Pydantic BaseSettings (dual PostgreSQL + SQLite async)
│   ├── main.py               # FastAPI entry point, CORS, routers & exception handlers
│   ├── core/
│   │   ├── deps.py           # Dependency injection (current user, RBAC role guard)
│   │   └── security.py       # Direct bcrypt password hashing & PyJWT token handling
│   ├── db/
│   │   ├── postgres.py       # Re-exports for engine/session
│   │   ├── qdrant.py         # Async Qdrant vector store client (for future RAG)
│   │   └── session.py        # Async SQLAlchemy engine, session maker & Base model
│   ├── models/               # Normalized SQLAlchemy ORM models with relations & indexes
│   │   ├── user.py           # User & UserProfile
│   │   ├── collection.py     # Collection
│   │   ├── document.py       # Document, DocumentVersion, DocumentChunk
│   │   ├── chat.py           # ChatSession, ChatMessage
│   │   └── knowledge.py      # SearchHistory, KnowledgeNode, KnowledgeEdge
│   ├── schemas/              # Pydantic v2 validation models
│   ├── services/
│   │   ├── document_processor.py # Storage, PDF/DOCX/TXT extraction & chunking
│   │   └── search_service.py     # Lexical BM25 search & citation generator
│   └── routers/              # 26 REST API endpoints
│       ├── health.py         # /health, /health/ready
│       ├── auth.py           # /auth/register, /auth/login, /auth/me
│       ├── users.py          # /users/profile, /users (admin RBAC)
│       ├── collections.py    # /collections CRUD & document assignment
│       ├── documents.py      # /documents upload, versions, chunks, download, delete
│       ├── chat.py           # /chat/sessions, messages with citations
│       ├── search.py         # /search/query
│       ├── rag.py            # /rag/ask, /rag/summarize, /rag/compare
│       └── knowledge.py      # /knowledge/graph, /knowledge/stats
├── data/                     # Local SQLite database (knowledgex.db)
├── storage/documents/        # Ingested file revisions
├── tests/
│   ├── run_asgi_tests.py     # End-to-end 18-step ASGI integration test suite
│   └── test_api_integration.py # Standalone integration tests
├── Dockerfile                # Multi-stage production container
└── requirements.txt          # Python dependencies
```

---

## Quickstart

### 1. Prerequisites
- Python 3.11+
- Virtual environment tool (`venv`)

### 2. Setup & Virtual Environment
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Database Migrations
KnowledgeX defaults to a zero-configuration SQLite database (`data/knowledgex.db`), or connects to PostgreSQL if configured:
```bash
alembic upgrade head
```

### 4. Run the Development Server
```bash
uvicorn app.main:app --port 8000 --host 0.0.0.0 --reload
```
- API Docs (Swagger): [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- OpenAPI Specification: [http://localhost:8000/api/openapi.json](http://localhost:8000/api/openapi.json)
- Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 5. Run Verification Tests
```bash
PYTHONPATH=. python tests/run_asgi_tests.py
```

---

## Production Docker Deployment

Run all services (FastAPI, PostgreSQL 16, Qdrant) via Docker Compose:
```bash
docker compose up -d
```
