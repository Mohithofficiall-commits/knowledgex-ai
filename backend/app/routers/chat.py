"""Chat Sessions and Conversational Message History Router."""
import uuid
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_optional_current_user
from app.db.session import get_db
from app.models.chat import ChatMessage, ChatSession
from app.models.user import User
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse,
    ChatTurnResponse,
)
from app.services.search_service import build_citations, search_chunks
from app.services.advanced_rag.rag_coordinator import answer_advanced_rag

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    data: ChatSessionCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversational research session."""
    session = ChatSession(
        user_id=current_user.id if current_user else None,
        collection_id=data.collection_id,
        title=data.title or "New Research Session",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return ChatSessionResponse(
        id=session.id,
        user_id=session.user_id,
        collection_id=session.collection_id,
        title=session.title,
        message_count=0,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db),
):
    """List research chat sessions with message counts."""
    stmt = (
        select(
            ChatSession,
            func.count(ChatMessage.id).label("msg_count"),
        )
        .outerjoin(ChatMessage, ChatMessage.session_id == ChatSession.id)
        .group_by(ChatSession.id)
        .order_by(ChatSession.updated_at.desc())
    )
    results = await db.execute(stmt)
    rows = results.all()

    sessions = []
    for sess, count in rows:
        sessions.append(
            ChatSessionResponse(
                id=sess.id,
                user_id=sess.user_id,
                collection_id=sess.collection_id,
                title=sess.title,
                message_count=count,
                created_at=sess.created_at,
                updated_at=sess.updated_at,
            )
        )
    return sessions


@router.get("/sessions/{session_id}")
async def get_chat_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get a chat session and all its messages in chronological order."""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = messages_result.scalars().all()

    return {
        "session": ChatSessionResponse.model_validate(session),
        "messages": [ChatMessageResponse.model_validate(m) for m in messages],
    }


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a chat session and its full message history."""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    await db.delete(session)
    await db.commit()


@router.post("/sessions/{session_id}/messages", response_model=ChatTurnResponse)
async def send_message_in_session(
    session_id: uuid.UUID,
    data: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Post a user message, retrieve evidence passages, and generate an attributed assistant answer.
    """
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # 1. Fetch previous session messages for conversational memory
    history_res = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(10)
    )
    past_messages = [{"role": m.role, "content": m.content} for m in history_res.scalars().all()]

    # 2. Save User Message
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=data.content,
        confidence="medium",
        citations=[],
    )
    db.add(user_msg)
    await db.flush()

    # 3. Execute Advanced RAG
    rag_out = await answer_advanced_rag(
        db=db,
        query=data.content,
        collection_id=session.collection_id,
        document_ids=data.document_ids or None,
        rag_mode="hybrid",
        conversation_history=past_messages,
    )

    assistant_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=rag_out.answer,
        confidence=rag_out.confidence,
        citations=[c.model_dump(mode="json") for c in rag_out.citations],
    )
    db.add(assistant_msg)

    # Update session title if default
    if session.title == "New Research Session":
        session.title = data.content[:50] + ("..." if len(data.content) > 50 else "")

    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return ChatTurnResponse(
        session_id=session_id,
        user_message=ChatMessageResponse.model_validate(user_msg),
        assistant_message=ChatMessageResponse.model_validate(assistant_msg),
    )
