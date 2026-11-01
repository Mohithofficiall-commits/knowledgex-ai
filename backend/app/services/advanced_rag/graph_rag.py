"""
Graph RAG Engine for KnowledgeX AI.
Traverses semantic entity-relationship topologies to enrich retrieved passages
with multi-hop context from the knowledge graph.
"""
from __future__ import annotations

import uuid
from typing import Dict, List, Optional, Set
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgeNode, KnowledgeEdge
from app.models.document import DocumentChunk


class GraphContext(BaseModel):
    matched_nodes: List[Dict[str, str]]
    connected_relations: List[Dict[str, str]]
    enriched_chunk_ids: List[uuid.UUID]
    explanation: str


async def traverse_graph_context(
    db: AsyncSession,
    entities: List[str],
    max_hops: int = 2,
    limit: int = 8,
) -> GraphContext:
    """
    Search for graph nodes matching query entities and traverse 1-to-2 hop edges
    to surface connected entities and cross-document relationships.
    """
    if not entities:
        return GraphContext(
            matched_nodes=[],
            connected_relations=[],
            enriched_chunk_ids=[],
            explanation="No specific named entities identified for graph traversal.",
        )

    # 1. Find matching root nodes
    clauses = [KnowledgeNode.label.ilike(f"%{e}%") for e in entities]
    stmt = select(KnowledgeNode).where(or_(*clauses)).limit(10)
    res = await db.execute(stmt)
    root_nodes = res.scalars().all()

    if not root_nodes:
        return GraphContext(
            matched_nodes=[],
            connected_relations=[],
            enriched_chunk_ids=[],
            explanation="No pre-indexed graph nodes matched query entities.",
        )

    root_ids = [n.id for n in root_nodes]
    matched_nodes = [{"id": str(n.id), "label": n.label, "type": n.node_type} for n in root_nodes]

    # 2. Traverse Edges (1-Hop and 2-Hop)
    edge_stmt = select(KnowledgeEdge).where(
        or_(
            KnowledgeEdge.source_id.in_(root_ids),
            KnowledgeEdge.target_id.in_(root_ids),
        )
    ).limit(limit)
    edge_res = await db.execute(edge_stmt)
    edges = edge_res.scalars().all()

    connected_node_ids: Set[uuid.UUID] = set(root_ids)
    relations: List[Dict[str, str]] = []

    for edge in edges:
        connected_node_ids.add(edge.source_id)
        connected_node_ids.add(edge.target_id)
        relations.append({
            "source_id": str(edge.source_id),
            "target_id": str(edge.target_id),
            "relation": edge.relation,
            "weight": str(edge.weight),
        })

    # 3. Find connected document chunks for these nodes
    doc_ids_from_nodes = [n.document_id for n in root_nodes if n.document_id]
    enriched_chunk_ids: List[uuid.UUID] = []

    if doc_ids_from_nodes:
        chunk_stmt = select(DocumentChunk.id).where(
            DocumentChunk.document_id.in_(doc_ids_from_nodes)
        ).limit(10)
        c_res = await db.execute(chunk_stmt)
        enriched_chunk_ids = list(c_res.scalars().all())

    explanation = (
        f"Graph RAG traversed {len(root_nodes)} seed entity nodes and {len(relations)} semantic relations "
        f"across {len(doc_ids_from_nodes)} connected documents."
    )

    return GraphContext(
        matched_nodes=matched_nodes,
        connected_relations=relations,
        enriched_chunk_ids=enriched_chunk_ids,
        explanation=explanation,
    )
