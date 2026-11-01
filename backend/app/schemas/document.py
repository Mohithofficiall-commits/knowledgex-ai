"""Pydantic schemas for Document operations, Versioning and Chunks."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class DocumentBase(BaseModel):
    title: str
    file_name: str
    file_type: str
    byte_size: int
    is_demo: bool = False
    collection_id: Optional[uuid.UUID] = None


class DocumentVersionResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    version_number: int
    file_name: str
    byte_size: int
    change_summary: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentChunkRead(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    chunk_index: int
    page_hint: Optional[int] = None
    section_heading: Optional[str] = None
    content: str
    token_count: int = 0
    embedding_model: Optional[str] = None
    is_mock_embedding: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentRead(DocumentBase):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    chunk_count: int
    current_version: int
    content_hash: Optional[str] = None
    processing_status: str = "completed"
    processing_progress: int = 100
    processing_error: Optional[str] = None
    processing_logs: List[Dict[str, Any]] = []
    chunk_size: int = 500
    chunk_overlap: int = 100
    metadata_json: dict = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    collection_id: Optional[uuid.UUID] = None
    metadata_json: Optional[dict] = None


class ReprocessRequest(BaseModel):
    chunk_size: int = Field(default=500, ge=100, le=4000, description="Chunk character size (100 - 4000)")
    chunk_overlap: int = Field(default=100, ge=0, le=1000, description="Chunk overlap (0 - 1000)")


class DocumentStatusResponse(BaseModel):
    document_id: uuid.UUID
    title: str
    processing_status: str
    processing_progress: int
    processing_error: Optional[str] = None
    processing_logs: List[Dict[str, Any]] = []
    chunk_count: int


class DocumentListResponse(BaseModel):
    documents: List[DocumentRead]
    total: int


class UploadResponse(BaseModel):
    ok: bool
    document: Optional[DocumentRead] = None
    is_duplicate: bool = False
    duplicate_of_id: Optional[uuid.UUID] = None
    problem: Optional[str] = None  # "unsupported" | "tooLarge" | "noText" | "failed" | "duplicate"
    error_message: Optional[str] = None
