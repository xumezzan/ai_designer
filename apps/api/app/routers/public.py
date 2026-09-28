"""Unauthenticated endpoints used by published event sites."""
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import verify_password
from app.models.models import Publication, Rsvp
from app.schemas.api import RsvpIn

router = APIRouter(prefix="/public", tags=["public"])


def _live(slug: str, db: Session) -> Publication:
    pub = db.scalar(select(Publication).where(Publication.slug == slug))
    if not pub or not pub.is_live:
        raise HTTPException(404, "This event site is not available")
    return pub


@router.get("/sites/{slug}")
def get_site(slug: str, db: Session = Depends(get_db), x_site_password: str | None = Header(default=None)):
    pub = _live(slug, db)
    if pub.password_hash:
        if not x_site_password or not verify_password(x_site_password, pub.password_hash):
            raise HTTPException(401, "Password required")
    pub.views += 1
    db.commit()
    return {"slug": pub.slug, "design": pub.design, "published_at": pub.published_at, "project_id": pub.project_id}


@router.post("/sites/{slug}/rsvp")
def submit_rsvp(slug: str, body: RsvpIn, db: Session = Depends(get_db)):
    pub = _live(slug, db)
    r = Rsvp(project_id=pub.project_id, **body.model_dump())
    db.add(r)
    db.commit()
    return {"ok": True, "id": r.id}


# ------------------------------------------------------------------
# Showcase — real, renderable design documents for the landing page.
# Images live in the web app's /public/stock folder.
# ------------------------------------------------------------------
from functools import lru_cache  # noqa: E402

from app.design.directions import DIRECTION_BY_ID  # noqa: E402
from app.design.engine import build_style_profile, compose_concept  # noqa: E402

SHOWCASE = [
    ("editorial_romance", "wedding", {"hosts": "Humoyun & Malika", "date": "2027-07-18", "time": "16:30", "venue": "Villa Cimbrone", "city": "Ravello, Italy",
      "description": "Italian summer wedding, old money, elegant, warm ivory, olive green, dark brown, cinematic photography, minimal.", "dressCode": "Black tie optional"},
     ["/stock/wedding-1.jpg", "/stock/wedding-2.jpg", "/stock/wedding-3.jpg", "/stock/wedding-1.jpg", "/stock/wedding-2.jpg"]),
    ("quiet_luxury", "wedding", {"hosts": "Sofia & Daniel", "date": "2027-09-04", "time": "17:00", "venue": "The Orangery", "city": "Kew, London",
      "description": "quiet luxury, minimal, ivory, charcoal, timeless", "dressCode": "Formal"},
     ["/stock/wedding-3.jpg", "/stock/wedding-2.jpg", "/stock/wedding-1.jpg", "/stock/wedding-3.jpg"]),
    ("modern_monochrome", "party", {"title": "Aziz turns 30", "hosts": "Aziz", "date": "2027-03-12", "time": "21:00", "venue": "Rooftop 21", "city": "Tashkent",
      "description": "urban rooftop party, black and white, modern, bold", "dressCode": "All black"},
     ["/stock/party-1.jpg", "/stock/party-1.jpg", "/stock/party-1.jpg", "/stock/party-1.jpg"]),
    ("corporate_clarity", "corporate", {"title": "Nova Summit 2027", "hosts": "Nova Labs", "date": "2027-05-20", "time": "09:00", "venue": "Congress Hall", "city": "Berlin",
      "description": "tech conference, clean, professional, navy and white"},
     ["/stock/corporate-1.jpg", "/stock/corporate-1.jpg"]),
    ("warm_film", "birthday", {"hosts": "Malika", "age": "25", "date": "2027-08-09", "time": "19:00", "venue": "Casa Verde", "city": "Lisbon",
      "description": "warm film, terrace dinner, cozy, caramel, cocoa, oat"},
     ["/stock/birthday-1.jpg", "/stock/birthday-1.jpg", "/stock/wedding-2.jpg", "/stock/birthday-1.jpg"]),
    ("botanical_calm", "baby_shower", {"title": "A little one is on the way", "hosts": "Nilufar", "date": "2027-04-18", "time": "14:00", "venue": "Garden House", "city": "Samarkand",
      "description": "garden, soft, sage, linen, calm, botanical"},
     ["/stock/wedding-2.jpg", "/stock/wedding-3.jpg", "/stock/wedding-1.jpg", "/stock/wedding-2.jpg"]),
]


@lru_cache
def _showcase() -> list[dict]:
    out = []
    for i, (did, et, brief, images) in enumerate(SHOWCASE):
        profile = build_style_profile(brief, et, None)
        doc = compose_concept(DIRECTION_BY_ID[did], profile, brief, et, images, i)
        out.append(doc.model_dump())
    return out


@router.get("/showcase")
def showcase():
    return _showcase()
