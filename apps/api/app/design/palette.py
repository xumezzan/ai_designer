"""Colour utilities and a curated, restrained named-colour vocabulary."""
from __future__ import annotations

import colorsys
import re

# Deliberately muted, designer-grade values. No neon, no pure primaries.
NAMED_COLORS: dict[str, str] = {
    # neutrals
    "ivory": "#F4EFE6", "cream": "#F6F1E7", "white": "#FBFAF7", "beige": "#E7DCCB", "sand": "#DCCDB4",
    "stone": "#CFC8BC", "linen": "#EFE9E0", "champagne": "#EAD9C2", "taupe": "#8D8073", "grey": "#8A8A86",
    "gray": "#8A8A86", "charcoal": "#2C2C2A", "black": "#161615", "graphite": "#3A3B3D", "slate": "#5B6470",
    # warm
    "brown": "#4A3A2E", "chocolate": "#3B2B22", "espresso": "#30231C", "terracotta": "#B5674A", "rust": "#9C4F32",
    "caramel": "#B98B57", "mustard": "#C9A24B", "gold": "#B8955A", "bronze": "#8C6A3D", "copper": "#A8623A",
    "peach": "#E9B79A", "apricot": "#E7A97A", "coral": "#D9775F", "blush": "#E8C9C1", "rose": "#C98A87",
    "burgundy": "#6B2A33", "wine": "#5E2431", "plum": "#5B3A57", "red": "#9B3B3B", "orange": "#D4763A",
    "yellow": "#D9B85C", "pink": "#D89AA6", "magenta": "#9B3C6E",
    # cool / green
    "olive": "#66705A", "sage": "#9AA78F", "moss": "#4F5A3F", "forest": "#2E4634", "green": "#4E6A4F",
    "emerald": "#2F6B4F", "mint": "#BFD8C7", "eucalyptus": "#7F9A8A", "teal": "#3C6E6B", "navy": "#1F2A44",
    "blue": "#3F5B8A", "sky": "#B9CCE0", "powder": "#C8D6E5", "denim": "#4A6382", "lavender": "#B7AFD0",
    "lilac": "#C7B8D8", "purple": "#5E4B7B", "violet": "#5A4A85", "dusty blue": "#8AA1B8", "steel": "#6F7E8C",
    # misc
    "silver": "#B8B8B4", "pearl": "#EDE9E3", "oat": "#E4DACA", "clay": "#B28B73", "cocoa": "#5A4137",
}

RU_COLOR_ALIASES = {
    "айвори": "ivory", "слоновая кость": "ivory", "кремовый": "cream", "белый": "white", "бежевый": "beige",
    "песочный": "sand", "серый": "grey", "графит": "graphite", "чёрный": "black", "черный": "black",
    "коричневый": "brown", "шоколад": "chocolate", "терракот": "terracotta", "золот": "gold", "бронз": "bronze",
    "персик": "peach", "коралл": "coral", "пудров": "blush", "роз": "rose", "бордо": "burgundy", "винн": "wine",
    "слив": "plum", "красн": "red", "оранж": "orange", "жёлт": "yellow", "желт": "yellow", "олив": "olive",
    "шалфей": "sage", "мох": "moss", "лесн": "forest", "зелён": "green", "зелен": "green", "изумруд": "emerald",
    "мятн": "mint", "эвкалипт": "eucalyptus", "бирюз": "teal", "тёмно-син": "navy", "темно-син": "navy",
    "син": "blue", "голуб": "sky", "лаванд": "lavender", "сирен": "lilac", "фиолет": "purple", "серебр": "silver",
    "глин": "clay", "какао": "cocoa", "карамел": "caramel", "горчич": "mustard", "пыльно-голуб": "dusty blue",
}

DECORATIVE_ACCENTS = {"gold", "bronze", "copper", "silver", "mustard", "yellow"}


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hex(rgb) -> str:
    r, g, b = (max(0, min(255, int(round(x)))) for x in rgb)
    return f"#{r:02X}{g:02X}{b:02X}"


