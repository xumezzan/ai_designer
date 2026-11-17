import * as ids from "@/lib/schema/designSpec";

const string = { type: "string" };
const bool = { type: "boolean" };
const enumeration = (values: readonly string[]) => ({ type: "string", enum: values });
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const pigment = { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", description: "Natural pigment; #FFFFFF and #000000 are forbidden." };

/** Exact user-facing specification inside a transport envelope for facts/photos. */
export function designSpecToolSchema() {
  return object({
    design_title: { ...string, minLength: 1, maxLength: 100 },
    archetype: enumeration(ids.DESIGN_ARCHETYPES),
    similarity_defense: { ...string, minLength: 1, maxLength: 800 },
    canvas: object({ background_color: pigment, text_color_primary: pigment, text_color_muted: pigment, accent_color: pigment,
      noise_opacity: { type: "number", minimum: .03, maximum: .07 }, paper_texture: enumeration(ids.DESIGN_PAPER_TEXTURES) }),
    typography: object({ heading_font: enumeration(ids.DESIGN_HEADING_FONTS), body_font: enumeration(ids.DESIGN_BODY_FONTS),
      heading_tracking: { ...string, maxLength: 36, description: "Registered tracking label, or bounded tracking-[N.em]." },
      meta_tracking: { ...string, maxLength: 36, description: "tracking-widest or tracking-[0.15em]..tracking-[0.25em]." },
      italic_accent_words: { type: "array", items: { ...string, minLength: 1, maxLength: 60 }, minItems: 1, maxItems: 24 } }),
    composition_rules: object({ hero_alignment: enumeration(ids.DESIGN_HERO_ALIGNMENTS), card_framing: enumeration(ids.DESIGN_CARD_FRAMINGS),
      photo_treatment: object({ mask_type: enumeration(ids.DESIGN_MASK_TYPES), overlay_blend: enumeration(ids.DESIGN_OVERLAY_BLENDS), overlay_tint: { anyOf: [pigment, { type: "null" }] } }),
      decorations: object({ wax_seal: object({ enabled: bool, color: pigment, symbol: enumeration(ids.DESIGN_SEAL_SYMBOLS), position: enumeration(ids.DESIGN_SEAL_POSITIONS) }),
        foil_lines: object({ enabled: bool, style: enumeration(ids.DESIGN_FOIL_LINE_STYLES) }) }) }),
    component_manifest: object({ hero_layout_component: enumeration(ids.DESIGN_HERO_COMPONENTS), timeline_style: enumeration(ids.DESIGN_TIMELINE_STYLES),
      dresscode_style: enumeration(ids.DESIGN_DRESSCODE_STYLES), rsvp_style: enumeration(ids.DESIGN_RSVP_STYLES) }),
    graphics_generation: object({ needed: bool, prompt: { ...string, maxLength: 2400 }, placement: enumeration(ids.DESIGN_GRAPHICS_PLACEMENTS) }),
  });
}
