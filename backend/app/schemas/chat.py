"""Pydantic schemas for Chat Sessions and Messages."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

from app.schemas.rag import Citation


class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field("New Research Session", max_length=200)
    collection_id: Optional[uuid.UUID] = None


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    collection_id: Optional[uuid.UUID] = None
    title: str
    message_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    document_ids: Optional[List[uuid.UUID]] = None


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: Literal["user", "assistant", "system"]
    content: str
    confidence: Literal["high", "medium", "low"]
    citations: List[Citation] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatTurnResponse(BaseModel):
    session_id: uuid.UUID
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
