"""
Provider-independent embedding service for KnowledgeX AI.
Supports Mock embeddings (offline, deterministic, normalized) and OpenAI embeddings.
Clearly distinguishes mock embeddings from real embeddings via `is_mock`.
"""
from __future__ import annotations

import hashlib
import math
import re
from abc import ABC, abstractmethod
from typing import List
from pydantic import BaseModel

from app.config import get_settings

settings = get_settings()


class EmbeddingResult(BaseModel):
    text: str
    vector: List[float]
    dimension: int
    model_name: str
    provider_name: str
    is_mock: bool


class BaseEmbeddingProvider(ABC):
    """Abstract interface for embedding generation."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        pass

    @property
    @abstractmethod
    def is_mock(self) -> bool:
        pass

    @abstractmethod
    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        """Generate embedding vectors for a batch of text chunks."""
        pass

    @abstractmethod
    async def embed_query(self, query: str) -> EmbeddingResult:
        """Generate an embedding vector for a search query."""
        pass


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic, reproducible mock embedding provider.
    Generates unit-normalized 384-dimensional vectors based on lexical hashing.
    Similar texts produce higher cosine similarity than unrelated texts.
    Requires no network access or API keys.
    """

    def __init__(self, dimension: int = 384, model_name: str = "mock-minilm-l6-v2"):
        self._dim = dimension
        self._model = model_name

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def is_mock(self) -> bool:
        return True

    def _generate_vector(self, text: str) -> List[float]:
        """Generate deterministic, unit-normalized dense float vector from text tokens."""
        if not text.strip():
            return [0.0] * self._dim

        vector = [0.0] * self._dim
        words = re.findall(r"\w+", text.lower())

        for word in words:
            # Deterministic hash to map word across dimensions
            h = hashlib.sha256(word.encode("utf-8")).digest()
            for i in range(0, min(len(h), self._dim), 2):
                idx = (h[i] * 256 + h[i + 1]) % self._dim
                # Add signed frequency weight
                val = ((h[i] % 31) - 15) / 15.0
                vector[idx] += val

        # Normalize vector to unit length (L2 norm)
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 1e-9:
            vector = [round(v / norm, 6) for v in vector]
        else:
            # Uniform fallback for empty tokens
            vector = [round(1.0 / math.sqrt(self._dim), 6)] * self._dim

        return vector

    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        results: List[EmbeddingResult] = []
        for text in texts:
            vec = self._generate_vector(text)
            results.append(
                EmbeddingResult(
                    text=text,
                    vector=vec,
                    dimension=self._dim,
                    model_name=self._model,
                    provider_name=self.provider_name,
                    is_mock=True,
                )
            )
        return results

    async def embed_query(self, query: str) -> EmbeddingResult:
        vec = self._generate_vector(query)
        return EmbeddingResult(
            text=query,
            vector=vec,
            dimension=self._dim,
            model_name=self._model,
            provider_name=self.provider_name,
            is_mock=True,
        )


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """
    OpenAI embedding provider using text-embedding-3-small or configured model.
    Only activated when OPENAI_API_KEY is supplied.
    """

    def __init__(self, api_key: str, model_name: str = "text-embedding-3-small", dimension: int = 1536):
        self._api_key = api_key
        self._model = model_name
        self._dim = dimension

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def is_mock(self) -> bool:
        return False

    async def embed_texts(self, texts: List[str]) -> List[EmbeddingResult]:
        import httpx
        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                headers=headers,
                json={"input": texts, "model": self._model},
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item, original_text in zip(data["data"], texts):
            results.append(
                EmbeddingResult(
                    text=original_text,
                    vector=item["embedding"],
                    dimension=len(item["embedding"]),
                    model_name=self._model,
                    provider_name=self.provider_name,
                    is_mock=False,
                )
            )
        return results

    async def embed_query(self, query: str) -> EmbeddingResult:
        res = await self.embed_texts([query])
        return res[0]


def get_embedding_provider() -> BaseEmbeddingProvider:
    """
    Factory to select the configured embedding provider.
    Defaults to MockEmbeddingProvider if no API key is configured.
    """
    if settings.llm_provider == "openai" and settings.openai_api_key:
        return OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key,
            model_name=settings.embedding_model,
        )
    # Default mock provider
    return MockEmbeddingProvider(dimension=384, model_name="mock-minilm-l6-v2")
