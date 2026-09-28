"""AI Design Engine — the deterministic core.

    USER BRIEF → REFERENCE ANALYSIS → STYLE PROFILE → DESIGN SYSTEM
    → LAYOUT → 3 CONCEPTS (DesignDocument)

An LLM provider may enrich the style profile (see app/ai/service.py), but
the *compilation* from profile to design document always happens here, so
output is always valid, restrained and renderable.
"""
from __future__ import annotations

import io
import re
from collections import Counter

from PIL import Image

from . import palette as P
from .copy import build_sections
from .directions import DIRECTIONS, Direction
from .schema import DesignDocument, Section, SectionStyle

# ------------------------------------------------------------------
# Vocabulary: brief words → style tags
# ------------------------------------------------------------------
TAG_WORDS: dict[str, list[str]] = {
    "minimal": ["minimal", "минимал", "clean", "чист", "simple", "прост", "restrained", "сдержан", "less"],
    "luxury": ["luxury", "люкс", "дорог", "premium", "премиум", "old money", "expensive", "quiet luxury", "богат"],
    "elegant": ["elegant", "элегант", "refined", "изыскан", "sophisticated", "утончен"],
    "romantic": ["romantic", "романти", "love", "любов", "tender", "нежн", "soft", "мягк"],
    "editorial": ["editorial", "magazine", "журнал", "vogue", "fashion", "мод"],
    "modern": ["modern", "современ", "contemporary", "urban", "городск", "graphic", "график"],
    "bold": ["bold", "смел", "loud", "громк", "statement", "яркий", "bright", "ярк"],
    "playful": ["fun", "playful", "игрив", "весел", "party", "вечеринк", "joy", "радост", "kids", "дет"],
    "classic": ["classic", "классич", "traditional", "традицион", "timeless"],
    "warm": ["warm", "тепл", "sun", "солн", "summer", "лет", "golden hour"],
    "cool": ["cool", "холод", "winter", "зим", "ice", "лёд", "frost"],
    "dark": ["dark", "тёмн", "темн", "night", "ноч", "evening", "вечер", "black tie", "gala", "moody"],
    "botanical": ["garden", "сад", "botanical", "ботан", "green", "зелен", "flowers", "цвет", "forest", "лес", "nature", "природ", "outdoor"],
    "mediterranean": ["italian", "итал", "italy", "tuscany", "тоскан", "mediterranean", "средиземн", "greece", "греч", "amalfi", "sicily", "spain", "испан", "provence", "прованс"],
    "film": ["film", "плён", "плен", "analog", "vintage", "винтаж", "retro", "ретро", "nostalg", "ностальг", "35mm", "cinematic", "кино", "кинематограф"],
    "corporate": ["corporate", "корпорат", "conference", "конференц", "summit", "саммит", "business", "бизнес", "tech", "launch", "запуск"],
    "monochrome": ["monochrome", "монохром", "black and white", "чёрно-бел", "черно-бел", "b&w"],
    "boho": ["boho", "бохо", "rustic", "рустик", "barn"],
    "pastel": ["pastel", "пастел", "baby", "малыш"],
}

MOOD_LABELS = {
    "warm": "Warm", "cool": "Cool", "romantic": "Intimate", "luxury": "Premium", "playful": "Joyful",
    "dark": "Moody", "minimal": "Calm", "bold": "Confident", "botanical": "Natural", "classic": "Timeless",
    "modern": "Contemporary", "elegant": "Refined", "film": "Nostalgic", "corporate": "Focused",
}


def extract_tags(text: str) -> Counter:
    t = text.lower()
    c: Counter = Counter()
    for tag, words in TAG_WORDS.items():
        for w in words:
            n = len(re.findall(re.escape(w), t))
            if n:
                c[tag] += n
    return c


# ------------------------------------------------------------------
# Reference (image) analysis
# ------------------------------------------------------------------
def extract_image_palette(data: bytes, n: int = 5) -> list[str]:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.thumbnail((160, 160))
    q = img.quantize(colors=n * 2, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors() or [], reverse=True)
    out: list[str] = []
    for cnt, idx in counts:
        rgb = tuple(pal[idx * 3: idx * 3 + 3])
        hx = P.rgb_to_hex(rgb)
        # skip near-duplicates
        if all(sum((a - b) ** 2 for a, b in zip(rgb, P.hex_to_rgb(o))) > 900 for o in out):
            out.append(hx)
        if len(out) >= n:
            break
    return out


