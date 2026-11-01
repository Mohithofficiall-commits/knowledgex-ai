"""User Profile and User Management Router."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.user import User, UserProfile
from app.schemas.auth import ProfileResponse, ProfileUpdate, UserResponse

from pydantic import BaseModel

router = APIRouter(prefix="/users", tags=["Users"])

class ApiKeyTestRequest(BaseModel):
    provider: str
    api_key: str

class ApiKeyTestResponse(BaseModel):
    valid: bool
    message: str
    provider: str

@router.post("/test-api-key", response_model=ApiKeyTestResponse)
async def test_llm_api_key(
    req: ApiKeyTestRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Test an LLM API key against the provider.
    Verifies authentication without storing unverified keys.
    """
    provider = req.provider.lower()
    key = req.api_key.strip()
    if not key:
        return ApiKeyTestResponse(valid=False, message="API key cannot be blank.", provider=provider)

    try:
        if provider == "openai":
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {key}"})
                if res.status_code == 200:
                    return ApiKeyTestResponse(valid=True, message="OpenAI API key verified successfully! Models accessible.", provider="openai")
                return ApiKeyTestResponse(valid=False, message=f"OpenAI rejected key: HTTP {res.status_code} ({res.text[:100]})", provider="openai")

        elif provider == "anthropic":
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={"model": "claude-3-haiku-20240307", "max_tokens": 1, "messages": [{"role": "user", "content": "ping"}]},
                )
                if res.status_code in (200, 400):  # 400 with valid auth is still authenticated
                    return ApiKeyTestResponse(valid=True, message="Anthropic API key verified successfully!", provider="anthropic")
                return ApiKeyTestResponse(valid=False, message=f"Anthropic rejected key: HTTP {res.status_code}", provider="anthropic")

        elif provider == "google":
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
                if res.status_code == 200:
                    return ApiKeyTestResponse(valid=True, message="Google Gemini API key verified successfully!", provider="google")
                return ApiKeyTestResponse(valid=False, message=f"Google rejected key: HTTP {res.status_code}", provider="google")

        return ApiKeyTestResponse(valid=False, message=f"Unsupported provider '{provider}'.", provider=provider)
    except Exception as exc:
        return ApiKeyTestResponse(valid=False, message=f"Connection error: {str(exc)[:120]}", provider=provider)


@router.get("/profile", response_model=ProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve personal user profile details."""
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(user_id=current_user.id, bio="", preferences={})
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


@router.put("/profile", response_model=ProfileResponse)
async def update_my_profile(
    update_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update bio, avatar, and preference settings."""
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    if update_data.bio is not None:
        profile.bio = update_data.bio
    if update_data.avatar_url is not None:
        profile.avatar_url = update_data.avatar_url
    if update_data.preferences is not None:
        current_prefs = dict(profile.preferences or {})
        current_prefs.update(update_data.preferences)
        profile.preferences = current_prefs

    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("", response_model=List[UserResponse])
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(["admin"])),
):
    """Admin-only: list all system users."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return list(users)
