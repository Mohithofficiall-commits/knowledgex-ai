"""Pydantic schemas for RAG (Retrieval-Augmented Generation) API."""
from __future__ import annotations
import uuid
from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    document_ids: list[uuid.UUID] = Field(default_factory=list)
    collection_id: Optional[uuid.UUID] = None
    language: Literal["en", "ta"] = "en"
    rag_mode: Literal["hybrid", "graph_rag", "corrective", "agentic"] = "hybrid"
    alpha: float = Field(default=0.5, ge=0.0, le=1.0, description="Dense vs sparse weight")
    override_llm_provider: Optional[str] = None
    override_api_key: Optional[str] = None
    conversation_history: Optional[List[Dict[str, str]]] = None


class Citation(BaseModel):
    marker: int
    document_id: uuid.UUID
    document_title: str
    chunk_id: uuid.UUID
    page: Optional[int] = None
    excerpt: str


class AskResponse(BaseModel):
    query: Optional[str] = None
    answer: str
    confidence: Literal["high", "medium", "low"]
    support_score: float = 1.0
    citations: list[Citation] = Field(default_factory=list)
    contradictions: list[Dict[str, Any]] = Field(default_factory=list)
    abstain: bool = False
    rag_mode_used: str = "hybrid"
    llm_provider: str = "mock_heuristic"
    llm_model: str = "extractive"
    is_mock_llm: bool = True
    graph_context: Optional[str] = None
    processing_time_ms: float = 0.0
    llm_used: bool = False


class SummarizeRequest(BaseModel):
    document_id: uuid.UUID
    max_points: int = Field(default=6, ge=1, le=20)
    language: Literal["en", "ta"] = "en"


class SummarizeResponse(BaseModel):
    points: list[str]
    document_title: str
    coverage: float
    word_count: int
    llm_used: bool = False


class CompareRequest(BaseModel):
    document_id_a: uuid.UUID
    document_id_b: uuid.UUID
    language: Literal["en", "ta"] = "en"


class CompareResponse(BaseModel):
    similarity: float
    document_a: str
    document_b: str
    shared: list[str]
    unique_a: list[str]
    unique_b: list[str]
    key_points_a: list[str]
    key_points_b: list[str]
    contradictions: list[Dict[str, Any]] = Field(default_factory=list)
    llm_used: bool = False


class VersionCompareRequest(BaseModel):
    document_id: uuid.UUID
    version_a: int = 1
    version_b: int = 2


class VersionCompareResponse(BaseModel):
    document_id: uuid.UUID
    title: str
    version_a: int
    version_b: int
    similarity_score: float
    added_clauses: list[str]
    removed_clauses: list[str]
    modified_clauses: list[Dict[str, str]]
    risk_delta: str
