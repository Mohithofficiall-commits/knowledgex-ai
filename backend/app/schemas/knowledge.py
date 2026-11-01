"""Pydantic schemas for Knowledge Graph API."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class KnowledgeNodeRead(BaseModel):
    id: uuid.UUID
    label: str
    node_type: str
    document_id: Optional[uuid.UUID]
    metadata_: dict[str, Any] = {}
    created_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeEdgeRead(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    relation: str
    weight: float

    model_config = {"from_attributes": True}


class GraphResponse(BaseModel):
    nodes: list[KnowledgeNodeRead]
    edges: list[KnowledgeEdgeRead]
