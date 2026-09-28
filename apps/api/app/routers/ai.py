"""AI service endpoints.

/ai/analyze-references · /ai/generate-design · /ai/edit-design ·
/ai/generate-copy · /ai/check-design
"""
import copy

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.service import ai_service
from app.core.db import get_db
from app.design.schema import DesignDocument
from app.models.models import AIEdit, Asset, DesignVersion, Generation, Project, Reference
from app.schemas.api import CheckIn, EditIn, EditOut, GenerationOut, ProjectOut, SelectConceptIn
from app.workers.tasks import run_generation
from .deps import get_project
from .projects import to_out

router = APIRouter(prefix="/projects/{project_id}/ai", tags=["ai"])


@router.post("/analyze-references")
def analyze_references(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    refs = db.scalars(select(Reference).where(Reference.project_id == p.id).order_by(Reference.position)).all()
    brief_text = " ".join(str(v) for v in (p.brief or {}).values() if isinstance(v, str))
    analysis = ai_service.analyze_references([r.palette or [] for r in refs], [r.note or "" for r in refs], brief_text)
    analysis["referenceCount"] = len(refs)
    p.reference_analysis = analysis
    db.commit()
    return analysis


@router.post("/generate-design", response_model=GenerationOut)
def generate_design(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    gen = Generation(project_id=p.id, status="pending", provider=ai_service.provider.name)
    db.add(gen)
    db.commit()
    run_generation.delay(gen.id)
    db.refresh(gen)
    return gen


@router.get("/generations/{generation_id}", response_model=GenerationOut)
def get_generation(generation_id: str, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    gen = db.get(Generation, generation_id)
    if not gen or gen.project_id != p.id:
        raise HTTPException(404)
    return gen


@router.get("/generations", response_model=list[GenerationOut])
def list_generations(p: Project = Depends(get_project), db: Session = Depends(get_db)):
    return db.scalars(select(Generation).where(Generation.project_id == p.id).order_by(Generation.created_at.desc()).limit(5)).all()


@router.post("/select-concept", response_model=ProjectOut)
def select_concept(body: SelectConceptIn, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    gen = db.get(Generation, body.generation_id)
    if not gen or gen.project_id != p.id or not gen.concepts:
        raise HTTPException(404, "Generation not found")
    if body.index < 0 or body.index >= len(gen.concepts):
        raise HTTPException(400, "Bad concept index")
    p.design = copy.deepcopy(gen.concepts[body.index])
    p.design_version += 1
    p.status = "designing"
    db.add(DesignVersion(project_id=p.id, version=p.design_version, design=p.design, source="concept"))
    db.commit()
    return to_out(p, db)


@router.post("/edit-design", response_model=EditOut)
def edit_design(body: EditIn, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    doc = body.design or p.design
    if not doc:
        raise HTTPException(400, "Project has no design yet")
    try:
        DesignDocument.model_validate(doc)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"Invalid design: {e}")
    assets = [a.url for a in db.scalars(select(Asset).where(Asset.project_id == p.id).order_by(Asset.created_at)).all()]
    proposal = ai_service.propose_edit(body.prompt, doc, assets)
    rec = AIEdit(project_id=p.id, prompt=body.prompt, summary=proposal.summary, operations=[o.model_dump() for o in proposal.operations], provider=ai_service.provider.name)
    db.add(rec)
    db.commit()
    return EditOut(id=rec.id, summary=proposal.summary, operations=rec.operations, provider=rec.provider)


@router.post("/edits/{edit_id}/applied")
def mark_applied(edit_id: str, p: Project = Depends(get_project), db: Session = Depends(get_db)):
    rec = db.get(AIEdit, edit_id)
    if rec and rec.project_id == p.id:
        rec.applied = True
        db.commit()
    return {"ok": True}


@router.post("/check-design")
def check_design(body: CheckIn, p: Project = Depends(get_project)):
    return ai_service.check_design(body.design)


@router.post("/generate-copy")
def generate_copy(body: CheckIn, p: Project = Depends(get_project)):
    return ai_service.generate_copy(body.design, p.brief or {})
