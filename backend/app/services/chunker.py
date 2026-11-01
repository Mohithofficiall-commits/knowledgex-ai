"""
Structure-aware text chunking service for KnowledgeX AI.
Splits document sections with configurable chunk size and overlap while respecting
sentence boundaries, paragraph breaks, and section headings.
"""
from __future__ import annotations

import re
from typing import List, Optional
from pydantic import BaseModel

from app.services.document_extractor import ExtractedSection


class ProcessedChunk(BaseModel):
    chunk_index: int
    content: str
    token_count: int
    page_hint: Optional[int] = None
    section_heading: Optional[str] = None


def chunk_sections(
    sections: List[ExtractedSection],
    chunk_size: int = 500,
    chunk_overlap: int = 100,
) -> List[ProcessedChunk]:
    """
    Split extracted structured sections into chunks with overlap.
    Preserves section headings, page numbers, and snaps to sentence boundaries.
    """
    if chunk_size < 100:
        chunk_size = 100
    if chunk_overlap >= chunk_size:
        chunk_overlap = chunk_size // 4

    chunks: List[ProcessedChunk] = []
    chunk_index = 0

    for sec in sections:
        raw = sec.text.strip()
        if not raw:
            continue

        # Normalize redundant spaces while keeping sentences
        normalized = re.sub(r"[ \t]+", " ", raw).strip()
        page = sec.page
        heading = sec.section_heading
        pos = 0
        total_len = len(normalized)

        while pos < total_len:
            end = min(pos + chunk_size, total_len)

            # Snap to sentence boundary (., !, ?, \n)
            if end < total_len:
                best_snap = -1
                for punct in (". ", ".\n", "! ", "? ", "\n\n", "; "):
                    candidate = normalized.rfind(punct, pos + chunk_size // 2, end)
                    if candidate > best_snap:
                        best_snap = candidate + len(punct)

                if best_snap != -1:
                    end = best_snap
                else:
                    # Space snap
                    space_snap = normalized.rfind(" ", pos + chunk_size // 2, end)
                    if space_snap != -1:
                        end = space_snap + 1

            chunk_text = normalized[pos:end].strip()
            if chunk_text:
                # Token count estimate (~1.3 tokens per word)
                words = len(chunk_text.split())
                tokens = max(1, int(words * 1.3))

                chunks.append(
                    ProcessedChunk(
                        chunk_index=chunk_index,
                        content=chunk_text,
                        token_count=tokens,
                        page_hint=page,
                        section_heading=heading,
                    )
                )
                chunk_index += 1

            # If we reached the end of this section, stop
            if end >= total_len:
                break

            # Advance by step respecting overlap
            step = max(end - chunk_overlap, pos + 1)
            pos = step

    return chunks
