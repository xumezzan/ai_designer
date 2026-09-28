"""Design checks (/ai/check-design).

Heuristics a senior designer would run before shipping: contrast,
hierarchy, over-decoration, missing imagery, mobile risks. Each issue
carries optional fix operations in the same structured format.
"""
from __future__ import annotations

from . import palette as P
from .schema import EditOperation


def check_design(doc: dict) -> dict:
    issues: list[dict] = []
    theme = doc["theme"]
    c = theme["colors"]
    sections = doc["sections"]

    def issue(severity: str, title: str, detail: str, ops: list[EditOperation] | None = None):
        issues.append({"severity": severity, "title": title, "detail": detail, "operations": [o.model_dump() for o in (ops or [])]})

    # contrast
    if P.contrast(c["text"], c["background"]) < 7:
        issue("warning", "Body text contrast is low", f"Text/background contrast is {P.contrast(c['text'], c['background']):.1f}:1; aim for ≥ 7:1.",
              [EditOperation(target="theme.colors", action="update", property="text", value=P.mix(c["text"], "#000000" if P.luminance(c["background"]) > 0.5 else "#FFFFFF", 0.4))])
    if P.contrast(c["accent"], c["accentText"]) < 4.5:
        issue("error", "Button text is hard to read", "Accent and accent-text contrast is below 4.5:1.",
              [EditOperation(target="theme.colors", action="update", property="accentText", value=P.readable_on(c["accent"]))])
    if P.contrast(c["muted"], c["background"]) < 3:
        issue("warning", "Muted text is too faint", "Eyebrows and labels may disappear on some screens.",
              [EditOperation(target="theme.colors", action="update", property="muted", value=P.mix(c["text"], c["background"], 0.4))])

    # decoration / noise
    ornaments = [s for s in sections if s["type"] == "divider" and s["variant"] == "ornament"]
    if theme["decoration"] == "moderate" or len(ornaments) > 1:
        issue("info", "Decoration could be quieter", "The layout will read as more premium with fewer ornaments.",
              [EditOperation(target="theme", action="update", property="decoration", value="minimal")] +
              [EditOperation(target=f"#{s['id']}", action="set_variant", value="line") for s in ornaments])
    accent_bands = [s for s in sections if s["style"].get("background") in ("accent", "dark")]
    if len(accent_bands) > 2:
        issue("info", "Too many full-bleed colour bands", "More than two accent/dark bands compete for attention.",
              [EditOperation(target=f"#{s['id']}", action="update", property="style.background", value="surface") for s in accent_bands[2:]])

    # hierarchy
    hero = next((s for s in sections if s["type"] == "hero"), None)
    if hero:
        h = hero["props"].get("heading") or ""
        if len(h) > 48:
            issue("warning", "Hero heading is long", "Long display headings wrap awkwardly on phones. Consider a shorter line or a smaller size.",
                  [EditOperation(target="hero", action="update", property="style.headingSize", value="lg")])
        if hero["variant"] == "fullscreen" and not hero["props"].get("image"):
            issue("error", "Fullscreen hero without an image", "Add a photograph or switch to a typographic hero.",
                  [EditOperation(target="hero", action="set_variant", value="minimal")])
        if not hero["props"].get("date"):
            issue("info", "No date in the hero", "Guests look for the date first.")
    if not hero:
        issue("error", "Missing hero", "Every event site needs an opening section.")
    xl = [s for s in sections if s["style"].get("headingSize") == "xl" and s["type"] != "hero"]
    if xl:
        issue("info", "Several display-size headings", "Only the hero should use the XL heading size.",
              [EditOperation(target=f"#{s['id']}", action="update", property="style.headingSize", value="md") for s in xl])

    # imagery
    empty_gallery = [s for s in sections if s["type"] == "gallery" and not any(i.get("src") for i in s["props"].get("images", []))]
    for s in empty_gallery:
        issue("warning", "Gallery has no photos", "Upload images in Assets or hide the gallery until you have them.",
              [EditOperation(target=f"#{s['id']}", action="update", property="visible", value=False)])

    # mobile
    if theme["typography"]["scale"] == "display" and theme["spacing"] == "airy":
        issue("info", "Mobile density", "Display type + airy spacing can feel sparse on phones; consider 'comfortable' spacing.",
              [EditOperation(target="theme", action="update", property="spacing", value="comfortable")])

    # rsvp
    if not any(s["type"] == "rsvp" for s in sections):
        issue("warning", "No RSVP section", "Guests can't reply without one.")

    score = max(0, 100 - sum({"error": 25, "warning": 10, "info": 4}[i["severity"]] for i in issues))
    return {"score": score, "issues": issues}