def analyze_references(palettes: list[list[str]], notes: list[str], brief_text: str = "") -> dict:
    """Combine extracted palettes + notes into a visual-language summary."""
    all_hex = [h for pal in palettes for h in pal]
    tags = extract_tags(" ".join(notes) + " " + brief_text)

    # image statistics
    if all_hex:
        lums = [P.luminance(h) for h in all_hex]
        sats = [P.hsl(h)[1] for h in all_hex]
        warm = 0
        for h in all_hex:
            r, g, b = P.hex_to_rgb(h)
            warm += 1 if r > b + 12 else (-1 if b > r + 12 else 0)
        avg_l = sum(lums) / len(lums)
        avg_s = sum(sats) / len(sats)
        if avg_l < 0.18:
            tags["dark"] += 2
        if avg_s < 0.14:
            tags["minimal"] += 1
            tags["monochrome"] += 1 if avg_s < 0.06 else 0
        if avg_s > 0.35:
            tags["bold"] += 1
        if warm > 0:
            tags["warm"] += 1
        elif warm < 0:
            tags["cool"] += 1
        # any green-ish hue?
        for h in all_hex:
            hh, ss, ll = P.hsl(h)
            if 0.18 < hh < 0.45 and ss > 0.12:
                tags["botanical"] += 1
                break
    else:
        avg_l, avg_s = 0.8, 0.2

    # dominant colours across references, named
    named = Counter(P.nearest_name(h) for h in all_hex)
    colors = [n for n, _ in named.most_common(5)]
    color_hex = []
    for n in colors:
        color_hex.append(P.NAMED_COLORS[n])

    top = [t for t, _ in tags.most_common(3)]
    style_words = []
    if "editorial" in tags or "luxury" in tags:
        style_words.append("Editorial")
    if "minimal" in tags or avg_s < 0.15:
        style_words.append("Minimal")
    if "romantic" in tags:
        style_words.append("Romantic")
    if "modern" in tags or "bold" in tags:
        style_words.append("Modern")
    if "botanical" in tags:
        style_words.append("Botanical")
    if "film" in tags:
        style_words.append("Analogue")
    if "playful" in tags:
        style_words.append("Playful")
    if not style_words:
        style_words = ["Editorial", "Minimal"] if avg_s < 0.25 else ["Modern", "Warm"]

    serif = not ({"modern", "corporate", "playful", "bold"} & set(top)) or "elegant" in tags or "luxury" in tags
    typography = "Elegant high-contrast serif" if serif else "Contemporary sans-serif"
    if "playful" in tags:
        typography = "Rounded geometric sans"

    composition = "Asymmetric / editorial" if ("editorial" in tags or "modern" in tags or "luxury" in tags) else "Centered / symmetrical"
    mood = [MOOD_LABELS[t] for t in top if t in MOOD_LABELS][:3] or (["Warm", "Intimate", "Premium"] if avg_l > 0.5 else ["Moody", "Cinematic"])
    decoration = "Minimal" if ("minimal" in tags or "luxury" in tags or avg_s < 0.18) else ("Moderate" if "playful" in tags or "boho" in tags else "Low")
    image_style = "Film / natural light" if "film" in tags or "warm" in tags else ("Black & white" if "monochrome" in tags else "Natural, documentary")

    return {
        "style": style_words[:3],
        "colors": colors,
        "colorHex": color_hex,
        "typography": typography,
        "composition": composition,
        "mood": mood,
        "decoration": decoration,
        "imageStyle": image_style,
        "tags": dict(tags),
        "stats": {"lightness": round(avg_l, 2), "saturation": round(avg_s, 2)},
    }


# ------------------------------------------------------------------
# Style profile & direction selection
# ------------------------------------------------------------------
def build_style_profile(brief: dict, event_type: str, reference_analysis: dict | None) -> dict:
    text = " ".join(
        str(brief.get(k) or "") for k in ("description", "style", "colors", "title", "vibe", "mood", "dressCode")
    )
    if isinstance(brief.get("styleKeywords"), list):
        text += " " + " ".join(brief["styleKeywords"])
    tags = extract_tags(text)
    if reference_analysis:
        for t, n in (reference_analysis.get("tags") or {}).items():
            tags[t] += n * 0.6
    color_names = P.colors_in_text(text)
    ref_hex = (reference_analysis or {}).get("colorHex") or []
    return {
        "tags": dict(tags),
        "colorNames": color_names,
        "referenceHex": ref_hex,
        "eventType": event_type,
        "wantsDark": tags.get("dark", 0) >= 2 and tags.get("dark", 0) > tags.get("warm", 0),
        "decoration": "none" if tags.get("minimal", 0) + tags.get("luxury", 0) >= 2 else ("moderate" if tags.get("playful", 0) + tags.get("boho", 0) >= 2 else "minimal"),
        "summary": summarize_profile(tags, color_names, ref_hex, event_type),
    }


