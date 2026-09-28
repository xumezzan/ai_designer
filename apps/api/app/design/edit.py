"""Natural-language → structured edit operations (rules engine).

This is the provider-independent fallback for the AI Designer chat. It
understands the most common design requests in English and Russian and
emits *only* structured operations against the Design DSL, so a request
can never break the site. An LLM provider produces the same operation
format (see app/ai/providers) and is validated against the same schema.
"""
from __future__ import annotations

import re
from typing import Any

from . import palette as P
from .schema import EditOperation, EditProposal

SERIF_MODERN = "Fraunces"
SANS_MODERN = "Manrope"
SERIF_CLASSIC = "Cormorant Garamond"
SERIF_LUX = "Libre Caslon Text"

SIZE_ORDER = ["sm", "md", "lg", "xl"]
SPACING_ORDER = ["compact", "comfortable", "airy"]
DECOR_ORDER = ["none", "minimal", "moderate"]
RADIUS_ORDER = ["none", "sm", "md", "lg"]
SCALE_ORDER = ["compact", "regular", "display"]

SECTION_WORDS = {
    "hero": ["hero", "first screen", "первый экран", "главный экран", "шапк", "обложк", "заглав", "top of", "landing"],
    "rsvp": ["rsvp", "форм", "registration", "регистрац", "ответ"],
    "gallery": ["gallery", "галере", "photos", "фото", "картинк"],
    "story": ["story", "истори", "about", "о нас"],
    "schedule": ["schedule", "расписани", "program", "программ", "agenda", "тайминг", "timeline"],
    "event_details": ["details", "детал", "when & where", "информац"],
    "countdown": ["countdown", "таймер", "обратный отсчет", "обратный отсчёт", "counter"],
    "quote": ["quote", "цитат"],
    "map": ["map", "карт", "location", "локац"],
    "footer": ["footer", "подвал", "футер"],
    "speakers": ["speaker", "спикер"],
    "dress_code": ["dress code", "дресс", "дресс-код"],
}

FONT_ALIASES = {
    "cormorant": "Cormorant Garamond", "playfair": "Playfair Display", "fraunces": "Fraunces", "caslon": "Libre Caslon Text",
    "newsreader": "Newsreader", "instrument": "Instrument Serif", "bodoni": "Bodoni Moda", "dm serif": "DM Serif Display",
    "garamond": "EB Garamond", "inter": "Inter", "dm sans": "DM Sans", "manrope": "Manrope", "work sans": "Work Sans",
    "space grotesk": "Space Grotesk", "grotesk": "Space Grotesk", "karla": "Karla", "jost": "Jost", "figtree": "Figtree", "outfit": "Outfit",
}


def _step(order: list[str], cur: str, delta: int) -> str:
    i = max(0, order.index(cur) if cur in order else 1)
    return order[max(0, min(len(order) - 1, i + delta))]


def _has(t: str, *words: str) -> bool:
    return any(w in t for w in words)


def _sections(doc: dict) -> list[dict]:
    return doc.get("sections", [])


def _first(doc: dict, typ: str) -> dict | None:
    return next((s for s in _sections(doc) if s["type"] == typ), None)


def detect_target_section(t: str) -> str | None:
    for typ, words in SECTION_WORDS.items():
        if _has(t, *words):
            return typ
    return None


def _upd(target: str, prop: str, value: Any) -> EditOperation:
    return EditOperation(target=target, action="update", property=prop, value=value)


