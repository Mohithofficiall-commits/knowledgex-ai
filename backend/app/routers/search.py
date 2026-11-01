"""Search and Retrieval API endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.search import SearchRequest, SearchResponse
from app.services.search_service import search_chunks

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/query", response_model=SearchResponse)
async def query_documents(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Search indexed document chunks across all documents or within a specific collection.
    Returns lexical overlap scores and context highlights.
    """
    return await search_chunks(
        db=db,
        query=request.query,
        collection_id=request.collection_id,
        document_ids=request.document_ids,
        limit=request.limit,
    )