def summarize_profile(tags: Counter | dict, color_names: list[str], ref_hex: list[str], event_type: str) -> dict:
    tags = Counter(tags)
    top = [t for t, _ in tags.most_common(4)]
    style_bits = []
    if "editorial" in top or "luxury" in top:
        style_bits.append("Editorial")
    if "mediterranean" in top:
        style_bits.append("Mediterranean")
    if "minimal" in top:
        style_bits.append("Minimal")
    if "romantic" in top:
        style_bits.append("Romantic")
    if "modern" in top or "bold" in top:
        style_bits.append("Modern")
    if "luxury" in top:
        style_bits.append("Luxury")
    if "botanical" in top:
        style_bits.append("Botanical")
    if "playful" in top:
        style_bits.append("Playful")
    if "corporate" in top:
        style_bits.append("Professional")
    if not style_bits:
        style_bits = ["Editorial", "Contemporary"]
    palette = [c.title() for c in color_names[:4]] or [P.nearest_name(h).title() for h in ref_hex[:4]] or ["Ivory", "Olive", "Brown"]
    serif = not ({"modern", "corporate", "playful"} & set(top[:2]))
    return {
        "style": " ".join(style_bits[:3]),
        "palette": palette,
        "typography": ("High-contrast serif display · neutral sans body" if serif else "Contemporary sans display · neutral body"),
        "composition": "Asymmetrical editorial" if ("editorial" in top or "modern" in top or "luxury" in top) else "Centered, symmetrical",
        "decoration": "Very low" if ("minimal" in top or "luxury" in top) else ("Moderate" if "playful" in top else "Low"),
        "animation": "Subtle",
        "imageTreatment": "Film photography / natural light" if ("film" in top or "warm" in top) else ("Black & white" if "monochrome" in top else "Natural light"),
        "mood": [MOOD_LABELS[t] for t in top if t in MOOD_LABELS][:3],
    }


def score_direction(d: Direction, profile: dict) -> float:
    tags = Counter(profile["tags"])
    s = d.event_affinity.get(profile["eventType"], 0.3) * 3.0
    for t, n in tags.items():
        if t in d.tags:
            s += 1.2 * min(n, 3)
    if profile.get("wantsDark") and d.dark:
        s += 3
    if not profile.get("wantsDark") and d.dark:
        s -= 2.5
    if "minimal" in tags and d.decoration == "none":
        s += 0.5
    if "playful" in tags and d.family.startswith("serif") and d.id != "soft_modern":
        s -= 0.5
    return s


def select_directions(profile: dict, k: int = 3) -> list[Direction]:
    ranked = sorted(DIRECTIONS, key=lambda d: score_direction(d, profile), reverse=True)
    chosen: list[Direction] = []
    for d in ranked:
        if len(chosen) >= k:
            break
        # diversity: different hero composition and different type family
        if any(c.hero_variant == d.hero_variant for c in chosen):
            continue
        if any(c.family == d.family for c in chosen):
            continue
        chosen.append(d)
    for d in ranked:  # relax constraints if needed
        if len(chosen) >= k:
            break
        if d not in chosen:
            chosen.append(d)
    return chosen[:k]


