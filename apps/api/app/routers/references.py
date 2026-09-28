import os

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.storage import get_storage, optimize_image
from app.design.engine import extract_image_palette
from app.models.models import Project, Reference
from app.schemas.api import ReferenceFromUrl, ReferenceOut, ReferenceUpdate
from .deps import get_project

router = APIRouter(prefix="/projects/{project_id}/references", tags=["references"])


def _store_reference(db: Session, p: Project, data: bytes, note: str | None) -> Reference:
    try:
        optimized, w, h, ct = optimize_image(data, max_side=1600)
    except Exception:
        raise HTTPException(400, "Unsupported image")
    stored = get_storage().put(optimized, ".jpg" if ct == "image/jpeg" else ".png", ct, prefix=f"references/{p.id}")
    palette = extract_image_palette(optimized)
    pos = (db.scalar(select(Reference.position).where(Reference.project_id == p.id).order_by(Reference.position.desc())) or 0) + 1
    ref = Reference(project_id=p.id, url=stored.url, storage_key=stored.key, width=w, height=h, palette=palette, note=note, position=pos)
    db.add(ref)
    db.commit()
    return ref


@router.get("", response_model=list[ReferenceOut])
def list_refs(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    return db.scalars(select(Reference).where(Reference.project_id == p.id).order_by(Reference.position)).all()


@router.post("", response_model=ReferenceOut)
async def upload(file: UploadFile = File(...), note: str | None = None, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "Image too large (15 MB max)")
    return _store_reference(db, p, data, note)


@router.post("/from-url", response_model=ReferenceOut)
def from_url(body: ReferenceFromUrl, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    try:
        r = httpx.get(body.url, timeout=20, follow_redirects=True, headers={"User-Agent": "InvitoAI/1.0"})
        r.raise_for_status()
    except Exception:
        raise HTTPException(400, "Could not fetch that URL")
    return _store_reference(db, p, r.content, body.note)


@router.patch("/{ref_id}", response_model=ReferenceOut)
def update(ref_id: str, body: ReferenceUpdate, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    ref = db.get(Reference, ref_id)
    if not ref or ref.project_id != p.id:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(ref, k, v)
    db.commit()
    return ref


@router.delete("/{ref_id}")
def delete(ref_id: str, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    ref = db.get(Reference, ref_id)
    if not ref or ref.project_id != p.id:
        raise HTTPException(404)
    if ref.storage_key:
        try:
            get_storage().delete(ref.storage_key)
        except OSError:
            pass
    db.delete(ref)
    db.commit()
    return {"ok": True}
