import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.storage import get_storage, optimize_image
from app.models.models import Asset, Project
from app.schemas.api import AssetOut
from .deps import get_project

router = APIRouter(prefix="/projects/{project_id}/assets", tags=["assets"])


@router.get("", response_model=list[AssetOut])
def list_assets(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    return db.scalars(select(Asset).where(Asset.project_id == p.id).order_by(Asset.created_at.desc())).all()


@router.post("", response_model=AssetOut)
async def upload(file: UploadFile = File(...), p: Project = Depends(get_project), db: Session = Depends(get_db)):
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "Image too large (25 MB max)")
    try:
        optimized, w, h, ct = optimize_image(data, max_side=2200)
    except Exception:
        raise HTTPException(400, "Unsupported image")
    stored = get_storage().put(optimized, ".jpg" if ct == "image/jpeg" else ".png", ct, prefix=f"assets/{p.id}")
    a = Asset(project_id=p.id, url=stored.url, storage_key=stored.key, filename=file.filename, width=w, height=h, size=len(optimized), content_type=ct)
    db.add(a)
    db.commit()
    return a


@router.delete("/{asset_id}")
def delete(asset_id: str, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    a = db.get(Asset, asset_id)
    if not a or a.project_id != p.id:
        raise HTTPException(404)
    if a.storage_key:
        try:
            get_storage().delete(a.storage_key)
        except OSError:
            pass
    db.delete(a)
    db.commit()
    return {"ok": True}
