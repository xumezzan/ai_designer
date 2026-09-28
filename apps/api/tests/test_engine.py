from app.design.edit import propose_edit
from app.design.engine import analyze_references, generate_concepts
from app.design.lint import check_design
from app.design.palette import contrast
from app.design.schema import DesignDocument

BRIEF = {
    "hosts": "Humoyun & Malika", "date": "2027-07-18", "time": "16:00", "venue": "Villa Cimbrone", "city": "Ravello",
    "description": "Italian summer wedding, old money, elegant, warm ivory, olive green, dark brown, cinematic photography, minimal.",
}


def test_three_distinct_concepts():
    profile, concepts = generate_concepts(BRIEF, "wedding", None, [])
    assert len(concepts) == 3
    heroes = {c.sections[0].variant for c in concepts}
    fonts = {c.theme.typography.headingFont for c in concepts}
    assert len(heroes) == 3, "concepts must differ in hero composition"
    assert len(fonts) == 3, "concepts must differ in typography"
    for c in concepts:
        DesignDocument.model_validate(c.model_dump())
        assert contrast(c.theme.colors.text, c.theme.colors.background) > 6
        assert contrast(c.theme.colors.accent, c.theme.colors.accentText) > 3
        assert c.theme.decoration in ("none", "minimal")
        types = [s.type for s in c.sections]
        assert types[0] == "hero" and "rsvp" in types and types[-1] == "footer"


def test_palette_from_brief():
    profile, concepts = generate_concepts(BRIEF, "wedding", None, [])
    assert "olive" in profile["colorNames"] and "gold" not in profile["colorNames"]
    assert profile["summary"]["style"]


def test_event_types_have_expected_sections():
    _, [c, *_] = generate_concepts({"hosts": "Nova Labs", "title": "Nova Summit", "description": "tech conference"}, "corporate", None, [])
    assert "speakers" in [s.type for s in c.sections]
    _, [b, *_] = generate_concepts({"hosts": "Aziz", "age": "25", "description": "fun party"}, "birthday", None, [])
    assert "25" in b.sections[0].props["heading"]


def test_reference_analysis_shape():
    a = analyze_references([["#F4EFE6", "#66705A", "#4A3A2E"]], ["soft and warm"], "")
    for k in ("style", "colors", "typography", "composition", "mood", "decoration"):
        assert a[k]


def test_edit_operations_are_structured_and_targeted():
    _, concepts = generate_concepts(BRIEF, "wedding", None, [])
    doc = concepts[1].model_dump()
    r = propose_edit("Убери золотой цвет", doc)
    assert r.operations and all(o.target.startswith("theme") or o.target.startswith("#") for o in r.operations)
    r = propose_edit("Сделай заголовок меньше", doc)
    assert r.operations[0].property == "style.headingSize"
    r = propose_edit("Сделай RSVP более заметным", doc)
    assert any(o.action == "set_variant" for o in r.operations)
    r = propose_edit("добавь countdown", {**doc, "sections": [s for s in doc["sections"] if s["type"] != "countdown"]})
    assert r.operations[0].action == "add" and r.operations[0].section["type"] == "countdown"
    r = propose_edit("something totally unrelated", doc)
    assert r.operations == []


def test_lint_scores_generated_designs_well():
    _, concepts = generate_concepts(BRIEF, "wedding", None, ["/a.jpg", "/b.jpg", "/c.jpg", "/d.jpg", "/e.jpg"])
    for c in concepts:
        res = check_design(c.model_dump())
        assert res["score"] >= 80, res["issues"]
