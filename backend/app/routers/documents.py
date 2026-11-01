"""
Documents Router: Upload, Extraction, Chunking, Ingestion Pipeline, Status, Reprocessing, and Management.
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.deps import get_current_user, get_optional_current_user
from app.db.session import get_db
from app.models.document import Document, DocumentChunk, DocumentVersion
from app.models.user import User
from app.schemas.document import (
    DocumentChunkRead,
    DocumentListResponse,
    DocumentRead,
    DocumentStatusResponse,
    DocumentUpdate,
    DocumentVersionResponse,
    ReprocessRequest,
    UploadResponse,
)
from app.services.ingestion_pipeline import ingest_document, reprocess_document

log = structlog.get_logger(__name__)
settings = get_settings()

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    collection_id: Optional[uuid.UUID] = Query(None),
    file_type: Optional[str] = Query(None),
    is_demo: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """List documents with optional filtering by collection, type, demo status, or title search."""
    stmt = select(Document)

    if current_user and current_user.role != "admin":
        stmt = stmt.where((Document.user_id == current_user.id) | (Document.is_demo.is_(True)))

    if collection_id:
        stmt = stmt.where(Document.collection_id == collection_id)
    if file_type:
        stmt = stmt.where(Document.file_type == file_type)
    if is_demo is not None:
        stmt = stmt.where(Document.is_demo == is_demo)
    if search:
        stmt = stmt.where(Document.title.ilike(f"%{search}%"))

    # Total count query
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Paged query
    paged_stmt = stmt.order_by(Document.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(paged_stmt)
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=[DocumentRead.model_validate(d) for d in documents],
        total=total,
    )


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    collection_id: Optional[uuid.UUID] = Form(None),
    chunk_size: int = Form(500),
    chunk_overlap: int = Form(100),
    is_demo: bool = Form(False),
    allow_duplicates: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Ingest a new document (PDF, DOCX, TXT, HTML) through the full ingestion pipeline:
    - Validation and SHA-256 deduplication
    - Structure-aware extraction & metadata parsing
    - Chunking with configurable chunk_size & chunk_overlap
    - Provider-independent embeddings (Mock/OpenAI)
    - Vector storage preparation
    """
    content = await file.read()
    user_id = current_user.id if current_user else None

    outcome = await ingest_document(
        file_bytes=content,
        filename=file.filename or "uploaded_document",
        content_type=file.content_type,
        user_id=user_id,
        collection_id=collection_id,
        db=db,
        title_override=title,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        is_demo=is_demo,
        allow_duplicates=allow_duplicates,
    )

    if outcome.is_duplicate:
        return UploadResponse(
            ok=False,
            is_duplicate=True,
            duplicate_of_id=outcome.duplicate_of_id,
            problem="duplicate",
            error_message=outcome.error_message,
            document=DocumentRead.model_validate(outcome.document) if outcome.document else None,
        )

    if not outcome.ok:
        return UploadResponse(
            ok=False,
            problem="failed",
            error_message=outcome.error_message,
        )

    return UploadResponse(
        ok=True,
        document=DocumentRead.model_validate(outcome.document),
    )


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve document metadata by ID."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve document processing status, progress percentage, and pipeline logs."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentStatusResponse(
        document_id=doc.id,
        title=doc.title,
        processing_status=doc.processing_status,
        processing_progress=doc.processing_progress,
        processing_error=doc.processing_error,
        processing_logs=doc.processing_logs or [],
        chunk_count=doc.chunk_count,
    )


