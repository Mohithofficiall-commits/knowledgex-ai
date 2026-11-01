"""
LLM service layer – placeholder stubs for future LLM integration.

The application runs fully without any LLM API key configured.
When a key IS configured, these functions will call the appropriate provider.
All prompts and fallback pipelines are maintained here.
"""
from __future__ import annotations

import structlog

log = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You are KnowledgeX AI, a precise research assistant.
Answer ONLY based on the retrieved context passages provided.
Always cite passage numbers. If the answer is not in the context, say so clearly.
Be concise, accurate and professional."""


async def generate_answer(
    query: str,
    context_passages: list[str],
    language: str = "en",
) -> dict:
    """
    Generate an LLM-powered answer from retrieved passages.

    Returns:
        {'answer': str, 'llm_used': bool}
    """
    from app.config import get_settings

    settings = get_settings()

    if not settings.is_llm_configured:
        log.info("llm.not_configured", hint="Set LLM_PROVIDER and API key to enable")
        return {"answer": "", "llm_used": False}

    context = "\n\n".join(
        f"[{i + 1}] {passage}" for i, passage in enumerate(context_passages)
    )
    prompt = (
        f"Context passages:\n{context}\n\n"
        f"Question: {query}\n\n"
        f"Answer (cite passage numbers, respond in {'Tamil' if language == 'ta' else 'English'}):"
    )

    if settings.llm_provider == "openai":
        return await _call_openai(prompt)
    if settings.llm_provider == "anthropic":
        return await _call_anthropic(prompt)
    if settings.llm_provider == "google":
        return await _call_google(prompt)

    return {"answer": "", "llm_used": False}


async def _call_openai(prompt: str) -> dict:
    try:
        import openai
        from app.config import get_settings

        settings = get_settings()
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=1024,
        )
        return {"answer": response.choices[0].message.content or "", "llm_used": True}
    except Exception as exc:
        log.error("llm.openai.failed", error=str(exc))
        return {"answer": "", "llm_used": False}


async def _call_anthropic(prompt: str) -> dict:
    try:
        import anthropic
        from app.config import get_settings

        settings = get_settings()
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        text_content = ""
        for block in message.content:
            if hasattr(block, "text"):
                text_content += block.text
        return {"answer": text_content, "llm_used": True}
    except Exception as exc:
        log.error("llm.anthropic.failed", error=str(exc))
        return {"answer": "", "llm_used": False}


async def _call_google(prompt: str) -> dict:
    try:
        import google.generativeai as genai
        from app.config import get_settings

        settings = get_settings()
        genai.configure(api_key=settings.google_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = await model.generate_content_async(
            f"{SYSTEM_PROMPT}\n\n{prompt}"
        )
        return {"answer": response.text, "llm_used": True}
    except Exception as exc:
        log.error("llm.google.failed", error=str(exc))
        return {"answer": "", "llm_used": False}