def propose_edit(prompt: str, doc: dict, assets: list[str] | None = None) -> EditProposal:
    t = prompt.lower().strip()
    theme = doc["theme"]
    colors = theme["colors"]
    typo = theme["typography"]
    ops: list[EditOperation] = []
    notes: list[str] = []
    target = detect_target_section(t)
    hero = _first(doc, "hero")

    # ---------------- explicit text replacement ----------------
    m = re.search(r"(?:заголовок|heading|title|headline)\s*(?:на|to|:)\s*[\"«'“](.+?)[\"»'”]", prompt, re.I)
    if m:
        sec = target or "hero"
        ops.append(_upd(sec, "heading", m.group(1)))
        notes.append(f"Updated the {sec} heading.")
        return EditProposal(summary=" ".join(notes), operations=ops)

    # ---------------- fonts ----------------
    for alias, font in FONT_ALIASES.items():
        if alias in t and _has(t, "font", "шрифт", "typeface", "гарнитур"):
            ops.append(_upd("theme.typography", "headingFont", font))
            notes.append(f"Heading font → {font}.")
            break
    if not any(o.property == "headingFont" for o in ops):
        if _has(t, "serif") and _has(t, "modern", "современ", "sans", "гротеск", "без засеч"):
            ops.append(_upd("theme.typography", "headingFont", SANS_MODERN))
            ops.append(_upd("theme.typography", "headingItalic", False))
            ops.append(_upd("theme.typography", "headingWeight", 500))
            notes.append("Replaced the serif display with a contemporary sans (Manrope).")
        elif _has(t, "more modern font", "современнее шрифт", "шрифт современ", "modern typeface"):
            ops.append(_upd("theme.typography", "headingFont", SERIF_MODERN))
            notes.append("Switched to a more contemporary serif (Fraunces).")
        elif _has(t, "classic font", "классический шрифт", "more classic", "классичнее", "serif font", "с засечками"):
            ops.append(_upd("theme.typography", "headingFont", SERIF_CLASSIC))
            notes.append("Switched to a classic high-contrast serif.")

    # ---------------- colours ----------------
    mentioned = P.colors_in_text(t)
    if _has(t, "убери", "убрать", "remove", "без ", "no ", "не использ") and mentioned:
        c = mentioned[0]
        cur_name = P.nearest_name(colors["accent"])
        # replace accent with a restrained tone derived from text colour
        new_accent = P.mix(colors["text"], colors["background"], 0.25)
        ops.append(_upd("theme.colors", "accent", new_accent))
        ops.append(_upd("theme.colors", "accentText", P.readable_on(new_accent)))
        notes.append(f"Removed {c} — the accent is now a quiet {P.nearest_name(new_accent)} derived from the text colour" + (f" (was {cur_name})." if cur_name != c else "."))
        # also neutralise accent-backgrounds
        for s in _sections(doc):
            if s["style"].get("background") == "accent":
                ops.append(_upd(f"#{s['id']}", "style.background", "surface"))
    elif mentioned and _has(t, "только для акцент", "only for accent", "as accent", "для акцент", "accent"):
        acc = P.NAMED_COLORS[mentioned[0]]
        ops.append(_upd("theme.colors", "accent", acc))
        ops.append(_upd("theme.colors", "accentText", P.readable_on(acc)))
        for s in _sections(doc):
            if s["style"].get("background") == "accent":
                ops.append(_upd(f"#{s['id']}", "style.background", "default"))
        notes.append(f"{mentioned[0].title()} is now used only for accents (buttons, rules); full-bleed accent backgrounds were removed.")
    elif mentioned and _has(t, "фон", "background"):
        bg = P.NAMED_COLORS[mentioned[0]]
        dark = P.luminance(bg) < 0.3
        ops.append(_upd("theme.colors", "background", bg))
        ops.append(_upd("theme.colors", "surface", P.mix(bg, colors["text"] if not dark else "#FFFFFF", 0.05)))
        if dark:
            ops.append(_upd("theme.colors", "text", "#F1ECE2"))
            ops.append(_upd("theme.colors", "muted", P.mix("#F1ECE2", bg, 0.45)))
        notes.append(f"Background → {mentioned[0]}.")
    elif mentioned and _has(t, "цвет", "color", "colour", "palette", "палитр", "сделай", "make", "use", "использ"):
        acc = P.NAMED_COLORS[mentioned[0]]
        if P.contrast(acc, colors["background"]) < 2.2:
            acc = P.with_lightness(acc, 0.38)
        ops.append(_upd("theme.colors", "accent", acc))
        ops.append(_upd("theme.colors", "accentText", P.readable_on(acc)))
        notes.append(f"Accent → {mentioned[0]}.")

    if _has(t, "тепле", "warmer", "warm"):
        if _has(t, "фон", "background") or not mentioned:
            ops.append(_upd("theme.colors", "background", P.shift_warmth(colors["background"], 1.5)))
            ops.append(_upd("theme.colors", "surface", P.shift_warmth(colors["surface"], 1.5)))
            notes.append("Warmed the background and surfaces slightly.")
    if _has(t, "холодн", "cooler", "colder"):
        ops.append(_upd("theme.colors", "background", P.shift_warmth(colors["background"], -1.5)))
        ops.append(_upd("theme.colors", "surface", P.shift_warmth(colors["surface"], -1.5)))
        notes.append("Cooled the background slightly.")
    if _has(t, "темнее", "darker") and _has(t, "фон", "background", "тем"):
        ops.append(_upd("theme.colors", "background", P.mix(colors["background"], "#000000", 0.06)))
        ops.append(_upd("theme.colors", "surface", P.mix(colors["surface"], "#000000", 0.06)))
        notes.append("Darkened the background a touch.")
    if _has(t, "светлее", "lighter", "brighter") and _has(t, "фон", "background"):
        ops.append(_upd("theme.colors", "background", P.mix(colors["background"], "#FFFFFF", 0.35)))
        ops.append(_upd("theme.colors", "surface", P.mix(colors["surface"], "#FFFFFF", 0.3)))
        notes.append("Lightened the background.")
    if _has(t, "dark mode", "dark theme", "тёмная тема", "темная тема", "сделай тёмн", "сделай темн", "make it dark"):
        bg = P.mix(colors["text"], "#0E0D0C", 0.6)
        ops += [
            _upd("theme.colors", "background", bg),
            _upd("theme.colors", "surface", P.mix(bg, "#FFFFFF", 0.06)),
            _upd("theme.colors", "text", colors["background"]),
            _upd("theme.colors", "muted", P.mix(colors["background"], bg, 0.45)),
        ]
        if P.contrast(colors["accent"], bg) < 2.5:
            acc = P.with_lightness(colors["accent"], 0.64)
            ops += [_upd("theme.colors", "accent", acc), _upd("theme.colors", "accentText", P.readable_on(acc))]
        notes.append("Inverted the palette into a dark theme while keeping the accent readable.")

    # ---------------- minimal / decoration ----------------
    mobile_req = _has(t, "мобиль", "mobile", "телефон", "phone", "smartphone")
    if _has(t, "минимал", "minimal", "проще", "simpler", "less clutter", "меньше шум") or (_has(t, "cleaner", "чище") and not mobile_req):
        ops.append(_upd("theme", "decoration", "none"))
        ops.append(_upd("theme", "shadows", "none"))
        ops.append(_upd("theme", "spacing", _step(SPACING_ORDER, theme["spacing"], +1)))
        if theme["radius"] in ("md", "lg"):
            ops.append(_upd("theme", "radius", "sm"))
        for s in _sections(doc):
            if s["type"] == "divider" and s["variant"] == "ornament":
                ops.append(EditOperation(target=f"#{s['id']}", action="set_variant", value="line"))
            if s["style"].get("background") == "accent":
                ops.append(_upd(f"#{s['id']}", "style.background", "surface"))
        if hero and hero["variant"] in ("fullscreen", "split") and _has(t, "минимал", "minimal"):
            ops.append(EditOperation(target="hero", action="set_variant", value="minimal"))
        notes.append("Removed decoration and shadows, opened up spacing, calmed accent backgrounds.")
    if _has(t, "меньше декор", "less decoration", "fewer decorative", "убери декор", "remove decoration", "убери цвет", "remove flowers", "no flowers", "без цветов", "убери орнамент"):
        ops.append(_upd("theme", "decoration", _step(DECOR_ORDER, theme["decoration"], -1) if not _has(t, "убери", "remove", "без") else "none"))
        for s in _sections(doc):
            if s["type"] == "divider" and s["variant"] == "ornament":
                ops.append(EditOperation(target=f"#{s['id']}", action="set_variant", value="line"))
        notes.append("Reduced decorative elements — rules and ornaments are gone; the layout relies on type and spacing.")

    # ---------------- premium / expensive ----------------
    if _has(t, "дорог", "expensive", "premium", "премиум", "luxur", "люкс", "elegant", "элегант", "richer", "богаче"):
        sec = target or "hero"
        if sec == "hero" and hero:
            ops.append(_upd("hero", "style.headingSize", "xl"))
            ops.append(_upd("hero", "style.paddingY", "xl"))
            if hero["variant"] in ("centered", "split") and not _has(t, "keep layout", "оставь"):
                ops.append(EditOperation(target="hero", action="set_variant", value="editorial" if hero["props"].get("image") else "minimal"))
            ops.append(_upd("hero", "eyebrow", hero["props"].get("eyebrow") or "Together with their families"))
        ops.append(_upd("theme", "spacing", _step(SPACING_ORDER, theme["spacing"], +1)))
        ops.append(_upd("theme", "decoration", "none" if theme["decoration"] != "none" else "none"))
        ops.append(_upd("theme", "shadows", "none"))
        if typo["headingFont"] in ("Outfit", "Figtree", "DM Sans", "Inter", "Work Sans", "Manrope") and not _has(t, "keep font", "шрифт остав"):
            ops.append(_upd("theme.typography", "headingFont", SERIF_LUX))
            ops.append(_upd("theme.typography", "headingWeight", 400))
        ops.append(_upd("theme.typography", "headingTracking", "tight"))
        notes.append(f"Made the {sec.replace('_', ' ')} feel more expensive: larger, quieter type; more air; no shadows or decoration.")

    # ---------------- sizes ----------------
    if _has(t, "заголовок", "heading", "title", "headline", "названи"):
        if _has(t, "меньше", "smaller", "reduce", "уменьш"):
            sec = target or "hero"
            s = _first(doc, sec)
            if s:
                ops.append(_upd(f"#{s['id']}", "style.headingSize", _step(SIZE_ORDER, s["style"]["headingSize"], -1)))
                notes.append(f"Reduced the {sec} heading one step.")
        elif _has(t, "больше", "bigger", "larger", "увелич"):
            sec = target or "hero"
            s = _first(doc, sec)
            if s:
                ops.append(_upd(f"#{s['id']}", "style.headingSize", _step(SIZE_ORDER, s["style"]["headingSize"], +1)))
                notes.append(f"Enlarged the {sec} heading one step.")
        if _has(t, "uppercase", "капс", "заглавн", "caps"):
            ops.append(_upd("theme.typography", "headingCase", "uppercase"))
            ops.append(_upd("theme.typography", "headingTracking", "wide"))
            notes.append("Headings are now uppercase with wide tracking.")
        if _has(t, "italic", "курсив"):
            ops.append(_upd("theme.typography", "headingItalic", not typo.get("headingItalic")))
            notes.append("Toggled italic headings.")
    elif _has(t, "шрифт", "font", "text", "текст"):
        if _has(t, "меньше", "smaller", "уменьш"):
            ops.append(_upd("theme.typography", "scale", _step(SCALE_ORDER, typo["scale"], -1)))
            notes.append("Reduced the type scale.")
        elif _has(t, "больше", "bigger", "larger", "увелич"):
            ops.append(_upd("theme.typography", "scale", _step(SCALE_ORDER, typo["scale"], +1)))
            notes.append("Increased the type scale.")

    # ---------------- spacing ----------------
    if _has(t, "больше воздух", "more whitespace", "more space", "more air", "breath", "просторн", "airy", "воздушн"):
        ops.append(_upd("theme", "spacing", _step(SPACING_ORDER, theme["spacing"], +1)))
        notes.append("Increased the spacing scale.")
    if _has(t, "плотнее", "compact", "tighter", "less space", "меньше отступ", "denser"):
        ops.append(_upd("theme", "spacing", _step(SPACING_ORDER, theme["spacing"], -1)))
        notes.append("Tightened the spacing scale.")

    # ---------------- radius / shadows ----------------
    if _has(t, "скругл", "rounded", "round corners", "softer corners"):
        ops.append(_upd("theme", "radius", _step(RADIUS_ORDER, theme["radius"], +1)))
        notes.append("Softened corners.")
    if _has(t, "острые", "sharp", "square corners", "no rounding", "без скруглен"):
        ops.append(_upd("theme", "radius", "none"))
        notes.append("Corners are square now.")
    if _has(t, "убери тени", "no shadow", "remove shadow", "flat"):
        ops.append(_upd("theme", "shadows", "none"))
        notes.append("Removed shadows.")
    if _has(t, "добавь тени", "add shadow", "soft shadow"):
        ops.append(_upd("theme", "shadows", "soft"))
        notes.append("Added a soft shadow to imagery.")

    # ---------------- alignment ----------------
    if _has(t, "по центру", "center", "centre", "центр"):
        sec = target
        targets = [_first(doc, sec)] if sec else _sections(doc)
        for s in targets:
            if s:
                ops.append(_upd(f"#{s['id']}", "style.align", "center"))
        if hero and (not sec or sec == "hero") and hero["variant"] in ("split", "asymmetric", "editorial"):
            ops.append(EditOperation(target="hero", action="set_variant", value="centered"))
        notes.append("Centered the composition.")
    if _has(t, "по левому", "align left", "left-align", "влево", "left aligned"):
        sec = target
        targets = [_first(doc, sec)] if sec else _sections(doc)
        for s in targets:
            if s and s["type"] not in ("footer",):
                ops.append(_upd(f"#{s['id']}", "style.align", "left"))
        notes.append("Left-aligned the composition.")

    # ---------------- image treatment ----------------
    if _has(t, "чёрно-бел", "черно-бел", "black and white", "b&w", "monochrome photo", "grayscale"):
        ops.append(_upd("theme", "imageTreatment", "mono"))
        notes.append("Photographs are now black and white.")
    if _has(t, "плёноч", "пленоч", "film look", "analog", "vintage photo"):
        ops.append(_upd("theme", "imageTreatment", "film"))
        notes.append("Applied a film-like treatment to photos.")
    if _has(t, "natural photo", "no filter", "без фильтр", "естественн"):
        ops.append(_upd("theme", "imageTreatment", "natural"))
        notes.append("Removed photo filters.")

    # ---------------- replace image ----------------
    if _has(t, "замени фото", "замени картин", "замени изображ", "replace photo", "replace image", "change photo", "change image", "другое фото", "другую фот", "another photo", "swap photo"):
        sec = target or "hero"
        s = _first(doc, sec)
        if s:
            cur = s["props"].get("image")
            pool = [a for a in (assets or []) if a != cur]
            if pool:
                ops.append(_upd(f"#{s['id']}", "image", pool[0]))
                notes.append(f"Swapped the {sec} photo for the next image in your library.")
            else:
                notes.append("No other images in the library yet — upload one in Assets and I'll place it. I've selected the image so you can replace it manually.")
    if _has(t, "убери фото", "убери картин", "убери изображ", "remove photo", "remove image", "no image", "без фото"):
        sec = target or "hero"
        s = _first(doc, sec)
        if s:
            ops.append(EditOperation(target=f"#{s['id']}.image", action="remove"))
            if sec == "hero" and s["variant"] in ("fullscreen", "split", "asymmetric", "editorial"):
                ops.append(EditOperation(target="hero", action="set_variant", value="minimal"))
            notes.append(f"Removed the {sec} image" + (" and switched to a typographic hero." if sec == "hero" else "."))

    # ---------------- RSVP prominence ----------------
    if target == "rsvp" and _has(t, "заметн", "prominent", "visible", "stand out", "выдел", "bigger", "заметнее", "highlight", "важн"):
        s = _first(doc, "rsvp")
        if s:
            ops.append(_upd(f"#{s['id']}", "style.background", "accent" if P.contrast(colors["accent"], colors["accentText"]) > 3 else "dark"))
            ops.append(_upd(f"#{s['id']}", "style.paddingY", "xl"))
            ops.append(_upd(f"#{s['id']}", "style.headingSize", "lg"))
            ops.append(EditOperation(target=f"#{s['id']}", action="set_variant", value="split" if s["style"].get("align") == "left" else "card"))
            if hero:
                ops.append(_upd("hero", "buttonLabel", hero["props"].get("buttonLabel") or "RSVP"))
            notes.append("RSVP now sits on a full-bleed accent band with a larger heading, and the hero button points to it.")

    # ---------------- mobile ----------------
    if _has(t, "мобиль", "mobile", "телефон", "phone", "smartphone"):
        if typo["scale"] == "display":
            ops.append(_upd("theme.typography", "scale", "regular"))
        if theme["spacing"] == "airy":
            ops.append(_upd("theme", "spacing", "comfortable"))
        if hero and hero["variant"] == "asymmetric":
            ops.append(EditOperation(target="hero", action="set_variant", value="split"))
        for s in _sections(doc):
            if s["type"] == "gallery" and s["variant"] == "editorial":
                ops.append(EditOperation(target=f"#{s['id']}", action="set_variant", value="grid"))
            if s["type"] == "event_details" and s["variant"] == "editorial":
                ops.append(EditOperation(target=f"#{s['id']}", action="set_variant", value="list"))
            if s["type"] == "rsvp" and s["variant"] == "split":
                ops.append(EditOperation(target=f"#{s['id']}", action="set_variant", value="card"))
        ops.append(_upd("layout", "maxWidth", 1080))
        notes.append("Tidied the mobile version: calmer type scale, tighter vertical rhythm, single-column friendly variants for gallery, details and RSVP.")

    # ---------------- add / remove sections ----------------
    add_words = ("добавь", "add ", "вставь", "insert", "нужн")
    rem_words = ("убери", "удали", "remove", "delete", "hide", "скрой", "без ")
    if target and _has(t, *rem_words) and not _has(t, "фото", "photo", "image", "картин", "изображ", "цвет", "color", "colour", "декор") and target != "hero":
        s = _first(doc, target)
        if s:
            ops.append(EditOperation(target=f"#{s['id']}", action="remove"))
            notes.append(f"Removed the {target.replace('_', ' ')} section.")
    elif target and _has(t, *add_words) and target != "hero":
        if _first(doc, target):
            notes.append(f"The site already has a {target.replace('_', ' ')} section — select it on the canvas to adjust it, or ask me to move it.")
        else:
            payload = default_section_payload(target, doc)
            ops.append(EditOperation(target="sections", action="add", section=payload))
            notes.append(f"Added a {target.replace('_', ' ')} section.")

    # ---------------- move ----------------
    if target and _has(t, "выше", "move up", "earlier", "раньше", "поднять", "higher"):
        s = _first(doc, target)
        if s:
            ops.append(EditOperation(target=f"#{s['id']}", action="move", value="up"))
            notes.append(f"Moved {target.replace('_', ' ')} up.")
    if target and _has(t, "ниже", "move down", "later", "позже", "опусти", "lower"):
        s = _first(doc, target)
        if s:
            ops.append(EditOperation(target=f"#{s['id']}", action="move", value="down"))
            notes.append(f"Moved {target.replace('_', ' ')} down.")

    # ---------------- layout variant by name ----------------
    if target:
        from .schema import SECTION_VARIANTS
        for v in SECTION_VARIANTS.get(target, []):
            if re.search(rf"\b{v}\b", t) and _has(t, "layout", "variant", "вариант", "макет", "сделай", "make", "use"):
                ops.append(EditOperation(target=target, action="set_variant", value=v))
                notes.append(f"{target.replace('_', ' ').title()} layout → {v}.")
                break

    # ---------------- background band on a section ----------------
    if target and _has(t, "на фон", "background", "band", "плашк", "заливк"):
        s = _first(doc, target)
        if s and not any(o.property == "style.background" for o in ops):
            if _has(t, "убери", "remove", "без"):
                ops.append(_upd(f"#{s['id']}", "style.background", "default"))
                notes.append(f"Removed the background band from {target.replace('_', ' ')}.")
            elif _has(t, "тёмн", "темн", "dark"):
                ops.append(_upd(f"#{s['id']}", "style.background", "dark"))
                notes.append(f"{target.replace('_', ' ').title()} sits on a dark band now.")
            elif _has(t, "акцент", "accent"):
                ops.append(_upd(f"#{s['id']}", "style.background", "accent"))
                notes.append(f"{target.replace('_', ' ').title()} sits on an accent band now.")
            elif not mentioned:
                ops.append(_upd(f"#{s['id']}", "style.background", "surface"))
                notes.append(f"Gave {target.replace('_', ' ')} a soft surface background.")

    # ---------------- animation ----------------
    if _has(t, "анимац", "animation", "motion"):
        if _has(t, "убери", "remove", "no ", "без", "off", "less", "меньше"):
            ops.append(_upd("theme", "animation", "none"))
            notes.append("Turned animations off.")
        else:
            ops.append(_upd("theme", "animation", "subtle"))
            notes.append("Kept animation subtle (fade and slow reveal only).")

    # dedupe ops (last wins per target+property)
    seen: dict[tuple, EditOperation] = {}
    for o in ops:
        key = (o.target, o.action, o.property)
        seen[key] = o
    ops = list(seen.values())

    if not ops and notes:
        return EditProposal(summary=" ".join(notes), operations=[])
    if not ops:
        summary = (
            "I couldn't map that to a safe design change. Try things like “make the hero more premium”, "
            "“remove gold”, “use olive only for accents”, “make the heading smaller”, “replace the serif with a modern font”, "
            "“make RSVP more prominent”, “add a countdown”, or “fix the mobile version”."
        )
        return EditProposal(summary=summary, operations=[])
    return EditProposal(summary=" ".join(notes), operations=ops)


