"""
Document ingestion pipeline: file storage → text extraction → chunking.
"""
from __future__ import annotations

import io
import re
import uuid
from pathlib import Path
from typing import List, Tuple

import structlog
from app.config import get_settings

log = structlog.get_logger(__name__)
settings = get_settings()

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB
CHUNK_SIZE = 800       # characters per chunk
CHUNK_OVERLAP = 120    # character overlap

SUPPORTED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}


def detect_file_type(content_type: str, filename: str) -> str | None:
    if content_type in SUPPORTED_TYPES:
        return SUPPORTED_TYPES[content_type]
    suffix = Path(filename).suffix.lower()
    return {".pdf": "pdf", ".docx": "docx", ".txt": "txt"}.get(suffix)


async def save_uploaded_file(file_content: bytes, document_id: uuid.UUID, filename: str) -> Path:
    """Save raw file bytes to permanent storage directory."""
    doc_dir = settings.storage_dir / str(document_id)
    doc_dir.mkdir(parents=True, exist_ok=True)
    destination = doc_dir / filename
    destination.write_bytes(file_content)
    return destination


async def extract_text(content: bytes, file_type: str) -> list[dict]:
    """
    Extract text from file bytes into a list of {'text': str, 'page': int | None} sections.
    """
    if file_type == "txt":
        return [{"text": content.decode("utf-8", errors="replace"), "page": None}]
    if file_type == "pdf":
        return await _extract_pdf(content)
    if file_type == "docx":
        return await _extract_docx(content)
    return []


async def _extract_pdf(content: bytes) -> list[dict]:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        pages = []
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"text": text, "page": i})
        return pages
    except Exception as exc:
        log.warning("pdf.extract.failed", error=str(exc))
        return []


async def _extract_docx(content: bytes) -> list[dict]:
    try:
        import docx
        doc = docx.Document(io.BytesIO(content))
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return [{"text": text, "page": None}]
    except Exception as exc:
        log.warning("docx.extract.failed", error=str(exc))
        return []


def chunk_text(sections: list[dict]) -> list[dict]:
    """
    Split extracted sections into overlapping chunks with token estimates.
    """
    chunks = []
    index = 0
    for section in sections:
        raw_text = section["text"]
        normalized = re.sub(r"\s+", " ", raw_text).strip()
        page = section.get("page")
        pos = 0

        while pos < len(normalized):
            end = min(pos + CHUNK_SIZE, len(normalized))
            # Snap to sentence boundary if possible
            if end < len(normalized):
                snap = normalized.rfind(". ", pos, end)
                if snap > pos + 100:
                    end = snap + 1
            chunk_content = normalized[pos:end].strip()
            if chunk_content:
                # Estimate word count / tokens (~1.3 tokens per word)
                tokens = int(len(chunk_content.split()) * 1.3)
                chunks.append({
                    "chunk_index": index,
                    "page": page,
                    "content": chunk_content,
                    "token_count": tokens,
                })
                index += 1
            pos = max(end - CHUNK_OVERLAP, pos + 1)

    return chunks
