"""Design DSL (mirror of apps/web/src/design/schema.ts).

Pydantic validation guarantees that anything the AI produces is a
structurally valid website before it ever reaches the renderer.
"""
from __future__ import annotations

import secrets
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

EventType = Literal["wedding", "birthday", "engagement", "party", "corporate", "baby_shower", "other"]
SpacingScale = Literal["compact", "comfortable", "airy"]
RadiusScale = Literal["none", "sm", "md", "lg"]
ShadowLevel = Literal["none", "soft"]
DecorationLevel = Literal["none", "minimal", "moderate"]
AnimationLevel = Literal["none", "subtle", "moderate"]
ImageTreatment = Literal["natural", "film", "muted", "mono", "warm"]
TypeScale = Literal["compact", "regular", "display"]
SectionType = Literal[
    "hero", "story", "event_details", "schedule", "gallery", "countdown", "quote", "map",
    "dress_code", "speakers", "rsvp", "text", "image", "divider", "contact", "footer",
]

SECTION_VARIANTS: dict[str, list[str]] = {
    "hero": ["centered", "split", "fullscreen", "editorial", "minimal", "asymmetric"],
    "story": ["split", "centered", "columns"],
    "event_details": ["cards", "list", "editorial"],
    "schedule": ["timeline", "list"],
    "gallery": ["grid", "editorial", "strip"],
    "countdown": ["inline", "large"],
    "quote": ["centered", "editorial"],
    "map": ["embed", "card"],
    "dress_code": ["simple", "swatches"],
    "speakers": ["grid", "list"],
    "rsvp": ["card", "minimal", "split"],
    "text": ["prose", "statement"],
    "image": ["full", "contained"],
    "divider": ["line", "space", "ornament"],
    "contact": ["simple"],
    "footer": ["simple", "signature"],
}


def new_id(prefix: str = "sec") -> str:
    return f"{prefix}_{secrets.token_hex(4)}"


class ThemeColors(BaseModel):
    background: str
    surface: str
    text: str
    muted: str
    accent: str
    accentText: str


class ThemeTypography(BaseModel):
    headingFont: str
    bodyFont: str
    scale: TypeScale = "regular"
    headingWeight: Literal[300, 400, 500, 600, 700] = 400
    headingCase: Literal["none", "uppercase"] = "none"
    headingTracking: Literal["tight", "normal", "wide"] = "normal"
    headingItalic: bool = False


class Theme(BaseModel):
    colors: ThemeColors
    typography: ThemeTypography
    spacing: SpacingScale = "comfortable"
    radius: RadiusScale = "none"
    shadows: ShadowLevel = "none"
    decoration: DecorationLevel = "minimal"
    animation: AnimationLevel = "subtle"
    imageTreatment: ImageTreatment = "natural"


class Layout(BaseModel):
    maxWidth: Literal[960, 1080, 1200, 1320] = 1200


class SectionStyle(BaseModel):
    background: Literal["default", "surface", "accent", "dark"] = "default"
    paddingY: Literal["sm", "md", "lg", "xl"] = "lg"
    align: Literal["left", "center"] = "center"
    headingSize: Literal["sm", "md", "lg", "xl"] = "md"
    textColor: str | None = None
    backgroundColor: str | None = None


class Section(BaseModel):
    id: str = Field(default_factory=new_id)
    type: SectionType
    variant: str = ""
    visible: bool = True
    props: dict[str, Any] = Field(default_factory=dict)
    style: SectionStyle = Field(default_factory=SectionStyle)

    @field_validator("variant")
    @classmethod
    def _v(cls, v, info):
        return v

    def model_post_init(self, __context: Any) -> None:
        variants = SECTION_VARIANTS.get(self.type, [""])
        if self.variant not in variants:
            self.variant = variants[0]


class DesignMeta(BaseModel):
    conceptName: str
    direction: str
    rationale: str
    eventType: EventType = "wedding"


class DesignDocument(BaseModel):
    version: Literal[1] = 1
    meta: DesignMeta
    theme: Theme
    layout: Layout = Field(default_factory=Layout)
    sections: list[Section]


class EditOperation(BaseModel):
    target: str
    action: Literal["update", "remove", "add", "move", "set_variant"]
    property: str | None = None
    value: Any = None
    section: dict[str, Any] | None = None
    index: int | None = None


class EditProposal(BaseModel):
    summary: str
    operations: list[EditOperation]