def default_section_payload(typ: str, doc: dict) -> dict[str, Any]:
    hero = _first(doc, "hero") or {"props": {}}
    hp = hero["props"]
    align = hero.get("style", {}).get("align", "center")
    base = {"type": typ, "style": {"align": align if typ != "countdown" else "center", "paddingY": "lg", "background": "default", "headingSize": "md"}}
    props: dict[str, Any] = {}
    if typ == "countdown":
        props = {"eyebrow": "Counting down", "heading": "See you soon", "targetDate": None}
        base["variant"] = "inline"
    elif typ == "gallery":
        props = {"images": [{"src": None}] * 4}
        base["variant"] = "grid"
    elif typ == "schedule":
        props = {"eyebrow": "Schedule", "heading": "The order of the day", "items": [{"time": "16:00", "title": "Ceremony"}, {"time": "18:00", "title": "Dinner"}, {"time": "21:00", "title": "Dancing"}]}
    elif typ == "quote":
        props = {"quote": "The best thing to hold onto in life is each other.", "attribution": "Audrey Hepburn"}
    elif typ == "map":
        props = {"eyebrow": "Getting there", "heading": "The venue", "venue": hp.get("venue"), "address": "", "mapQuery": hp.get("venue")}
    elif typ == "story":
        props = {"eyebrow": "Our story", "heading": "How it began", "body": "A few words about how we got here."}
    elif typ == "dress_code":
        props = {"eyebrow": "Dress code", "heading": "What to wear", "dressCode": "Formal", "body": "Think soft, natural tones."}
    elif typ == "speakers":
        props = {"eyebrow": "Speakers", "heading": "Voices on stage", "speakers": [{"name": "Speaker name", "role": "Title, Company"}] * 3}
    elif typ == "rsvp":
        props = {"eyebrow": "RSVP", "heading": "Will you join us?", "body": "Kindly reply so we can plan the day around you.", "buttonLabel": "Send RSVP"}
    elif typ == "event_details":
        props = {"eyebrow": "Details", "heading": "When & where", "details": [{"label": "Date", "value": hp.get("date") or "Date"}, {"label": "Venue", "value": hp.get("venue") or "Venue"}]}
    elif typ == "text":
        props = {"heading": "A note", "body": "Write something here."}
    elif typ == "image":
        props = {"image": None}
    elif typ == "divider":
        base["variant"] = "line"
        base["style"]["paddingY"] = "sm"
    elif typ == "contact":
        props = {"eyebrow": "Questions", "heading": "Get in touch", "email": "hello@example.com"}
    elif typ == "footer":
        props = {"heading": hp.get("heading"), "body": hp.get("date")}
    base["props"] = props
    return base
