from sqlalchemy import select

from app.ai.service import ai_service
from app.core.db import SessionLocal
from app.models.models import Asset, Generation, Project, Reference
from .celery_app import celery_app


@celery_app.task(name="invito.generate_design")
def run_generation(generation_id: str) -> None:
    db = SessionLocal()
    try:
        gen = db.get(Generation, generation_id)
        if not gen:
            return
        gen.status = "running"
        db.commit()
        p = db.get(Project, gen.project_id)
        assets = db.scalars(select(Asset).where(Asset.project_id == p.id).order_by(Asset.created_at)).all()
        refs = db.scalars(select(Reference).where(Reference.project_id == p.id).order_by(Reference.position)).all()
        images = [a.url for a in assets] or [r.url for r in refs][:6]
        profile, concepts = ai_service.generate_concepts(p.brief or {}, p.event_type, p.reference_analysis, images)
        gen.style_profile = profile
        gen.concepts = [c.model_dump() for c in concepts]
        gen.status = "done"
        gen.provider = ai_service.provider.name
        p.status = "generating" if not p.design else p.status
        db.commit()
    except Exception as e:  # noqa: BLE001
        gen = db.get(Generation, generation_id)
        if gen:
            gen.status = "failed"
            gen.error = str(e)
            db.commit()
        raise
    finally:
        db.close()