# ------------------------------------------------------------------
# Concept assembly
# ------------------------------------------------------------------
def compose_concept(direction: Direction, profile: dict, brief: dict, event_type: str, images: list[str], index: int) -> DesignDocument:
    names = list(profile["colorNames"]) or []
    # Quiet directions purge decorative metallics from the palette
    if direction.decoration == "none":
        names = [n for n in names if n not in P.DECORATIVE_ACCENTS] or names
    if not names and not profile["referenceHex"]:
        names = direction.default_colors
    elif len(names) < 2 and not profile["referenceHex"]:
        names = names + [c for c in direction.default_colors if c not in names][:2]
    ref_hex = profile["referenceHex"] if not names else profile["referenceHex"][:2]
    dark = direction.dark or (profile.get("wantsDark") and index == 0 and False)
    colors = P.build_palette(names, ref_hex, dark=bool(dark))

    # per-direction palette character
    if direction.image_treatment == "mono":
        colors["surface"] = P.mix(colors["background"], colors["text"], 0.05)
        colors["accent"] = colors["text"] if P.contrast(colors["accent"], colors["background"]) < 3 else colors["accent"]
        colors["accentText"] = P.readable_on(colors["accent"])
    if direction.id == "quiet_luxury":
        colors["accent"] = P.desaturate(colors["accent"], 0.55)
        colors["accentText"] = P.readable_on(colors["accent"])
    if direction.id == "modern_mediterranean":
        colors["background"] = P.shift_warmth(colors["background"], 1.2)
        colors["surface"] = P.shift_warmth(colors["surface"], 1.5)

    sections_raw = build_sections(brief, event_type, images)
    sections: list[Section] = []
    for i, raw in enumerate(sections_raw):
        t = raw["type"]
        variant = direction.hero_variant if t == "hero" else direction.variants.get(t, "")
        style = SectionStyle(
            background=direction.backgrounds.get(t, "default"),
            paddingY=direction.paddings.get(t, "xl" if t == "hero" else ("md" if t in ("footer", "quote", "countdown", "divider") else "lg")),
            align=("left" if direction.align == "left" and t in ("hero", "story", "event_details", "schedule", "speakers", "map", "rsvp", "quote", "gallery") else "center"),
            headingSize="xl" if t == "hero" else ("md" if t not in ("footer",) else "sm"),
        )
        # a fullscreen hero must have an image; if none, fall back gracefully
        if t == "hero" and variant == "fullscreen" and not raw["props"].get("image"):
            variant = "minimal" if direction.align == "center" else "editorial"
        if t == "hero" and variant in ("minimal",):
            raw["props"].pop("image", None)
        if t == "hero" and variant == "centered":
            # centered hero: keep a wide image below only when we have one
            if not raw["props"].get("image"):
                raw["props"].pop("image", None)
        if t == "story" and variant == "columns":
            raw["props"].pop("image", None)
        if t == "story" and variant == "centered":
            raw["props"].pop("image", None)
        if t == "dress_code" and variant == "swatches":
            raw["props"]["swatches"] = [colors["accent"], colors["text"], colors["surface"]]
        # alternate split story direction for rhythm
        if t == "story" and variant == "split" and i % 2 == 0:
            raw["props"]["reverse"] = True
        sections.append(Section(type=t, variant=variant, props=raw["props"], style=style))

    # direction-specific section rhythm
    types = [s.type for s in sections]
    if direction.id in ("quiet_luxury", "editorial_romance") and "countdown" in types:
        # quiet directions: countdown becomes a small inline block right before RSVP
        cd = sections.pop(types.index("countdown"))
        cd.style.paddingY = "sm"
        idx = [s.type for s in sections].index("rsvp")
        sections.insert(idx, cd)
    if direction.id == "modern_monochrome" and "quote" in [s.type for s in sections]:
        q = sections.pop([s.type for s in sections].index("quote"))
        sections.insert(1, q)  # statement right after hero
        q.style.paddingY = "lg"
    if direction.id == "cinematic_night":
        sections.insert(1, Section(type="text", variant="statement", props={"body": sections[0].props.get("subheading") or "An evening to remember."}, style=SectionStyle(align="left", paddingY="lg")))
        sections[0].props["subheading"] = None

    doc = DesignDocument(
        meta={
            "conceptName": f"Concept 0{index + 1}",
            "direction": direction.name,
            "rationale": direction.rationale,
            "eventType": event_type,
        },
        theme={
            "colors": colors,
            "typography": {
                "headingFont": direction.heading_font,
                "bodyFont": direction.body_font,
                "scale": direction.scale,
                "headingWeight": direction.heading_weight,
                "headingCase": direction.heading_case,
                "headingTracking": direction.heading_tracking,
                "headingItalic": direction.heading_italic,
            },
            "spacing": direction.spacing,
            "radius": direction.radius,
            "shadows": direction.shadows,
            "decoration": min_decoration(direction.decoration, profile.get("decoration", "minimal")),
            "animation": direction.animation,
            "imageTreatment": direction.image_treatment,
        },
        layout={"maxWidth": direction.max_width},
        sections=sections,
    )
    return doc


def min_decoration(a: str, b: str) -> str:
    order = ["none", "minimal", "moderate"]
    return order[min(order.index(a), order.index(b))]


def generate_concepts(brief: dict, event_type: str, reference_analysis: dict | None, images: list[str]) -> tuple[dict, list[DesignDocument]]:
    profile = build_style_profile(brief, event_type, reference_analysis)
    directions = select_directions(profile, 3)
    concepts = [compose_concept(d, profile, brief, event_type, images, i) for i, d in enumerate(directions)]
    return profile, concepts
