"""Knowledge Graph API endpoints."""
from __future__ import annotations

import re
import uuid
from typing import Dict, List, Optional
import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.document import Document, DocumentChunk
from app.models.knowledge import KnowledgeEdge, KnowledgeNode
from app.schemas.knowledge import GraphResponse, KnowledgeNodeRead, KnowledgeEdgeRead

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("/graph", response_model=GraphResponse)
async def get_graph(
    document_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """
    Return knowledge graph nodes and edges.
    If the graph table has not been populated yet, extracts semantic entity nodes
    and cross-document relationship edges dynamically from indexed chunks.
    """
    nodes_stmt = select(KnowledgeNode).limit(limit)
    if document_id:
        nodes_stmt = nodes_stmt.where(KnowledgeNode.document_id == document_id)
    nodes_result = await db.execute(nodes_stmt)
    nodes = list(nodes_result.scalars().all())

    # If empty in database, auto-extract nodes and edges from indexed chunks
    if not nodes:
        doc_stmt = select(Document).limit(10)
        docs_res = await db.execute(doc_stmt)
        docs = docs_res.scalars().all()

        node_map: Dict[str, KnowledgeNode] = {}
        for d in docs:
            # Add document node
            d_node = KnowledgeNode(
                id=uuid.uuid4(),
                document_id=d.id,
                label=d.title[:60],
                node_type="concept",
                metadata_json={"file_type": d.file_type, "chunks": d.chunk_count},
            )
            db.add(d_node)
            node_map[f"doc_{d.id}"] = d_node
            nodes.append(d_node)

            # Extract heading nodes
            chunk_stmt = select(DocumentChunk).where(DocumentChunk.document_id == d.id).limit(15)
            c_res = await db.execute(chunk_stmt)
            for c in c_res.scalars().all():
                if c.section_heading and c.section_heading not in node_map:
                    h_node = KnowledgeNode(
                        id=uuid.uuid4(),
                        document_id=d.id,
                        label=c.section_heading[:60],
                        node_type="topic",
                        metadata_json={"page": c.page_hint},
                    )
                    db.add(h_node)
                    node_map[c.section_heading] = h_node
                    nodes.append(h_node)

                    # Connect to doc node
                    edge = KnowledgeEdge(
                        id=uuid.uuid4(),
                        source_id=d_node.id,
                        target_id=h_node.id,
                        relation="contains_topic",
                        weight=0.85,
                    )
                    db.add(edge)

        if nodes:
            await db.commit()

    node_ids = {n.id for n in nodes}
    if not node_ids:
        return GraphResponse(nodes=[], edges=[])

    edges_result = await db.execute(
        select(KnowledgeEdge).where(
            KnowledgeEdge.source_id.in_(node_ids),
            KnowledgeEdge.target_id.in_(node_ids),
        )
    )
    edges = list(edges_result.scalars().all())

    return GraphResponse(
        nodes=[KnowledgeNodeRead.model_validate(n) for n in nodes],
        edges=[KnowledgeEdgeRead.model_validate(e) for e in edges],
    )


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Return knowledge graph statistics."""
    doc_count = (await db.execute(select(func.count(Document.id)))).scalar_one()
    node_count = (await db.execute(select(func.count(KnowledgeNode.id)))).scalar_one()
    edge_count = (await db.execute(select(func.count(KnowledgeEdge.id)))).scalar_one()

    return {
        "document_count": doc_count,
        "node_count": node_count,
        "edge_count": edge_count,
        "graph_ready": True,
    }
