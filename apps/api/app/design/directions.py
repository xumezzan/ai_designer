"""Art-direction library.

A direction is a coherent, opinionated design language — composition,
typography, spacing, image treatment, section rhythm. The engine picks
three *different* directions that fit the brief, then adapts each one's
palette and copy to the event. This is how we avoid "three variations of
the same template".
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Direction:
    id: str
    name: str
    tagline: str
    rationale: str
    # typography
    heading_font: str
    body_font: str
    scale: str = "regular"           # compact | regular | display
    heading_weight: int = 400
    heading_case: str = "none"
    heading_tracking: str = "normal"
    heading_italic: bool = False
    # theme
    spacing: str = "comfortable"
    radius: str = "none"
    shadows: str = "none"
    decoration: str = "minimal"
    animation: str = "subtle"
    image_treatment: str = "natural"
    max_width: int = 1200
    dark: bool = False
    # composition
    hero_variant: str = "centered"
    align: str = "center"
    variants: dict[str, str] = field(default_factory=dict)
    # rhythm: which section types get which backgrounds
    backgrounds: dict[str, str] = field(default_factory=dict)
    # padding tweaks
    paddings: dict[str, str] = field(default_factory=dict)
    # affinity tags used for scoring
    tags: set[str] = field(default_factory=set)
    event_affinity: dict[str, float] = field(default_factory=dict)
    # palette bias applied when the brief gives no colours
    default_colors: list[str] = field(default_factory=lambda: ["ivory", "olive", "brown"])
    # family for diversity checks
    family: str = "serif-editorial"


DIRECTIONS: list[Direction] = [
    Direction(
        id="editorial_romance",
        name="Editorial Romance",
        tagline="Magazine-like composition, italic serif display, generous air.",
        rationale="An editorial layout gives the names room to breathe; the italic serif carries warmth without ornament.",
        heading_font="Cormorant Garamond", body_font="Inter", scale="display", heading_weight=300, heading_italic=True,
        spacing="airy", decoration="minimal", image_treatment="film",
        hero_variant="editorial", align="left",
        variants={"story": "split", "event_details": "editorial", "schedule": "list", "gallery": "editorial", "quote": "editorial", "rsvp": "split", "footer": "signature", "countdown": "inline"},
        backgrounds={"quote": "surface", "rsvp": "surface"},
        tags={"romantic", "elegant", "editorial", "warm", "classic", "timeless", "soft", "intimate"},
        event_affinity={"wedding": 1.0, "engagement": 1.0, "baby_shower": 0.5, "birthday": 0.4, "corporate": 0.1, "party": 0.3, "other": 0.5},
        default_colors=["ivory", "olive", "brown"], family="serif-editorial",
    ),
    Direction(
        id="modern_mediterranean",
        name="Modern Mediterranean",
        tagline="Sun-washed palette, split hero, tactile warmth with a contemporary grid.",
        rationale="A split hero pairs a large photograph with a confident serif; warm surfaces echo plaster and terracotta without being literal.",
        heading_font="Fraunces", body_font="DM Sans", scale="regular", heading_weight=400,
        spacing="comfortable", radius="sm", decoration="minimal", image_treatment="warm",
        hero_variant="split", align="left",
        variants={"story": "columns", "event_details": "cards", "schedule": "timeline", "gallery": "grid", "quote": "centered", "rsvp": "card", "footer": "simple", "countdown": "large"},
        backgrounds={"event_details": "surface", "countdown": "accent", "footer": "surface"},
        tags={"mediterranean", "italian", "summer", "warm", "modern", "sunny", "fresh", "relaxed", "garden", "outdoor"},
        event_affinity={"wedding": 0.9, "engagement": 0.8, "birthday": 0.7, "party": 0.7, "corporate": 0.3, "baby_shower": 0.6, "other": 0.6},
        default_colors=["cream", "terracotta", "olive", "brown"], family="serif-modern",
    ),
    Direction(
        id="quiet_luxury",
        name="Quiet Luxury",
        tagline="Near-monochrome, hairline rules, restraint as the statement.",
        rationale="Everything unnecessary is removed. Type, spacing and a single accent do the work — the mark of an expensive invitation.",
        heading_font="Libre Caslon Text", body_font="Karla", scale="regular", heading_weight=400, heading_tracking="tight",
        spacing="airy", decoration="none", image_treatment="muted", max_width=1080,
        hero_variant="minimal", align="center",
        variants={"story": "centered", "event_details": "list", "schedule": "list", "gallery": "strip", "quote": "centered", "rsvp": "minimal", "footer": "simple", "countdown": "inline", "divider": "line"},
        backgrounds={},
        paddings={"hero": "xl", "rsvp": "xl"},
        tags={"minimal", "luxury", "old money", "quiet", "elegant", "timeless", "restrained", "sophisticated", "classic", "black tie", "formal"},
        event_affinity={"wedding": 1.0, "engagement": 0.9, "corporate": 0.6, "birthday": 0.5, "party": 0.4, "baby_shower": 0.4, "other": 0.6},
        default_colors=["ivory", "charcoal", "taupe"], family="serif-classic",
    ),
    Direction(
        id="modern_monochrome",
        name="Modern Monochrome",
        tagline="Grotesk uppercase, asymmetric grid, black-and-white photography.",
        rationale="A graphic, poster-like hierarchy that feels contemporary and confident. Colour is used almost nowhere, so it lands when it appears.",
        heading_font="Space Grotesk", body_font="Inter", scale="display", heading_weight=500, heading_case="uppercase", heading_tracking="tight",
        spacing="compact", decoration="none", image_treatment="mono", max_width=1320,
        hero_variant="asymmetric", align="left",
        variants={"story": "columns", "event_details": "editorial", "schedule": "list", "gallery": "grid", "quote": "editorial", "rsvp": "split", "footer": "simple", "countdown": "large", "speakers": "grid"},
        backgrounds={"countdown": "dark", "rsvp": "surface"},
        tags={"modern", "minimal", "urban", "graphic", "bold", "contemporary", "architectural", "monochrome", "black", "white", "loft", "industrial"},
        event_affinity={"wedding": 0.6, "engagement": 0.6, "birthday": 0.8, "party": 0.9, "corporate": 0.9, "baby_shower": 0.2, "other": 0.7},
        default_colors=["white", "black", "grey"], family="sans-graphic",
    ),
    Direction(
        id="botanical_calm",
        name="Botanical Calm",
        tagline="Full-bleed photography, soft sage surfaces, unhurried rhythm.",
        rationale="A fullscreen hero lets the venue set the tone; the soft palette and rounded surfaces keep everything calm and natural.",
        heading_font="Newsreader", body_font="Work Sans", scale="regular", heading_weight=400,
        spacing="comfortable", radius="md", decoration="minimal", image_treatment="natural",
        hero_variant="fullscreen", align="center",
        variants={"story": "split", "event_details": "cards", "schedule": "timeline", "gallery": "editorial", "quote": "centered", "rsvp": "card", "footer": "signature", "countdown": "inline", "dress_code": "swatches"},
        backgrounds={"story": "surface", "rsvp": "surface"},
        tags={"botanical", "garden", "natural", "green", "outdoor", "soft", "calm", "forest", "rustic", "boho", "organic", "spring"},
        event_affinity={"wedding": 0.9, "engagement": 0.8, "baby_shower": 0.9, "birthday": 0.6, "party": 0.5, "corporate": 0.3, "other": 0.6},
        default_colors=["linen", "sage", "forest", "brown"], family="serif-soft",
    ),
    Direction(
        id="cinematic_night",
        name="Cinematic Night",
        tagline="Dark ground, luminous type, photographs that glow.",
        rationale="A dark canvas makes photography feel cinematic and turns the type into light. Best when the event has evening energy.",
        heading_font="Playfair Display", body_font="Manrope", scale="display", heading_weight=400,
        spacing="comfortable", decoration="none", image_treatment="natural", dark=True,
        hero_variant="fullscreen", align="left",
        variants={"story": "split", "event_details": "editorial", "schedule": "timeline", "gallery": "editorial", "quote": "editorial", "rsvp": "split", "footer": "simple", "countdown": "large"},
        backgrounds={"rsvp": "surface"},
        tags={"evening", "night", "cinematic", "dramatic", "black tie", "glamorous", "moody", "dark", "gala", "new year", "formal"},
        event_affinity={"wedding": 0.7, "engagement": 0.6, "birthday": 0.8, "party": 1.0, "corporate": 0.7, "baby_shower": 0.1, "other": 0.6},
        default_colors=["black", "champagne", "ivory"], family="serif-dark",
    ),
    Direction(
        id="playful_bold",
        name="Playful Bold",
        tagline="Rounded geometric type, one saturated accent, generous joy.",
        rationale="A friendly, confident voice: big rounded headings and a single bright accent keep it festive without clutter.",
        heading_font="Outfit", body_font="Figtree", scale="display", heading_weight=600, heading_tracking="tight",
        spacing="comfortable", radius="lg", shadows="none", decoration="minimal", image_treatment="natural",
        hero_variant="centered", align="center",
        variants={"story": "centered", "event_details": "cards", "schedule": "timeline", "gallery": "grid", "quote": "centered", "rsvp": "card", "footer": "simple", "countdown": "large"},
        backgrounds={"countdown": "accent", "event_details": "surface"},
        tags={"fun", "playful", "colourful", "colorful", "bright", "kids", "joyful", "party", "pop", "cheerful", "energetic"},
        event_affinity={"birthday": 1.0, "party": 1.0, "baby_shower": 0.8, "wedding": 0.2, "engagement": 0.3, "corporate": 0.3, "other": 0.6},
        default_colors=["cream", "coral", "charcoal"], family="sans-round",
    ),
    Direction(
        id="corporate_clarity",
        name="Clear & Considered",
        tagline="Structured grid, humanist sans, information first.",
        rationale="Attendees need to scan quickly: strong hierarchy, cards for details, a clean speaker grid and a prominent registration.",
        heading_font="Manrope", body_font="Inter", scale="regular", heading_weight=600, heading_tracking="tight",
        spacing="compact", radius="sm", decoration="none", image_treatment="muted", max_width=1200,
        hero_variant="split", align="left",
        variants={"story": "columns", "event_details": "cards", "schedule": "list", "gallery": "grid", "quote": "editorial", "rsvp": "split", "footer": "simple", "countdown": "inline", "speakers": "grid"},
        backgrounds={"event_details": "surface", "speakers": "surface", "rsvp": "dark"},
        tags={"corporate", "professional", "conference", "tech", "clean", "clear", "business", "summit", "launch"},
        event_affinity={"corporate": 1.0, "other": 0.6, "party": 0.3, "birthday": 0.2, "wedding": 0.05, "engagement": 0.05, "baby_shower": 0.05},
        default_colors=["white", "navy", "graphite"], family="sans-clean",
    ),
    Direction(
        id="warm_film",
        name="Warm Film",
        tagline="Analogue tonality, asymmetric hero, a strip of photographs.",
        rationale="Film-like colour and an off-centre composition give the site a personal, documentary feel — like pages from an album.",
        heading_font="Instrument Serif", body_font="Jost", scale="display", heading_weight=400,
        spacing="comfortable", radius="none", decoration="minimal", image_treatment="film",
        hero_variant="asymmetric", align="left",
        variants={"story": "split", "event_details": "list", "schedule": "timeline", "gallery": "strip", "quote": "editorial", "rsvp": "minimal", "footer": "signature", "countdown": "inline"},
        backgrounds={"gallery": "surface"},
        tags={"film", "vintage", "analogue", "nostalgic", "warm", "personal", "documentary", "retro", "autumn", "cozy"},
        event_affinity={"wedding": 0.9, "engagement": 0.9, "birthday": 0.7, "party": 0.5, "baby_shower": 0.6, "corporate": 0.1, "other": 0.6},
        default_colors=["oat", "caramel", "cocoa"], family="serif-film",
    ),
    Direction(
        id="soft_modern",
        name="Soft Modern",
        tagline="Rounded serif display, pastel surfaces, gentle and clean.",
        rationale="Light, tender and uncluttered — a modern serif keeps it grown-up while soft colour keeps it gentle.",
        heading_font="DM Serif Display", body_font="DM Sans", scale="regular", heading_weight=400,
        spacing="comfortable", radius="md", decoration="minimal", image_treatment="natural",
        hero_variant="centered", align="center",
        variants={"story": "split", "event_details": "cards", "schedule": "list", "gallery": "grid", "quote": "centered", "rsvp": "card", "footer": "simple", "countdown": "inline"},
        backgrounds={"event_details": "surface", "rsvp": "surface"},
        tags={"soft", "gentle", "pastel", "tender", "baby", "light", "sweet", "delicate", "feminine", "spring"},
        event_affinity={"baby_shower": 1.0, "birthday": 0.7, "engagement": 0.6, "wedding": 0.5, "party": 0.5, "corporate": 0.1, "other": 0.5},
        default_colors=["pearl", "blush", "cocoa"], family="serif-soft",
    ),
]

DIRECTION_BY_ID = {d.id: d for d in DIRECTIONS}