@router.post("/{document_id}/reprocess", response_model=UploadResponse)
async def reprocess_existing_document(
    document_id: uuid.UUID,
    data: ReprocessRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Reprocess an existing document: re-extract, re-chunk with new chunk_size and chunk_overlap,
    re-embed, and re-index into vector store.
    """
    outcome = await reprocess_document(
        document_id=document_id,
        chunk_size=data.chunk_size,
        chunk_overlap=data.chunk_overlap,
        db=db,
    )

    if not outcome.ok:
        raise HTTPException(status_code=400, detail=outcome.error_message or "Reprocessing failed")

    return UploadResponse(
        ok=True,
        document=DocumentRead.model_validate(outcome.document),
    )


@router.get("/{document_id}/extracted-text")
async def get_extracted_text(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the full reconstructed extracted text grouped by page/heading."""
    doc_res = await db.execute(select(Document).where(Document.id == document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks_res = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
    )
    chunks = chunks_res.scalars().all()

    pages: dict[int, list[str]] = {}
    sections: list[dict] = []

    for c in chunks:
        p = c.page_hint or 1
        pages.setdefault(p, []).append(c.content)
        sections.append({
            "chunk_index": c.chunk_index,
            "page": c.page_hint,
            "section_heading": c.section_heading,
            "content": c.content,
            "tokens": c.token_count,
            "embedding_model": c.embedding_model,
            "is_mock_embedding": c.is_mock_embedding,
        })

    return {
        "document_id": doc.id,
        "title": doc.title,
        "total_chunks": len(chunks),
        "total_pages": doc.metadata_json.get("page_count", len(pages) or 1),
        "metadata": doc.metadata_json,
        "sections": sections,
    }


@router.put("/{document_id}/metadata", response_model=DocumentRead)
async def update_document_metadata(
    document_id: uuid.UUID,
    data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update title, collection assignment, or custom metadata."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if data.title is not None:
        doc.title = data.title
    if data.collection_id is not None:
        doc.collection_id = data.collection_id
    if data.metadata_json is not None:
        meta = dict(doc.metadata_json or {})
        meta.update(data.metadata_json)
        doc.metadata_json = meta

    await db.commit()
    await db.refresh(doc)
    return doc


@router.post("/{document_id}/versions", response_model=DocumentRead)
async def upload_new_version(
    document_id: uuid.UUID,
    file: UploadFile = File(...),
    change_summary: str = Form("Revision update"),
    db: AsyncSession = Depends(get_db),
):
    """Upload a new version/revision of an existing document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    content = await file.read()
    new_version_num = doc.current_version + 1
    doc_dir = settings.storage_dir / str(doc.id)
    doc_dir.mkdir(parents=True, exist_ok=True)
    stored_path = doc_dir / f"v{new_version_num}_{file.filename}"
    stored_path.write_bytes(content)

    # Save version record
    version = DocumentVersion(
        document_id=doc.id,
        version_number=new_version_num,
        file_name=file.filename or "",
        byte_size=len(content),
        file_path=str(stored_path),
        change_summary=change_summary,
    )
    db.add(version)

    doc.current_version = new_version_num
    doc.file_name = file.filename or doc.file_name
    doc.byte_size = len(content)
    doc.file_path = str(stored_path)
    await db.commit()

    # Re-run ingestion with the new file
    await reprocess_document(doc.id, chunk_size=doc.chunk_size, chunk_overlap=doc.chunk_overlap, db=db)

    await db.refresh(doc)
    log.info("document.version_created", doc_id=str(doc.id), version=new_version_num)
    return doc


@router.get("/{document_id}/versions", response_model=list[DocumentVersionResponse])
async def list_versions(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """List all version revisions for a document."""
    result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version_number.desc())
    )
    return list(result.scalars().all())


@router.get("/{document_id}/chunks", response_model=list[DocumentChunkRead])
async def get_chunks(
    document_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve chunk passages for a document."""
    result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{document_id}/download")
async def download_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Download the raw stored document file."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc or not doc.file_path or not Path(doc.file_path).exists():
        raise HTTPException(status_code=404, detail="Stored document file not found on server")

    return FileResponse(
        path=doc.file_path,
        filename=doc.file_name,
        media_type="application/octet-stream",
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a document, all chunks, versions, and local file storage."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove storage folder
    doc_dir = settings.storage_dir / str(document_id)
    if doc_dir.exists():
        shutil.rmtree(doc_dir, ignore_errors=True)

    await db.delete(doc)
    await db.commit()
    log.info("document.deleted", doc_id=str(document_id))
