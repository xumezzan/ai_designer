"""Core data model.

Domains: Users · Projects (events) · References (inspiration) · Assets ·
Generations (AI concepts) · Designs (versioned design documents) ·
AI edits · Publications · RSVP.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def _id() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    plan: Mapped[str] = mapped_column(String(32), default="free")

    projects: Mapped[list["Project"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Project(Base, TimestampMixin):
    """A project == one event website."""

    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    event_type: Mapped[str] = mapped_column(String(32), default="wedding")
    status: Mapped[str] = mapped_column(String(32), default="draft")  # draft | generating | designing | published
    event_date: Mapped[str | None] = mapped_column(String(64))
    brief: Mapped[dict] = mapped_column(JSON, default=dict)
    reference_analysis: Mapped[dict | None] = mapped_column(JSON)
    # current editable design document (Design DSL)
    design: Mapped[dict | None] = mapped_column(JSON)
    design_version: Mapped[int] = mapped_column(Integer, default=0)
    slug: Mapped[str | None] = mapped_column(String(128), unique=True, index=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(512))

    owner: Mapped[User] = relationship(back_populates="projects")
    references: Mapped[list["Reference"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    assets: Mapped[list["Asset"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    generations: Mapped[list["Generation"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    design_versions: Mapped[list["DesignVersion"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    ai_edits: Mapped[list["AIEdit"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    publication: Mapped["Publication | None"] = relationship(back_populates="project", uselist=False, cascade="all, delete-orphan")
    rsvps: Mapped[list["Rsvp"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Reference(Base, TimestampMixin):
    """Inspiration board item (Pinterest-like)."""

    __tablename__ = "references"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    url: Mapped[str] = mapped_column(String(1024))
    storage_key: Mapped[str | None] = mapped_column(String(512))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text)
    group: Mapped[str | None] = mapped_column(String(64))
    palette: Mapped[list | None] = mapped_column(JSON)  # extracted dominant colors
    position: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped[Project] = relationship(back_populates="references")


class Asset(Base, TimestampMixin):
    """Media library item."""

    __tablename__ = "assets"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    url: Mapped[str] = mapped_column(String(1024))
    storage_key: Mapped[str | None] = mapped_column(String(512))
    filename: Mapped[str | None] = mapped_column(String(255))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    size: Mapped[int] = mapped_column(Integer, default=0)
    content_type: Mapped[str] = mapped_column(String(64), default="image/jpeg")

    project: Mapped[Project] = relationship(back_populates="assets")


class Generation(Base, TimestampMixin):
    """One run of the design pipeline → 3 concepts."""

    __tablename__ = "generations"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending | running | done | failed
    provider: Mapped[str] = mapped_column(String(32), default="rules")
    style_profile: Mapped[dict | None] = mapped_column(JSON)
    concepts: Mapped[list | None] = mapped_column(JSON)  # list[DesignDocument]
    error: Mapped[str | None] = mapped_column(Text)

    project: Mapped[Project] = relationship(back_populates="generations")


class DesignVersion(Base, TimestampMixin):
    """Snapshot history of the design document (server-side undo / restore)."""

    __tablename__ = "design_versions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    design: Mapped[dict] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(32), default="manual")  # manual | ai | concept | publish

    project: Mapped[Project] = relationship(back_populates="design_versions")


class AIEdit(Base, TimestampMixin):
    __tablename__ = "ai_edits"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    operations: Mapped[list] = mapped_column(JSON, default=list)
    applied: Mapped[bool] = mapped_column(Boolean, default=False)
    provider: Mapped[str] = mapped_column(String(32), default="rules")

    project: Mapped[Project] = relationship(back_populates="ai_edits")


class Publication(Base, TimestampMixin):
    __tablename__ = "publications"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    design: Mapped[dict] = mapped_column(JSON)  # frozen published snapshot
    is_live: Mapped[bool] = mapped_column(Boolean, default=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    custom_domain: Mapped[str | None] = mapped_column(String(255))
    views: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    project: Mapped[Project] = relationship(back_populates="publication")


class Rsvp(Base, TimestampMixin):
    __tablename__ = "rsvps"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    guests: Mapped[int] = mapped_column(Integer, default=1)
    attending: Mapped[bool | None] = mapped_column(Boolean)  # None = pending
    dietary: Mapped[str | None] = mapped_column(Text)
    message: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(String(255))

    project: Mapped[Project] = relationship(back_populates="rsvps")