def luminance(h: str) -> float:
    def ch(c):
        s = c / 255
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    r, g, b = (ch(c) for c in hex_to_rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def mix(a: str, b: str, t: float) -> str:
    ra, rb = hex_to_rgb(a), hex_to_rgb(b)
    return rgb_to_hex([ra[i] + (rb[i] - ra[i]) * t for i in range(3)])


def hsl(h: str) -> tuple[float, float, float]:
    r, g, b = (c / 255 for c in hex_to_rgb(h))
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    return hh, ss, ll


def from_hsl(hh: float, ss: float, ll: float) -> str:
    r, g, b = colorsys.hls_to_rgb(hh % 1.0, max(0, min(1, ll)), max(0, min(1, ss)))
    return rgb_to_hex((r * 255, g * 255, b * 255))


def shift_warmth(h: str, amount: float) -> str:
    r, g, b = hex_to_rgb(h)
    return rgb_to_hex((r + amount * 6, g + amount * 2, b - amount * 6))


def desaturate(h: str, factor: float) -> str:
    hh, ss, ll = hsl(h)
    return from_hsl(hh, ss * factor, ll)


def with_lightness(h: str, ll: float) -> str:
    hh, ss, _ = hsl(h)
    return from_hsl(hh, ss, ll)


def readable_on(bg: str) -> str:
    return "#FBFAF7" if luminance(bg) < 0.4 else "#1E1C19"


def nearest_name(h: str) -> str:
    best, bd = "stone", 1e9
    r1 = hex_to_rgb(h)
    for name, val in NAMED_COLORS.items():
        r2 = hex_to_rgb(val)
        d = sum((a - b) ** 2 for a, b in zip(r1, r2))
        if d < bd:
            best, bd = name, d
    return best


def colors_in_text(text: str) -> list[str]:
    """Return named colours mentioned in a brief (EN + RU), in order."""
    t = text.lower().replace("black tie", " ").replace("black-tie", " ")
    # compound names: "olive green" means olive, not green
    t = re.sub(r"\b(olive|sage|forest|emerald|mint|moss|eucalyptus)[\s-]+green\b", r"\1", t)
    t = re.sub(r"\b(navy|sky|powder|dusty|steel|denim)[\s-]+blue\b", r"\1", t)
    t = re.sub(r"\b(dark|deep|light|soft|warm|pale)\s+", " ", t)
    found: list[tuple[int, str]] = []
    for name in NAMED_COLORS:
        for m in re.finditer(r"\b" + re.escape(name) + r"\b", t):
            found.append((m.start(), name))
    for ru, en in RU_COLOR_ALIASES.items():
        i = t.find(ru)
        if i >= 0:
            found.append((i, en))
    found.sort()
    seen, out = set(), []
    for _, n in found:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out


def build_palette(names: list[str], reference_hexes: list[str] | None = None, dark: bool = False) -> dict[str, str]:
    """Turn a list of colour names / reference hexes into a coherent 6-token palette."""
    hexes = [NAMED_COLORS[n] for n in names if n in NAMED_COLORS]
    if reference_hexes:
        hexes += reference_hexes[:4]
    if not hexes:
        hexes = ["#F4EFE6", "#66705A", "#28251F"]

    by_l = sorted(hexes, key=luminance)
    darkest, lightest = by_l[0], by_l[-1]
    # accent: most saturated mid-lightness colour, excluding near-neutrals
    def sat_score(h):
        _, s, l = hsl(h)
        return s * (1 - abs(l - 0.45))

    pool = [h for h in hexes if h not in (darkest, lightest)] if len(hexes) >= 3 else hexes
    candidates = [h for h in pool if 0.12 < hsl(h)[2] < 0.82]
    if not candidates:
        candidates = [h for h in hexes if 0.12 < hsl(h)[2] < 0.82]
    accent = max(candidates, key=sat_score) if candidates else mix(darkest, lightest, 0.4)

    if not dark:
        bg = lightest if luminance(lightest) > 0.6 else "#F4EFE6"
        bg = mix(bg, "#FFFFFF", 0.25) if luminance(bg) < 0.75 else bg
        text = darkest if luminance(darkest) < 0.12 else mix(darkest, "#141311", 0.6)
        surface = mix(bg, text, 0.045)
        muted = mix(text, bg, 0.5)
    else:
        bg = darkest if luminance(darkest) < 0.06 else mix(darkest, "#0E0D0C", 0.7)
        text = lightest if luminance(lightest) > 0.6 else "#F1ECE2"
        surface = mix(bg, text, 0.06)
        muted = mix(text, bg, 0.45)
        # accent must read on dark
        if contrast(accent, bg) < 2.4:
            accent = with_lightness(accent, 0.62)

    if contrast(accent, bg) < 2.2:
        accent = with_lightness(accent, 0.36 if not dark else 0.64)
    return {
        "background": bg,
        "surface": surface,
        "text": text,
        "muted": muted,
        "accent": accent,
        "accentText": readable_on(accent),
    }
