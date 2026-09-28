import copy
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import get_current_user
from app.design.schema import DesignDocument
from app.models.models import DesignVersion, Project, Publication, Rsvp, User
from app.schemas.api import DesignSave, ProjectCreate, ProjectOut, ProjectUpdate
from .deps import get_project

router = APIRouter(prefix="/projects", tags=["projects"])
settings = get_settings()


def slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:48] or "event"


def to_out(p: Project, db: Session) -> ProjectOut:
    out = ProjectOut.model_validate(p)
    pub = p.publication
    out.is_published = bool(pub and pub.is_live)
    out.public_url = f"{settings.public_site_base_url}/e/{pub.slug}" if pub and pub.is_live else None
    out.rsvp_count = db.scalar(select(func.count(Rsvp.id)).where(Rsvp.project_id == p.id)) or 0
    return out


@router.get("", response_model=list[ProjectOut])
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Project).where(Project.owner_id == user.id).order_by(Project.updated_at.desc())).all()
    return [to_out(p, db) for p in rows]


@router.post("", response_model=ProjectOut)
def create_project(body: ProjectCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = Project(owner_id=user.id, name=body.name, event_type=body.event_type, brief=body.brief, event_date=body.brief.get("date"))
    db.add(p)
    db.commit()
    return to_out(p, db)


@router.get("/{project_id}", response_model=ProjectOut)
def get_one(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    return to_out(p, db)


@router.patch("/{project_id}", response_model=ProjectOut)
def update(body: ProjectUpdate, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    if body.brief and body.brief.get("date"):
        p.event_date = body.brief["date"]
    db.commit()
    return to_out(p, db)


@router.delete("/{project_id}")
def delete(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/duplicate", response_model=ProjectOut)
def duplicate(p: Project = Depends(get_project), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = Project(owner_id=user.id, name=f"{p.name} (copy)", event_type=p.event_type, brief=copy.deepcopy(p.brief),
                event_date=p.event_date, reference_analysis=copy.deepcopy(p.reference_analysis), design=copy.deepcopy(p.design),
                status="designing" if p.design else "draft")
    db.add(q)
    db.commit()
    return to_out(q, db)


@router.put("/{project_id}/design", response_model=ProjectOut)
def save_design(body: DesignSave, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    try:
        doc = DesignDocument.model_validate(body.design)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"Invalid design document: {e}")
    p.design = doc.model_dump()
    p.design_version += 1
    if p.status in ("draft", "generating"):
        p.status = "designing"
    db.add(DesignVersion(project_id=p.id, version=p.design_version, design=p.design, source=body.source))
    # keep last 50 versions
    old = db.scalars(select(DesignVersion).where(DesignVersion.project_id == p.id).order_by(DesignVersion.version.desc()).offset(50)).all()
    for v in old:
        db.delete(v)
    db.commit()
    return to_out(p, db)


@router.get("/{project_id}/versions")
def versions(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    rows = db.scalars(select(DesignVersion).where(DesignVersion.project_id == p.id).order_by(DesignVersion.version.desc()).limit(30)).all()
    return [{"id": v.id, "version": v.version, "source": v.source, "created_at": v.created_at, "conceptName": (v.design.get("meta") or {}).get("direction")} for v in rows]


@router.post("/{project_id}/versions/{version_id}/restore", response_model=ProjectOut)
def restore(version_id: str, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    v = db.get(DesignVersion, version_id)
    if not v or v.project_id != p.id:
        raise HTTPException(404, "Version not found")
    p.design = copy.deepcopy(v.design)
    p.design_version += 1
    db.add(DesignVersion(project_id=p.id, version=p.design_version, design=p.design, source="restore"))
    db.commit()
    return to_out(p, db)


def unique_slug(db: Session, base: str, exclude_project: str | None = None) -> str:
    slug = slugify(base)
    candidate = slug
    while True:
        existing = db.scalar(select(Publication).where(Publication.slug == candidate))
        if not existing or existing.project_id == exclude_project:
            return candidate
        candidate = f"{slug}-{secrets.token_hex(2)}"
