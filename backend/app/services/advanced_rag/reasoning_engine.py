"""
Intelligence & Reasoning Engine for KnowledgeX AI.
Provides Evidence Verification, Contradiction Detection, Historical Version Comparison,
and Hallucination Defense with strict Abstention.
"""
from __future__ import annotations

import difflib
import re
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel

from app.services.advanced_rag.bm25 import tokenize
from app.services.advanced_rag.reranker import RerankedPassage


class ContradictionAlert(BaseModel):
    conflict_type: str  # "numerical" | "deadline_date" | "policy_conflict"
    document_a: str
    document_b: str
    excerpt_a: str
    excerpt_b: str
    explanation: str


class EvidenceVerification(BaseModel):
    is_supported: bool
    support_score: float  # 0.0 to 1.0
    verified_claims_count: int
    unsupported_claims_count: int
    contradictions: List[ContradictionAlert]
    abstain: bool
    abstention_reason: Optional[str] = None


class VersionDiffResult(BaseModel):
    version_a: int
    version_b: int
    similarity_score: float
    added_clauses: List[str]
    removed_clauses: List[str]
    modified_clauses: List[Dict[str, str]]
    risk_delta: str


class ReasoningEngine:
    """
    Evaluates factual support, detects contradictions, compares document versions,
    and enforces strict hallucination abstention.
    """

    def __init__(self, abstention_threshold: float = 0.22):
        self.abstention_threshold = abstention_threshold

    def evaluate_retrieval(self, query: str, passages: List[RerankedPassage]) -> Tuple[bool, Optional[str]]:
        """
        Check if retrieved evidence is sufficient to ground an answer.
        Returns (should_abstain, reason).
        """
        if not passages:
            return True, "No passages in the indexed documents matched your query terms."

        max_score = passages[0].rerank_score
        if max_score < self.abstention_threshold:
            return True, (
                f"Maximum passage relevance ({max_score:.2f}) is below the required evidence threshold ({self.abstention_threshold:.2f}). "
                f"KnowledgeX strictly abstains from hallucinating unsupported answers."
            )

        # Check term coverage
        query_terms = tokenize(query)
        combined_text = " ".join(p.passage.content.lower() for p in passages[:3])
        matched_terms = [t for t in query_terms if t in combined_text]
        coverage = len(matched_terms) / len(query_terms) if query_terms else 0.0

        if coverage < 0.25 and len(query_terms) >= 3:
            return True, "Key query concepts could not be verified in the indexed passages."

        return False, None

    def detect_contradictions(self, passages: List[RerankedPassage]) -> List[ContradictionAlert]:
        """
        Scan retrieved passages for numerical, deadline, or opposing clause contradictions.
        """
        conflicts: List[ContradictionAlert] = []
        if len(passages) < 2:
            return conflicts

        # Regex patterns for numerical expressions & day counts
        days_pattern = re.compile(r"\b(\d+)\s*(?:business\s*)?days?\b", re.IGNORECASE)
        currency_pattern = re.compile(r"[\$₹€£]\s*[\d,]+(?:\.\d+)?|\b[\d,]+\s*(?:dollars|rupees|percent|%)\b", re.IGNORECASE)

        for i in range(len(passages)):
            for j in range(i + 1, len(passages)):
                p1 = passages[i].passage
                p2 = passages[j].passage

                # If from different documents or distinct sections
                if p1.document_id == p2.document_id and p1.chunk_index == p2.chunk_index:
                    continue

                # 1. Check for conflicting day counts
                m1_days = set(days_pattern.findall(p1.content))
                m2_days = set(days_pattern.findall(p2.content))
                if m1_days and m2_days and not m1_days.intersection(m2_days):
                    conflicts.append(
                        ContradictionAlert(
                            conflict_type="numerical",
                            document_a=p1.document_title,
                            document_b=p2.document_title,
                            excerpt_a=f"{p1.content[:150]}... (mentions {', '.join(m1_days)} days)",
                            excerpt_b=f"{p2.content[:150]}... (mentions {', '.join(m2_days)} days)",
                            explanation=f"Conflicting timeframe: '{p1.document_title}' states {', '.join(m1_days)} days while '{p2.document_title}' specifies {', '.join(m2_days)} days.",
                        )
                    )

                # 2. Check for conflicting monetary figures or percentages
                m1_curr = set(currency_pattern.findall(p1.content))
                m2_curr = set(currency_pattern.findall(p2.content))
                if m1_curr and m2_curr and not m1_curr.intersection(m2_curr):
                    # Check if they share surrounding context words
                    w1 = set(tokenize(p1.content))
                    w2 = set(tokenize(p2.content))
                    if len(w1.intersection(w2)) >= 4:
                        conflicts.append(
                            ContradictionAlert(
                                conflict_type="numerical",
                                document_a=p1.document_title,
                                document_b=p2.document_title,
                                excerpt_a=f"{p1.content[:140]}... ({', '.join(m1_curr)})",
                                excerpt_b=f"{p2.content[:140]}... ({', '.join(m2_curr)})",
                                explanation=f"Discrepancy in figures across related clauses: {', '.join(m1_curr)} vs {', '.join(m2_curr)}.",
                            )
                        )

        return conflicts[:3]

    def verify_answer_evidence(
        self,
        query: str,
        answer_text: str,
        passages: List[RerankedPassage],
    ) -> EvidenceVerification:
        """
        Verify that generated answer sentences are grounded in the passages.
        """
        abstain, reason = self.evaluate_retrieval(query, passages)
        if abstain:
            return EvidenceVerification(
                is_supported=False,
                support_score=0.0,
                verified_claims_count=0,
                unsupported_claims_count=1,
                contradictions=[],
                abstain=True,
                abstention_reason=reason,
            )

        contradictions = self.detect_contradictions(passages)
        answer_sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", answer_text) if len(s.strip()) > 15]
        if not answer_sentences:
            return EvidenceVerification(
                is_supported=True,
                support_score=0.85,
                verified_claims_count=1,
                unsupported_claims_count=0,
                contradictions=contradictions,
                abstain=False,
            )

        combined_context = " ".join(p.passage.content.lower() for p in passages)
        verified = 0
        unsupported = 0

        for sent in answer_sentences:
            tokens = tokenize(sent)
            if not tokens:
                continue
            matched = sum(1 for t in tokens if t in combined_context)
            ratio = matched / len(tokens)
            if ratio >= 0.50:
                verified += 1
            else:
                unsupported += 1

        total = verified + unsupported
        score = round(verified / total, 3) if total > 0 else 1.0

        return EvidenceVerification(
            is_supported=score >= 0.60,
            support_score=score,
            verified_claims_count=verified,
            unsupported_claims_count=unsupported,
            contradictions=contradictions,
            abstain=False,
        )

    def compare_versions(
        self,
        text_v1: str,
        text_v2: str,
        version_a_num: int = 1,
        version_b_num: int = 2,
    ) -> VersionDiffResult:
        """
        Compare two historical document versions and generate semantic clause delta.
        """
        lines_v1 = [line.strip() for line in text_v1.split("\n") if len(line.strip()) > 10]
        lines_v2 = [line.strip() for line in text_v2.split("\n") if len(line.strip()) > 10]

        matcher = difflib.SequenceMatcher(None, lines_v1, lines_v2)
        sim = round(matcher.ratio(), 3)

        added: List[str] = []
        removed: List[str] = []
        modified: List[Dict[str, str]] = []

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "insert":
                for j in range(j1, j2):
                    added.append(lines_v2[j])
            elif tag == "delete":
                for i in range(i1, i2):
                    removed.append(lines_v1[i])
            elif tag == "replace":
                for i, j in zip(range(i1, i2), range(j1, j2)):
                    modified.append({
                        "original": lines_v1[i],
                        "revised": lines_v2[j],
                    })

        risk_delta = (
            "High impact modifications detected" if len(removed) > 3 or len(added) > 5
            else "Moderate terminology and clause refinements" if modified
            else "Minimal structural changes"
        )

        return VersionDiffResult(
            version_a=version_a_num,
            version_b=version_b_num,
            similarity_score=sim,
            added_clauses=added[:8],
            removed_clauses=removed[:8],
            modified_clauses=modified[:8],
            risk_delta=risk_delta,
        )
