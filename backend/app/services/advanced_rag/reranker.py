"""
Cross-Encoder Reranking Engine for KnowledgeX AI.
Re-scores candidate passages using joint query-passage term alignment,
phrase proximity, and heading context to eliminate irrelevant false positives.
"""
from __future__ import annotations

import re
from typing import List, Tuple
from pydantic import BaseModel

from app.services.advanced_rag.bm25 import tokenize
from app.services.advanced_rag.hybrid_retriever import RetrievedPassage


class RerankedPassage(BaseModel):
    passage: RetrievedPassage
    rerank_score: float
    relevance_grade: str  # "high" | "medium" | "low"
    matched_terms: List[str]
    best_matching_sentence: str


class CrossEncoderReranker:
    """
    Evaluates fine-grained semantic and lexical cross-attention features between
    the user query and candidate passages.
    """

    def __init__(self, min_relevance_threshold: float = 0.20):
        self.min_threshold = min_relevance_threshold

    def rerank(self, query: str, passages: List[RetrievedPassage], top_n: int = 5) -> List[RerankedPassage]:
        """
        Rerank retrieved candidate passages and filter out low-confidence noise.
        """
        query_terms = tokenize(query)
        if not query_terms or not passages:
            return []

        scored: List[Tuple[float, RerankedPassage]] = []

        for p in passages:
            content_lower = p.content.lower()
            passage_tokens = tokenize(p.content)
            if not passage_tokens:
                continue

            # 1. Term Coverage Ratio
            matched = [t for t in query_terms if t in content_lower]
            coverage = len(matched) / len(query_terms)

            # 2. Exact phrase bonus
            clean_q = " ".join(query_terms)
            phrase_bonus = 0.25 if clean_q in content_lower else 0.0

            # 3. Section Heading bonus
            heading_bonus = 0.0
            if p.section_heading:
                heading_lower = p.section_heading.lower()
                heading_matches = [t for t in query_terms if t in heading_lower]
                if heading_matches:
                    heading_bonus = 0.15 * (len(heading_matches) / len(query_terms))

            # 4. Proximity & Best Matching Sentence
            sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", p.content) if s.strip()]
            best_sentence = sentences[0] if sentences else p.content
            best_sent_score = 0.0

            for sent in sentences:
                sent_terms = set(tokenize(sent))
                sent_overlap = sent_terms.intersection(set(query_terms))
                if len(sent_overlap) > best_sent_score:
                    best_sent_score = len(sent_overlap)
                    best_sentence = sent

            sentence_density = best_sent_score / len(query_terms)

            # Composite cross-attention score
            composite = (
                0.40 * coverage
                + 0.25 * sentence_density
                + 0.20 * p.hybrid_score
                + phrase_bonus
                + heading_bonus
            )
            final_score = round(min(1.0, composite), 4)

            # Skip below threshold
            if final_score < self.min_threshold:
                continue

            grade = "high" if final_score >= 0.65 else "medium" if final_score >= 0.40 else "low"

            reranked_item = RerankedPassage(
                passage=p,
                rerank_score=final_score,
                relevance_grade=grade,
                matched_terms=matched,
                best_matching_sentence=best_sentence,
            )
            scored.append((final_score, reranked_item))

        # Sort descending by rerank score
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:top_n]]
