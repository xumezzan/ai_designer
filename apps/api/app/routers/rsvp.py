from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.models import Project, Rsvp
from app.schemas.api import RsvpOut, RsvpStats
from .deps import get_project

router = APIRouter(prefix="/projects/{project_id}/rsvps", tags=["rsvp"])


@router.get("", response_model=list[RsvpOut])
def list_rsvps(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    return db.scalars(select(Rsvp).where(Rsvp.project_id == p.id).order_by(Rsvp.created_at.desc())).all()


@router.get("/stats", response_model=RsvpStats)
def stats(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    rows = db.scalars(select(Rsvp).where(Rsvp.project_id == p.id)).all()
    return RsvpStats(
        total_responses=len(rows),
        total_guests=sum(r.guests for r in rows if r.attending),
        confirmed=sum(r.guests for r in rows if r.attending is True),
        declined=sum(1 for r in rows if r.attending is False),
        pending=sum(1 for r in rows if r.attending is None),
    )


@router.delete("/{rsvp_id}")
def delete(rsvp_id: str, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    r = db.get(Rsvp, rsvp_id)
    if not r or r.project_id != p.id:
        raise HTTPException(404)
    db.delete(r)
    db.commit()
    return {"ok": True}
