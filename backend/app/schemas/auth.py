"""Pydantic schemas for Authentication and User Profiles."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field

EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class UserRegister(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX, description="Valid email address")
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=2, max_length=100)
    role: Optional[Literal["user", "researcher", "admin"]] = "user"


class UserLogin(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX, description="Valid email address")
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: uuid.UUID
    email: str
    full_name: str


class ProfileResponse(BaseModel):
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: dict = {}
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    profile: Optional[ProfileResponse] = None

    model_config = {"from_attributes": True}
