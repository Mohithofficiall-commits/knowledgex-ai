"""
Query Understanding & Decomposition Engine for KnowledgeX AI.
Decomposes complex multi-part queries into atomic sub-queries for multi-hop retrieval.
Detects user intent (comparison, factual, contradiction analysis, summarization).
"""
from __future__ import annotations

import re
from typing import List
from pydantic import BaseModel


class DecomposedQuery(BaseModel):
    original_query: str
    intent: str  # "factual" | "comparative" | "contradiction_check" | "multi_part"
    sub_queries: List[str]
    is_complex: bool
    entities: List[str]


def decompose_query(query: str) -> DecomposedQuery:
    """
    Analyze query structure, extract key entities, and decompose into sub-queries.
    """
    q = query.strip()
    q_lower = q.lower()

    # Detect Intent
    if any(k in q_lower for k in ("compare", "difference between", "versus", "vs", "similarities")):
        intent = "comparative"
    elif any(k in q_lower for k in ("conflict", "contradict", "discrepancy", "inconsistent", "opposing")):
        intent = "contradiction_check"
    elif any(conj in q_lower for conj in (" and also ", " as well as ", "; ", " additionally ", " whereas ")):
        intent = "multi_part"
    else:
        intent = "factual"

    # Entity candidate extraction (capitalized words or key terms)
    entity_candidates = re.findall(r"\b[A-Z][a-zA-Z0-9_\-]+\b", query)
    cleaned_entities = list(dict.fromkeys(e for e in entity_candidates if e.lower() not in ("what", "how", "why", "when", "where", "can", "does", "the")))

    sub_queries: List[str] = []

    if intent == "comparative":
        # Extract comparison targets e.g. "Compare X and Y regarding Z"
        match = re.search(r"compare\s+(.+?)\s+and\s+(.+?)(?:\s+regarding|\s+for|\s+in terms of|\?|$)", q, re.IGNORECASE)
        if match:
            target_a, target_b = match.group(1).strip(), match.group(2).strip()
            sub_queries.append(f"{target_a} specifications and terms")
            sub_queries.append(f"{target_b} specifications and terms")
        else:
            sub_queries = [q]

    elif intent == "multi_part":
        # Split on coordinating conjunctions
        parts = re.split(r"\s+(?:and also|as well as|additionally|whereas)\s+|;\s+", q, flags=re.IGNORECASE)
        sub_queries = [p.strip() for p in parts if len(p.strip()) > 5]
        if not sub_queries:
            sub_queries = [q]

    else:
        sub_queries = [q]

    return DecomposedQuery(
        original_query=q,
        intent=intent,
        sub_queries=sub_queries,
        is_complex=len(sub_queries) > 1 or intent in ("comparative", "contradiction_check"),
        entities=cleaned_entities,
    )
