"""Knowledge Collections Router: Organization, grouping and folder scoping."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_optional_current_user
from app.db.session import get_db
from app.models.collection import Collection
from app.models.document import Document
from app.models.user import User
from app.schemas.collection import CollectionCreate, CollectionListResponse, CollectionResponse, CollectionUpdate

router = APIRouter(prefix="/collections", tags=["collections"])


@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    data: CollectionCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new knowledge collection."""
    # Use user id or fallback system user id for anonymous sessions
    user_id = current_user.id if current_user else uuid.UUID("00000000-0000-0000-0000-000000000001")

    # If system user doesn't exist, create it once
    if not current_user:
        user_check = await db.execute(select(User).where(User.id == user_id))
        if not user_check.scalar_one_or_none():
            system_user = User(
                id=user_id,
                email="system@knowledgex.ai",
                hashed_password="",
                full_name="KnowledgeX System",
                role="admin",
            )
            db.add(system_user)
            await db.flush()

    collection = Collection(
        user_id=user_id,
        name=data.name,
        description=data.description,
        color=data.color,
        is_private=data.is_private,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    return CollectionResponse(
        id=collection.id,
        user_id=collection.user_id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        is_private=collection.is_private,
        document_count=0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.get("", response_model=CollectionListResponse)
async def list_collections(
    db: AsyncSession = Depends(get_db),
):
    """List all knowledge collections with real-time document counts."""
    # Subquery for document counts
    stmt = (
        select(
            Collection,
            func.count(Document.id).label("doc_count"),
        )
        .outerjoin(Document, Document.collection_id == Collection.id)
        .group_by(Collection.id)
        .order_by(Collection.created_at.desc())
    )
    results = await db.execute(stmt)
    rows = results.all()

    collections = []
    for coll, count in rows:
        collections.append(
            CollectionResponse(
                id=coll.id,
                user_id=coll.user_id,
                name=coll.name,
                description=coll.description,
                color=coll.color,
                is_private=coll.is_private,
                document_count=count,
                created_at=coll.created_at,
                updated_at=coll.updated_at,
            )
        )

    return CollectionListResponse(collections=collections, total=len(collections))


@router.get("/{collection_id}", response_model=CollectionResponse)
async def get_collection(collection_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve collection details by ID."""
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    coll = result.scalar_one_or_none()
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")

    count_result = await db.execute(
        select(func.count(Document.id)).where(Document.collection_id == collection_id)
    )
    count = count_result.scalar_one()

    return CollectionResponse(
        id=coll.id,
        user_id=coll.user_id,
        name=coll.name,
        description=coll.description,
        color=coll.color,
        is_private=coll.is_private,
        document_count=count,
        created_at=coll.created_at,
        updated_at=coll.updated_at,
    )


@router.put("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: uuid.UUID,
    data: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update collection properties."""
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    coll = result.scalar_one_or_none()
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")

    if data.name is not None:
        coll.name = data.name
    if data.description is not None:
        coll.description = data.description
    if data.color is not None:
        coll.color = data.color
    if data.is_private is not None:
        coll.is_private = data.is_private

    await db.commit()
    await db.refresh(coll)

    count_result = await db.execute(
        select(func.count(Document.id)).where(Document.collection_id == collection_id)
    )
    return CollectionResponse(
        id=coll.id,
        user_id=coll.user_id,
        name=coll.name,
        description=coll.description,
        color=coll.color,
        is_private=coll.is_private,
        document_count=count_result.scalar_one(),
        created_at=coll.created_at,
        updated_at=coll.updated_at,
    )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(collection_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a collection and unassign documents."""
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    coll = result.scalar_one_or_none()
    if not coll:
        raise HTTPException(status_code=404, detail="Collection not found")

    await db.delete(coll)
    await db.commit()


@router.post("/{collection_id}/documents/{document_id}")
async def add_document_to_collection(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Assign an existing document to a collection."""
    doc_res = await db.execute(select(Document).where(Document.id == document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    coll_res = await db.execute(select(Collection).where(Collection.id == collection_id))
    if not coll_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Collection not found")

    doc.collection_id = collection_id
    await db.commit()
    return {"message": "Document assigned to collection", "document_id": str(document_id), "collection_id": str(collection_id)}


@router.delete("/{collection_id}/documents/{document_id}")
async def remove_document_from_collection(
    collection_id: uuid.UUID,
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Remove a document from a collection without deleting the document."""
    doc_res = await db.execute(select(Document).where(Document.id == document_id))
    doc = doc_res.scalar_one_or_none()
    if not doc or doc.collection_id != collection_id:
        raise HTTPException(status_code=404, detail="Document not found in this collection")

    doc.collection_id = None
    await db.commit()
    return {"message": "Document unassigned from collection"}
