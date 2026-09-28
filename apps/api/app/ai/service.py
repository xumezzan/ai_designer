"""AI service layer — orchestrates providers + the deterministic design engine.

Endpoints (routers/ai.py) call only this module.
"""
from __future__ import annotations

import json
from collections import Counter

from app.design import engine
from app.design.edit import propose_edit as rules_propose_edit
from app.design.lint import check_design as rules_check_design
from app.design.schema import DesignDocument, EditOperation, EditProposal
from . import prompts
from .providers import get_provider


class AIService:
    def __init__(self):
        self.provider = get_provider()

    # -- 1. references ------------------------------------------------
    def analyze_references(self, palettes: list[list[str]], notes: list[str], brief_text: str = "") -> dict:
        return engine.analyze_references(palettes, notes, brief_text)

    # -- 2..6 design generation -----------------------------------------
    def generate_concepts(self, brief: dict, event_type: str, reference_analysis: dict | None, images: list[str]):
        profile = engine.build_style_profile(brief, event_type, reference_analysis)
        llm = self.provider.complete_json(
            prompts.STYLE_PROFILE_SYSTEM,
            json.dumps({"eventType": event_type, "brief": brief, "referenceSummary": reference_analysis}, ensure_ascii=False),
            max_tokens=600,
        )
        if llm and isinstance(llm.get("tags"), dict):
            tags = Counter(profile["tags"])
            for k, v in llm["tags"].items():
                if k in engine.TAG_WORDS:
                    tags[k] += float(v)
            profile["tags"] = dict(tags)
            if llm.get("colorNames"):
                profile["colorNames"] = [c for c in llm["colorNames"] if c in engine.P.NAMED_COLORS] or profile["colorNames"]
            profile["wantsDark"] = bool(llm.get("wantsDark", profile["wantsDark"]))
            profile["summary"] = engine.summarize_profile(tags, profile["colorNames"], profile["referenceHex"], event_type)
        directions = engine.select_directions(profile, 3)
        concepts = [engine.compose_concept(d, profile, brief, event_type, images, i) for i, d in enumerate(directions)]
        return profile, concepts

    # -- AI chat edits --------------------------------------------------
    def propose_edit(self, prompt: str, doc: dict, assets: list[str] | None = None) -> EditProposal:
        llm = self.provider.complete_json(
            prompts.EDIT_SYSTEM,
            "Request: " + prompt + "\n\nDesign JSON:\n" + json.dumps(doc, ensure_ascii=False)[:60000],
            max_tokens=1500,
        )
        if llm and isinstance(llm.get("operations"), list) and llm["operations"]:
            try:
                ops = [EditOperation.model_validate(o) for o in llm["operations"]]
                return EditProposal(summary=str(llm.get("summary") or "Applied your request."), operations=ops)
            except Exception:
                pass
        return rules_propose_edit(prompt, doc, assets)

    def check_design(self, doc: dict) -> dict:
        return rules_check_design(doc)

    def generate_copy(self, doc: dict, brief: dict) -> dict:
        llm = self.provider.complete_json(
            prompts.COPY_SYSTEM,
            json.dumps({"brief": brief, "sections": [{"id": s["id"], "type": s["type"], "props": {k: v for k, v in s["props"].items() if k in ("heading", "subheading", "body", "eyebrow")}} for s in doc["sections"]]}, ensure_ascii=False),
            max_tokens=1500,
        )
        ops: list[dict] = []
        if llm:
            for sid, fields in llm.items():
                if not isinstance(fields, dict):
                    continue
                for k, v in fields.items():
                    if k in ("heading", "subheading", "body", "eyebrow") and isinstance(v, str):
                        ops.append({"target": f"#{sid}", "action": "update", "property": k, "value": v})
        return {"summary": "Refined copy." if ops else "No LLM provider configured — copy left as is.", "operations": ops}


ai_service = AIService()
