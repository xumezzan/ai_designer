import { z } from "zod";

export const STUDIO_TEMPLATE_IDS = ["editorial", "botanical", "classic", "modern", "corporate", "nocturne", "heritage"] as const;
export const STUDIO_PALETTE_IDS = ["ivory", "sage", "rose", "champagne", "terracotta", "ink", "wine", "slate", "cobalt", "clay", "forest", "cinnabar", "modern-editorial", "botanical-haute", "velvet-noir"] as const;
export const STUDIO_FONT_PAIR_IDS = ["editorial", "ceremony", "poetic", "modernist", "gallery", "modern-editorial", "botanical-haute", "velvet-noir"] as const;
export const STUDIO_ORNAMENT_SET_IDS = ["editorial-rules", "botanical-engraving", "classic-monogram", "graphic-ribbon", "corporate-grid", "deco-lines", "chinese-garden"] as const;

export const STUDIO_HERO_LAYOUTS = ["fullscreen-cover", "split-editorial", "framed-arch", "typographic-poster", "minimal-card"] as const;
export const STUDIO_PHOTO_SHAPES = ["sharp", "rounded", "arch", "pill", "circle", "polaroid"] as const;
export const STUDIO_SURFACE_STYLES = ["flat", "glassmorphism", "bordered-hairline", "elevated-card", "soft-gradient"] as const;
export const STUDIO_SPACING_SCALES = ["compact-poster", "balanced", "airy-gallery"] as const;
export const STUDIO_TYPOGRAPHY_ACCENTS = ["italic-serif-accent", "uppercase-wide-tracking", "oversized-display", "classic-centered"] as const;
export const STUDIO_DECOR_PLACEMENTS = ["corners", "dividers", "background-pattern", "frame"] as const;
export const STUDIO_DECOR_DENSITIES = ["none", "subtle", "rich"] as const;
export const STUDIO_MOTION_PRESETS = ["still", "drift", "unfold"] as const;
export const STUDIO_SECTION_ORDERS = ["story-first", "event-first", "programme-first"] as const;
export const STUDIO_SECTION_VARIANTS = {
  countdown: ["tiles", "date-led", "inline"],
  program: ["timeline", "cards", "editorial-list"],
  venue: ["stacked", "split", "card"],
  gallery: ["grid", "filmstrip", "editorial"],
  rsvp: ["card", "split", "minimal"],
  story: ["narrative", "editorial", "letter"],
  dressCode: ["classic", "swatch-led", "split"],
  wishes: ["note", "letter", "dedication"],
} as const;

/** Bounded design decisions; dimensions, CSS, URLs and responsive rules stay in code. */
export const StudioComposition = z.object({
  heroLayout: z.enum(STUDIO_HERO_LAYOUTS),
  photoShape: z.enum(STUDIO_PHOTO_SHAPES),
  surfaceStyle: z.enum(STUDIO_SURFACE_STYLES),
  spacingScale: z.enum(STUDIO_SPACING_SCALES),
  typographyAccent: z.enum(STUDIO_TYPOGRAPHY_ACCENTS),
  motionPreset: z.enum(STUDIO_MOTION_PRESETS).optional(),
  sectionOrder: z.enum(STUDIO_SECTION_ORDERS).optional(),
  decorConfig: z.object({
    placement: z.enum(STUDIO_DECOR_PLACEMENTS),
    density: z.enum(STUDIO_DECOR_DENSITIES),
    opacity: z.number().min(0).max(1),
  }).strict(),
  sectionVariants: z.object({
    countdown: z.enum(STUDIO_SECTION_VARIANTS.countdown),
    program: z.enum(STUDIO_SECTION_VARIANTS.program),
    venue: z.enum(STUDIO_SECTION_VARIANTS.venue),
    gallery: z.enum(STUDIO_SECTION_VARIANTS.gallery),
    rsvp: z.enum(STUDIO_SECTION_VARIANTS.rsvp),
    story: z.enum(STUDIO_SECTION_VARIANTS.story).optional(),
    dressCode: z.enum(STUDIO_SECTION_VARIANTS.dressCode).optional(),
    wishes: z.enum(STUDIO_SECTION_VARIANTS.wishes).optional(),
  }).strict(),
}).strict();
export type StudioComposition = z.infer<typeof StudioComposition>;

const enumSchema = (values: readonly string[]) => ({ type: "string" as const, enum: [...values] });
const requiredKeys = (shape: z.ZodRawShape) => Object.keys(shape).filter((key) => !shape[key].isOptional());
/** Shared with the provider tool and inventory; derive every enum from the runtime schema. */
export const STUDIO_COMPOSITION_JSON_SCHEMA = {
  type: "object" as const, additionalProperties: false,
  required: requiredKeys(StudioComposition.shape),
  properties: {
    heroLayout: enumSchema(STUDIO_HERO_LAYOUTS), photoShape: enumSchema(STUDIO_PHOTO_SHAPES),
    surfaceStyle: enumSchema(STUDIO_SURFACE_STYLES), spacingScale: enumSchema(STUDIO_SPACING_SCALES),
    typographyAccent: enumSchema(STUDIO_TYPOGRAPHY_ACCENTS),
    motionPreset: enumSchema(STUDIO_MOTION_PRESETS),
    sectionOrder: enumSchema(STUDIO_SECTION_ORDERS),
    decorConfig: { type: "object" as const, additionalProperties: false, required: ["placement", "density", "opacity"], properties: {
      placement: enumSchema(STUDIO_DECOR_PLACEMENTS), density: enumSchema(STUDIO_DECOR_DENSITIES), opacity: { type: "number" as const, minimum: 0, maximum: 1 },
    } },
    sectionVariants: { type: "object" as const, additionalProperties: false, required: requiredKeys(StudioComposition.shape.sectionVariants.shape),
      properties: Object.fromEntries(Object.entries(STUDIO_SECTION_VARIANTS).map(([key, values]) => [key, enumSchema(values)])),
    },
  },
};

/** Missing composition is intentional: preserve the exact legacy renderer and recipe. */
export const StudioSelection = z.object({
  templateId: z.enum(STUDIO_TEMPLATE_IDS),
  paletteId: z.enum(STUDIO_PALETTE_IDS),
  fontPairId: z.enum(STUDIO_FONT_PAIR_IDS),
  ornamentSetId: z.enum(STUDIO_ORNAMENT_SET_IDS),
  composition: StudioComposition.optional(),
}).strict();
export type StudioSelection = z.infer<typeof StudioSelection>;
export type StudioTemplateId = StudioSelection["templateId"];
export type StudioPaletteId = StudioSelection["paletteId"];
export type StudioFontPairId = StudioSelection["fontPairId"];
export type StudioOrnamentSetId = StudioSelection["ornamentSetId"];

/** An immutable recipe version makes approved-template reuse explicit. */
export const StudioTemplate = StudioSelection.omit({ templateId: true }).extend({
  id: z.enum(STUDIO_TEMPLATE_IDS),
  revision: z.literal(1),
}).strict();
export type StudioTemplate = z.infer<typeof StudioTemplate>;

export const StudioDesignPreference = z.object({
  templateId: z.enum(["auto", ...STUDIO_TEMPLATE_IDS]).default("auto"),
  paletteId: z.enum(["auto", ...STUDIO_PALETTE_IDS]).default("auto"),
}).strict();

/** Refinement keeps the authored composition; only approved alternatives vary. */
export const StudioTemplatePatch = StudioTemplate.pick({ paletteId: true, fontPairId: true }).partial().strict();
