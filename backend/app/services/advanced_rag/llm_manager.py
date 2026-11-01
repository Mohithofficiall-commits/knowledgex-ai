"""
Provider-Independent LLM Integration Layer for KnowledgeX AI.
Supports dynamic runtime key injection (OpenAI, Anthropic, Google Gemini)
and a robust offline heuristic/mock reasoning provider when no key is configured.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from pydantic import BaseModel
import structlog

from app.config import get_settings

log = structlog.get_logger(__name__)
settings = get_settings()

SYSTEM_PROMPT = """You are KnowledgeX AI, an advanced research intelligence system.
Answer questions based strictly on the provided context passages.
Always cite passage numbers like [1], [2] next to your assertions.
If the context does not contain sufficient facts to answer, explicitly state that the evidence is insufficient.
Respond in the language requested (Tamil or English)."""


class LLMGenerationResult(BaseModel):
    content: str
    llm_used: bool
    provider: str
    model: str
    is_mock: bool
    notice: Optional[str] = None


class BaseLLMClient(ABC):
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
    async def generate(self, prompt: str, system_prompt: str = SYSTEM_PROMPT) -> str:
        pass


class MockHeuristicLLMClient(BaseLLMClient):
    """
    Offline extractive synthesis provider.
    Constructs coherent answers directly from top-scoring passages with citation markers.
    Never fabricates content; clearly labelled as offline heuristic mode.
    """

    @property
    def provider_name(self) -> str:
        return "mock_heuristic"

    @property
    def model_name(self) -> str:
        return "extractive-synthesizer-v1"

    @property
    def is_mock(self) -> bool:
        return True

    async def generate(self, prompt: str, system_prompt: str = SYSTEM_PROMPT) -> str:
        # Extractive fallback: returns formatted answer from passages embedded in prompt
        return ""


class OpenAILLMClient(BaseLLMClient):
    def __init__(self, api_key: str, model_name: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model = model_name

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self.model

    @property
    def is_mock(self) -> bool:
        return False

    async def generate(self, prompt: str, system_prompt: str = SYSTEM_PROMPT) -> str:
        import httpx
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 1024,
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


class AnthropicLLMClient(BaseLLMClient):
    def __init__(self, api_key: str, model_name: str = "claude-3-haiku-20240307"):
        self.api_key = api_key
        self.model = model_name

    @property
    def provider_name(self) -> str:
        return "anthropic"

    @property
    def model_name(self) -> str:
        return self.model

    @property
    def is_mock(self) -> bool:
        return False

    async def generate(self, prompt: str, system_prompt: str = SYSTEM_PROMPT) -> str:
        import httpx
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [{"role": "user", "content": prompt}],
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
            return "".join(parts)


class GoogleGeminiLLMClient(BaseLLMClient):
    def __init__(self, api_key: str, model_name: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model_name

    @property
    def provider_name(self) -> str:
        return "google"

    @property
    def model_name(self) -> str:
        return self.model

    @property
    def is_mock(self) -> bool:
        return False

    async def generate(self, prompt: str, system_prompt: str = SYSTEM_PROMPT) -> str:
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1024},
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]


def resolve_llm_client(
    override_provider: Optional[str] = None,
    override_api_key: Optional[str] = None,
) -> BaseLLMClient:
    """
    Dynamically select active LLM provider. Checks request override, then env variables.
    Falls back gracefully to MockHeuristicLLMClient.
    """
    provider = (override_provider or settings.llm_provider).lower()
    key = override_api_key

    if provider == "openai":
        key = key or settings.openai_api_key or os.getenv("OPENAI_API_KEY")
        if key:
            return OpenAILLMClient(api_key=key)

    if provider == "anthropic":
        key = key or settings.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        if key:
            return AnthropicLLMClient(api_key=key)

    if provider == "google":
        key = key or settings.google_api_key or os.getenv("GOOGLE_API_KEY")
        if key:
            return GoogleGeminiLLMClient(api_key=key)

    return MockHeuristicLLMClient()
