import { z } from "zod";

export const DESIGN_ARCHETYPES = ["ARCH_EDITORIAL", "RAW_ASYMMETRIC", "BOTANICAL_PLATE", "RETRO_MONOGRAM", "MINIMALIST_TYPOGRAPHIC"] as const;
export const DESIGN_HEADING_FONTS = ["Cormorant Garamond", "Playfair Display"] as const;
export const DESIGN_BODY_FONTS = ["Montserrat", "Jost"] as const;
export const DESIGN_HERO_COMPONENTS = ["arch", "poster", "botanical", "folio", "letter"] as const;
export const DESIGN_ARCHETYPE_COMPONENTS = {
  ARCH_EDITORIAL: "arch",
  RAW_ASYMMETRIC: "poster",
  BOTANICAL_PLATE: "botanical",
  RETRO_MONOGRAM: "folio",
  MINIMALIST_TYPOGRAPHIC: "letter",
} as const;
export const DESIGN_PAPER_TEXTURES = ["cotton_deckle", "cold_press", "smooth_vellum"] as const;
export const DESIGN_HERO_ALIGNMENTS = ["center", "left_bleed", "asymmetric_offset"] as const;
export const DESIGN_CARD_FRAMINGS = ["double_fine_border", "arch_portal", "raw_deckle_shadow", "floating_minimal"] as const;
export const DESIGN_MASK_TYPES = ["soft_arch", "oval_portrait", "rectangular_passepartout", "organic_edge"] as const;
export const DESIGN_OVERLAY_BLENDS = ["none", "soft_light", "multiply"] as const;
export const DESIGN_SEAL_SYMBOLS = ["monogram", "botanical_branch", "olive_wreath", "minimal_crest"] as const;
export const DESIGN_SEAL_POSITIONS = ["hero_top", "envelope_flap", "rsvp_badge"] as const;
export const DESIGN_FOIL_LINE_STYLES = ["single_hairline", "double_concentric", "dotted_editorial"] as const;
export const DESIGN_TIMELINE_STYLES = ["minimal_thread", "vertical_cards", "horizontal_steps"] as const;
export const DESIGN_DRESSCODE_STYLES = ["swatch_circles", "fabric_cards", "color_palette_pills"] as const;
export const DESIGN_RSVP_STYLES = ["classic_stationery_card", "split_bottom_sheet", "letterpress_form"] as const;
export const DESIGN_GRAPHICS_PLACEMENTS = ["hero_background", "framed_illustration", "floating_botanical"] as const;

/** Class-shaped tokens are decoded by the compiler, never passed to className. */
export const DESIGN_TRACKING_LABELS = ["tracking-tighter", "tracking-tight", "tracking-normal", "tracking-wide", "tracking-wider", "tracking-widest"] as const;
const trackingLabels: readonly string[] = DESIGN_TRACKING_LABELS;
export function trackingTokenAmount(value: string): number | undefined {
  const match = /^tracking-\[(-?(?:\d+(?:\.\d+)?|\.\d+))em\]$/.exec(value);
  return match ? Number(match[1]) : undefined;
}
export const DesignHeadingTracking = z.string().max(36).refine((value) => {
  const amount = trackingTokenAmount(value);
  return trackingLabels.includes(value) || (amount !== undefined && amount >= -.08 && amount <= .3);
}, "Choose a registered tracking label or tracking-[N.em] within -0.08..0.3em");
export const DesignMetaTracking = z.string().max(36).refine((value) => {
  const amount = trackingTokenAmount(value);
  return trackingLabels.includes(value) || (amount !== undefined && amount >= .15 && amount <= .25);
}, "Metadata tracking must resolve to 0.15..0.25em");

/** The new stationery contract forbids pure white/black; legacy themes stay valid. */
export const DesignPigment = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Expected #RRGGBB")
  .transform((value) => value.toUpperCase())
  .refine((value) => value !== "#FFFFFF" && value !== "#000000", "Use a natural paper tone or organic pigment");

const text = (max: number) => z.string().trim().min(1).max(max);
export const DesignSpec = z.object({
  design_title: text(100),
  archetype: z.enum(DESIGN_ARCHETYPES),
  similarity_defense: text(800),
  canvas: z.object({
    background_color: DesignPigment,
    text_color_primary: DesignPigment,
    text_color_muted: DesignPigment,
    accent_color: DesignPigment,
    noise_opacity: z.number().min(.03).max(.07),
    paper_texture: z.enum(DESIGN_PAPER_TEXTURES),
  }).strict(),
  typography: z.object({
    heading_font: z.enum(DESIGN_HEADING_FONTS),
    body_font: z.enum(DESIGN_BODY_FONTS),
    heading_tracking: DesignHeadingTracking,
    meta_tracking: DesignMetaTracking,
    italic_accent_words: z.array(text(60)).min(1).max(24),
  }).strict(),
  composition_rules: z.object({
    hero_alignment: z.enum(DESIGN_HERO_ALIGNMENTS),
    card_framing: z.enum(DESIGN_CARD_FRAMINGS),
    photo_treatment: z.object({
      mask_type: z.enum(DESIGN_MASK_TYPES),
      overlay_blend: z.enum(DESIGN_OVERLAY_BLENDS),
      overlay_tint: DesignPigment.nullable(),
    }).strict(),
    decorations: z.object({
      wax_seal: z.object({
        enabled: z.boolean(),
        color: DesignPigment,
        symbol: z.enum(DESIGN_SEAL_SYMBOLS),
        position: z.enum(DESIGN_SEAL_POSITIONS),
      }).strict(),
      foil_lines: z.object({
        enabled: z.boolean(),
        style: z.enum(DESIGN_FOIL_LINE_STYLES),
      }).strict(),
    }).strict(),
  }).strict(),
  component_manifest: z.object({
    hero_layout_component: z.enum(DESIGN_HERO_COMPONENTS),
    timeline_style: z.enum(DESIGN_TIMELINE_STYLES),
    dresscode_style: z.enum(DESIGN_DRESSCODE_STYLES),
    rsvp_style: z.enum(DESIGN_RSVP_STYLES),
  }).strict(),
  graphics_generation: z.object({
    needed: z.boolean(),
    prompt: z.string().trim().max(2400),
    placement: z.enum(DESIGN_GRAPHICS_PLACEMENTS),
  }).strict(),
}).strict().superRefine((spec, context) => {
  if (spec.component_manifest.hero_layout_component !== DESIGN_ARCHETYPE_COMPONENTS[spec.archetype]) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["component_manifest", "hero_layout_component"], message: `Use ${DESIGN_ARCHETYPE_COMPONENTS[spec.archetype]} for ${spec.archetype}` });
  }
  if (spec.graphics_generation.needed && !spec.graphics_generation.prompt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["graphics_generation", "prompt"], message: "Generated artwork needs an English art-direction prompt" });
  }
  if (spec.composition_rules.photo_treatment.overlay_blend === "none" && spec.composition_rules.photo_treatment.overlay_tint !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["composition_rules", "photo_treatment", "overlay_tint"], message: "An absent photo overlay must have a null tint" });
  }
});
export type DesignSpec = z.infer<typeof DesignSpec>;
export type DesignSpecInput = z.input<typeof DesignSpec>;
