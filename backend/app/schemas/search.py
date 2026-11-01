"""Pydantic schemas for Search and Document Retrieval API."""
from __future__ import annotations
import uuid
from typing import Optional, List
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    collection_id: Optional[uuid.UUID] = None
    document_ids: Optional[List[uuid.UUID]] = None
    limit: int = Field(default=10, ge=1, le=50)


class SearchHit(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    chunk_index: int
    page: Optional[int]
    content: str
    score: float
    highlight: str


class SearchResponse(BaseModel):
    query: str
    total_hits: int
    hits: List[SearchHit]
