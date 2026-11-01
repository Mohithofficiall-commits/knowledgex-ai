"""
BM25 (Best Matching 25) Lexical Retrieval Engine for KnowledgeX AI.
Provides exact term frequency, inverse document frequency (IDF), and document length normalization.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Dict, List, Set, Tuple

STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i",
    "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
    "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves",
}


def tokenize(text: str) -> List[str]:
    """Tokenize and filter text into lowercase content terms."""
    clean = re.sub(r"[^\w\s]", " ", text.lower())
    return [w for w in clean.split() if len(w) > 2 and w not in STOPWORDS]


class BM25Index:
    """In-memory BM25 index over a collection of document passages."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.doc_count = 0
        self.avg_doc_len = 0.0
        self.doc_lengths: Dict[str, int] = {}
        self.doc_frequencies: Dict[str, int] = {}  # term -> doc count containing term
        self.inverted_index: Dict[str, Dict[str, int]] = {}  # term -> {doc_id -> freq}

    def fit(self, documents: List[Tuple[str, str]]) -> BM25Index:
        """
        Build BM25 index from a list of (doc_id, text) pairs.
        """
        self.doc_count = len(documents)
        if self.doc_count == 0:
            return self

        total_length = 0
        self.doc_frequencies.clear()
        self.inverted_index.clear()
        self.doc_lengths.clear()

        for doc_id, text in documents:
            tokens = tokenize(text)
            length = len(tokens)
            self.doc_lengths[doc_id] = length
            total_length += length

            term_counts = Counter(tokens)
            for term, count in term_counts.items():
                self.doc_frequencies[term] = self.doc_frequencies.get(term, 0) + 1
                if term not in self.inverted_index:
                    self.inverted_index[term] = {}
                self.inverted_index[term][doc_id] = count

        self.avg_doc_len = total_length / self.doc_count if self.doc_count > 0 else 1.0
        return self

    def score_query(self, query: str) -> List[Tuple[str, float]]:
        """
        Calculate BM25 relevance scores for all documents matching query terms.
        Returns sorted list of (doc_id, score) pairs.
        """
        query_terms = tokenize(query)
        if not query_terms or self.doc_count == 0:
            return []

        scores: Dict[str, float] = {}

        for term in query_terms:
            if term not in self.inverted_index:
                continue

            # Robertson-Spärck Jones IDF
            n_q = self.doc_frequencies[term]
            idf = math.log(1.0 + (self.doc_count - n_q + 0.5) / (n_q + 0.5))

            for doc_id, freq in self.inverted_index[term].items():
                doc_len = self.doc_lengths.get(doc_id, int(self.avg_doc_len))
                len_norm = 1.0 - self.b + self.b * (doc_len / self.avg_doc_len)
                term_score = idf * (freq * (self.k1 + 1.0)) / (freq + self.k1 * len_norm)
                scores[doc_id] = scores.get(doc_id, 0.0) + term_score

        results = [(doc_id, round(score, 4)) for doc_id, score in scores.items() if score > 0.0]
        results.sort(key=lambda x: x[1], reverse=True)
        return results
