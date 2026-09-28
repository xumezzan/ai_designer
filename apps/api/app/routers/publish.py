import base64
import io

import qrcode
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import hash_password
from app.models.models import Project, Publication
from app.schemas.api import PublicationOut, PublishIn
from .deps import get_project
from .projects import unique_slug

router = APIRouter(prefix="/projects/{project_id}/publish", tags=["publishing"])
settings = get_settings()


def pub_out(pub: Publication) -> PublicationOut:
    return PublicationOut(slug=pub.slug, is_live=pub.is_live, url=f"{settings.public_site_base_url}/e/{pub.slug}",
                          published_at=pub.published_at, views=pub.views, has_password=bool(pub.password_hash))


@router.get("", response_model=PublicationOut | None)
def get_publication(p: Project = Depends(get_project)):
    return pub_out(p.publication) if p.publication else None


@router.post("", response_model=PublicationOut)
def publish(body: PublishIn, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    if not p.design:
        raise HTTPException(400, "Nothing to publish yet")
    pub = p.publication
    slug = unique_slug(db, body.slug or p.name, exclude_project=p.id)
    if pub:
        pub.slug, pub.design, pub.is_live = slug, p.design, True
        from datetime import datetime, timezone
        pub.published_at = datetime.now(timezone.utc)
    else:
        pub = Publication(project_id=p.id, slug=slug, design=p.design, is_live=True)
        db.add(pub)
    if body.password is not None:
        pub.password_hash = hash_password(body.password) if body.password else None
    p.slug = slug
    p.status = "published"
    db.commit()
    db.refresh(pub)
    return pub_out(pub)


@router.delete("", response_model=PublicationOut)
def unpublish(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    if not p.publication:
        raise HTTPException(404, "Not published")
    p.publication.is_live = False
    p.status = "designing"
    db.commit()
    return pub_out(p.publication)


@router.get("/qr")
def qr(p: Project = Depends(get_project)):
    if not p.publication:
        raise HTTPException(404, "Not published")
    url = f"{settings.public_site_base_url}/e/{p.publication.slug}"
    img = qrcode.make(url, box_size=12, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return {"url": url, "png_base64": base64.b64encode(buf.getvalue()).decode()}
