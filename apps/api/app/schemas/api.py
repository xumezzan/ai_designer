from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


# ---- auth ----
class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None
    plan: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---- projects ----
class ProjectCreate(BaseModel):
    name: str
    event_type: str = "wedding"
    brief: dict[str, Any] = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    name: str | None = None
    event_type: str | None = None
    brief: dict[str, Any] | None = None
    event_date: str | None = None
    status: str | None = None


class DesignSave(BaseModel):
    design: dict[str, Any]
    source: str = "manual"


class ProjectOut(BaseModel):
    id: str
    name: str
    event_type: str
    status: str
    event_date: str | None
    brief: dict[str, Any]
    reference_analysis: dict[str, Any] | None
    design: dict[str, Any] | None
    design_version: int
    slug: str | None
    thumbnail_url: str | None
    created_at: datetime
    updated_at: datetime
    is_published: bool = False
    public_url: str | None = None
    rsvp_count: int = 0

    model_config = {"from_attributes": True}


# ---- references / assets ----
class ReferenceOut(BaseModel):
    id: str
    url: str
    width: int | None
    height: int | None
    note: str | None
    group: str | None
    palette: list[str] | None
    position: int
    model_config = {"from_attributes": True}


class ReferenceUpdate(BaseModel):
    note: str | None = None
    group: str | None = None
    position: int | None = None


class ReferenceFromUrl(BaseModel):
    url: str
    note: str | None = None


class AssetOut(BaseModel):
    id: str
    url: str
    filename: str | None
    width: int | None
    height: int | None
    size: int
    content_type: str
    model_config = {"from_attributes": True}


# ---- ai ----
class GenerationOut(BaseModel):
    id: str
    status: str
    provider: str
    style_profile: dict[str, Any] | None
    concepts: list[dict[str, Any]] | None
    error: str | None
    model_config = {"from_attributes": True}


class SelectConceptIn(BaseModel):
    generation_id: str
    index: int


class EditIn(BaseModel):
    prompt: str
    design: dict[str, Any] | None = None  # current (possibly unsaved) design


class EditOut(BaseModel):
    id: str
    summary: str
    operations: list[dict[str, Any]]
    provider: str


class CheckIn(BaseModel):
    design: dict[str, Any]


# ---- publishing ----
class PublishIn(BaseModel):
    slug: str | None = None
    password: str | None = None


class PublicationOut(BaseModel):
    slug: str
    is_live: bool
    url: str
    published_at: datetime
    views: int
    has_password: bool = False


# ---- rsvp ----
class RsvpIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    guests: int = Field(ge=1, le=20, default=1)
    attending: bool
    dietary: str | None = None
    message: str | None = None
    email: str | None = None


class RsvpOut(BaseModel):
    id: str
    name: str
    guests: int
    attending: bool | None
    dietary: str | None
    message: str | None
    email: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class RsvpStats(BaseModel):
    total_responses: int
    total_guests: int
    confirmed: int
    declined: int
    pending: int
