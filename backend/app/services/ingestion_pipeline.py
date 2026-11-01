"""
Complete Document Ingestion Pipeline for KnowledgeX AI.
Orchestrates file validation, content deduplication, multi-format text & metadata extraction,
structure-aware chunking, provider-independent embedding, and vector storage.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import structlog
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.config import get_settings
from app.models.document import Document, DocumentChunk, DocumentVersion
from app.services.chunker import chunk_sections, ProcessedChunk
from app.services.document_extractor import (
    ExtractionResult,
    extract_document,
    validate_file,
)
from app.services.embeddings import get_embedding_provider
from app.services.vector_store import sync_vectors_to_qdrant

log = structlog.get_logger(__name__)
settings = get_settings()


class IngestionOutcome:
    def __init__(
        self,
        ok: bool,
        document: Optional[Document] = None,
        is_duplicate: bool = False,
        duplicate_of_id: Optional[uuid.UUID] = None,
        error_message: Optional[str] = None,
    ):
        self.ok = ok
        self.document = document
        self.is_duplicate = is_duplicate
        self.duplicate_of_id = duplicate_of_id
        self.error_message = error_message


def _add_log(logs: List[Dict[str, Any]], stage: str, message: str, level: str = "info") -> None:
    logs.append({
        "stage": stage,
        "level": level,
        "timestamp": datetime.utcnow().isoformat(),
        "message": message,
    })


async def ingest_document(
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str],
    user_id: Optional[uuid.UUID],
    collection_id: Optional[uuid.UUID],
    db: AsyncSession,
    title_override: Optional[str] = None,
    chunk_size: int = 500,
    chunk_overlap: int = 100,
    is_demo: bool = False,
    allow_duplicates: bool = False,
) -> IngestionOutcome:
    """
    Executes the full document ingestion pipeline.
    """
    logs: List[Dict[str, Any]] = []

    # ── Stage 1: Validation ──────────────────────────────────────────
    is_valid, type_or_err, mime = validate_file(file_bytes, filename, content_type)
    if not is_valid:
        return IngestionOutcome(ok=False, error_message=type_or_err)

    file_type = type_or_err
    mime_type = mime or "application/octet-stream"
    content_hash = hashlib.sha256(file_bytes).hexdigest()

    _add_log(
        logs,
        "validation",
        f"File '{filename}' passed format and magic-byte checks. Type: {file_type.upper()}, Size: {len(file_bytes):,} bytes.",
    )

    # ── Stage 2: Duplicate Detection ─────────────────────────────────
    stmt = select(Document).where(Document.content_hash == content_hash)
    if user_id:
        stmt = stmt.where(Document.user_id == user_id)
    dup_res = await db.execute(stmt)
    existing_dup = dup_res.scalars().first()

    if existing_dup and not allow_duplicates:
        _add_log(logs, "duplicate_check", f"Duplicate content detected! Matches document ID: {existing_dup.id}", "warning")
        return IngestionOutcome(
            ok=False,
            is_duplicate=True,
            duplicate_of_id=existing_dup.id,
            document=existing_dup,
            error_message=f"Duplicate document detected: exactly matches '{existing_dup.title}' (ID: {existing_dup.id})",
        )

    # ── Stage 3: Initial Database Record & Disk Storage ──────────────
    doc_id = uuid.uuid4()
    doc_dir = settings.storage_dir / str(doc_id)
    doc_dir.mkdir(parents=True, exist_ok=True)
    stored_path = doc_dir / f"v1_{Path(filename).name}"
    stored_path.write_bytes(file_bytes)

    doc = Document(
        id=doc_id,
        user_id=user_id,
        collection_id=collection_id,
        title=title_override or Path(filename).stem.replace("_", " ").title(),
        file_name=filename,
        file_type=file_type,
        byte_size=len(file_bytes),
        chunk_count=0,
        current_version=1,
        file_path=str(stored_path),
        is_demo=is_demo,
        content_hash=content_hash,
        processing_status="extracting",
        processing_progress=20,
        processing_logs=logs,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        metadata_json={
            "mime_type": mime_type,
            "original_filename": filename,
            "uploaded_at": datetime.utcnow().isoformat(),
        },
    )
    db.add(doc)

    # Add initial version 1 record
    ver = DocumentVersion(
        document_id=doc.id,
        version_number=1,
        file_name=filename,
        byte_size=len(file_bytes),
        file_path=str(stored_path),
        change_summary="Initial document ingestion",
    )
    db.add(ver)
    await db.flush()

    try:
        # ── Stage 4: Extraction ───────────────────────────────────────
        ext_result = await extract_document(file_bytes, filename, file_type, mime_type)
        logs.extend(ext_result.logs)

        # Update metadata if not overridden
        if not title_override and ext_result.metadata.title:
            doc.title = ext_result.metadata.title

        doc.metadata_json.update({
            "author": ext_result.metadata.author,
            "created_date": ext_result.metadata.created_date,
            "page_count": ext_result.metadata.page_count,
            "word_count": ext_result.metadata.word_count,
            "char_count": ext_result.metadata.char_count,
            "ocr_notice": ext_result.metadata.ocr_notice,
        })
        doc.processing_status = "chunking"
        doc.processing_progress = 45
        _add_log(logs, "extraction", f"Text extraction complete. Extracted {len(ext_result.sections)} sections.")
        await db.flush()

        # ── Stage 5: Structure-Aware Chunking ─────────────────────────
        chunks: List[ProcessedChunk] = chunk_sections(
            ext_result.sections,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        if not chunks:
            raise ValueError("No extractable text found in document.")

        doc.chunk_count = len(chunks)
        doc.processing_status = "embedding"
        doc.processing_progress = 70
        _add_log(
            logs,
            "chunking",
            f"Created {len(chunks)} structure-aware chunks (size: {chunk_size}, overlap: {chunk_overlap}).",
        )
        await db.flush()

        # ── Stage 6: Embedding Generation ─────────────────────────────
        provider = get_embedding_provider()
        _add_log(
            logs,
            "embedding",
            f"Generating embeddings via '{provider.provider_name}' (model: {provider.model_name}, dim: {provider.dimension}, mock: {provider.is_mock}).",
        )
        texts_to_embed = [c.content for c in chunks]
        embeddings = await provider.embed_texts(texts_to_embed)

        doc.processing_status = "indexing"
        doc.processing_progress = 90
        await db.flush()

        # ── Stage 7: Vector Storage & Database Chunks ─────────────────
        for chunk, emb in zip(chunks, embeddings):
            db_chunk = DocumentChunk(
                document_id=doc.id,
                chunk_index=chunk.chunk_index,
                page_hint=chunk.page_hint,
                section_heading=chunk.section_heading,
                content=chunk.content,
                token_count=chunk.token_count,
                embedding_model=emb.model_name,
                is_mock_embedding=emb.is_mock,
                embedding_vector=emb.vector[:32],  # Keep vector sample/summary for portable inspection
            )
            db.add(db_chunk)

        # Upsert to Qdrant
        vector_outcome = await sync_vectors_to_qdrant(
            document_id=doc.id,
            chunks=chunks,
            embeddings=embeddings,
            document_metadata=doc.metadata_json,
        )
        _add_log(logs, "indexing", vector_outcome.message)
        _add_log(logs, "completed", "Document ingestion pipeline finished successfully!")

        # ── Stage 8: Pipeline Completion ──────────────────────────────
        doc.processing_status = "completed"
        doc.processing_progress = 100
        doc.processing_logs = list(logs)
        flag_modified(doc, "processing_logs")
        flag_modified(doc, "metadata_json")

        await db.commit()
        await db.refresh(doc)
        log.info("ingestion.success", doc_id=str(doc.id), chunks=len(chunks), title=doc.title)
        return IngestionOutcome(ok=True, document=doc)

    except Exception as exc:
        await db.rollback()
        err_msg = str(exc)
        log.error("ingestion.failed", doc_id=str(doc.id), error=err_msg)
        _add_log(logs, "error", f"Pipeline error: {err_msg}", "error")

        doc.processing_status = "failed"
        doc.processing_progress = 100
        doc.processing_error = err_msg
        doc.processing_logs = logs
        db.add(doc)
        await db.commit()
        return IngestionOutcome(ok=False, document=doc, error_message=err_msg)


async def reprocess_document(
    document_id: uuid.UUID,
    chunk_size: int,
    chunk_overlap: int,
    db: AsyncSession,
) -> IngestionOutcome:
    """
    Reprocess an existing document: re-extract, re-chunk with new params, re-embed, and re-index.
    Uses the original file stored permanently on disk.
    """
    stmt = select(Document).where(Document.id == document_id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        return IngestionOutcome(ok=False, error_message="Document not found.")

    if not doc.file_path or not Path(doc.file_path).exists():
        return IngestionOutcome(ok=False, error_message="Original file not found on disk.")

    file_bytes = Path(doc.file_path).read_bytes()
    logs = list(doc.processing_logs or [])
    _add_log(
        logs,
        "reprocessing",
        f"Reprocessing requested with new chunk_size={chunk_size}, chunk_overlap={chunk_overlap}.",
    )

    doc.processing_status = "extracting"
    doc.processing_progress = 20
    doc.chunk_size = chunk_size
    doc.chunk_overlap = chunk_overlap
    doc.processing_logs = logs
    await db.flush()

    try:
        # Re-extract
        ext_result = await extract_document(
            file_bytes, doc.file_name, doc.file_type, doc.metadata_json.get("mime_type", "application/octet-stream")
        )
        logs.extend(ext_result.logs)

        # Delete previous chunks
        await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))

        # Re-chunk
        doc.processing_status = "chunking"
        doc.processing_progress = 45
        chunks = chunk_sections(ext_result.sections, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        doc.chunk_count = len(chunks)
        await db.flush()

        # Re-embed
        doc.processing_status = "embedding"
        doc.processing_progress = 70
        provider = get_embedding_provider()
        embeddings = await provider.embed_texts([c.content for c in chunks])
        await db.flush()

        # Re-index
        doc.processing_status = "indexing"
        doc.processing_progress = 90
        for chunk, emb in zip(chunks, embeddings):
            db_chunk = DocumentChunk(
                document_id=doc.id,
                chunk_index=chunk.chunk_index,
                page_hint=chunk.page_hint,
                section_heading=chunk.section_heading,
                content=chunk.content,
                token_count=chunk.token_count,
                embedding_model=emb.model_name,
                is_mock_embedding=emb.is_mock,
                embedding_vector=emb.vector[:32],
            )
            db.add(db_chunk)

        vector_outcome = await sync_vectors_to_qdrant(
            document_id=doc.id,
            chunks=chunks,
            embeddings=embeddings,
            document_metadata=doc.metadata_json,
        )
        _add_log(logs, "indexing", vector_outcome.message)
        _add_log(logs, "reprocessing_complete", f"Reprocessing completed with {len(chunks)} chunks.")

        doc.processing_status = "completed"
        doc.processing_progress = 100
        doc.processing_logs = list(logs)
        flag_modified(doc, "processing_logs")

        await db.commit()
        await db.refresh(doc)
        return IngestionOutcome(ok=True, document=doc)
    except Exception as exc:
        await db.rollback()
        err_msg = str(exc)
        _add_log(logs, "error", f"Reprocessing error: {err_msg}", "error")
        doc.processing_status = "failed"
        doc.processing_error = err_msg
        doc.processing_logs = logs
        db.add(doc)
        await db.commit()
        return IngestionOutcome(ok=False, document=doc, error_message=err_msg)
