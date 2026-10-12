import { z } from "zod";
import { Hex } from "./common";
import { VisualRef } from "./visual";
import {
  LAYOUT_IDS,
  COMPOSITION_IDS,
  ARTWORK_IDS,
  MATERIAL_SET_IDS,
  MOTION_IDS,
  ORNAMENT_PACK_IDS,
  SECTION_IDS,
  TYPE_SET_IDS,
} from "../../registry/keys";

/**
 * `theme.json` selects hand-built presets and separately generated art. The model
 * picks named sets from registries, with bounded physicality and tracking
 * tokens. Font faces, responsive sizes, leading, spacing and animation curves
 * remain hand-tuned in the renderer. These tokens never accept arbitrary CSS.
 *
 * The schema must never gain: text alignment, radii, shadows, font sizes,
 * padding, line length, animation durations.
 */
export const SURFACE_TEXTURES = ["smooth", "cotton-paper", "raw-silk", "deep-velvet", "matte-stone"] as const;
export const SURFACE_BORDERS = ["none", "hairline", "double-hairline", "blind-deboss", "frame-inset"] as const;
export const FINISHING_TYPES = ["none", "gold-foil", "silver-chrome", "blind-emboss", "bronze-patina"] as const;
export const DISPLAY_SCALES = ["monumental", "editorial", "understated"] as const;

// A light/color token, never a URL, declaration, variable or arbitrary CSS
// function. The small grammar also keeps resource-loading functions out.
export const AmbientGlow = z.string().min(1).max(500).refine((value) => {
  if (!/^(?:#[\da-f]{6}|(?:hsla?|rgba?|(?:radial|linear)-gradient)\(.+\))$/i.test(value)) return false;
  const rest = value.replace(/#[\da-f]{6}\b/gi, "0")
    .replace(/(?:radial-gradient|linear-gradient|hsla?|rgba?)\(/gi, "(")
    .replace(/(\d)(?:deg|turn|grad|rad|px|rem|em)\b/gi, "$1")
    .replace(/\b(?:transparent|ellipse|circle|at|center|top|bottom|left|right|to|closest-side|farthest-corner|deg)\b/gi, "");
  let depth = 0;
  for (const char of rest) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth < 0 || depth > 3) return false;
  }
  return depth === 0 && /^[\d\s.,()%+\/\-]*$/.test(rest);
}, "Expected a bounded CSS color or light gradient without URLs or declarations");

export const Tracking = z.string().max(24).regex(/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:em|px)$/)
  .refine((value) => {
    const amount = parseFloat(value);
    return value.endsWith("em") ? amount >= -0.08 && amount <= 0.3 : amount >= -1 && amount <= 4;
  }, "Tracking must stay within -0.08..0.3em or -1..4px");

export const Atmosphere = z.object({
  grainIntensity: z.number().min(0).max(0.15).default(0),
  ambientGlow: AmbientGlow.optional(),
  vignetteStrength: z.number().min(0).max(0.8).default(0),
}).strict().default({});
export const SurfaceTokens = z.object({
  texture: z.enum(SURFACE_TEXTURES).default("smooth"),
  borderStyle: z.enum(SURFACE_BORDERS).default("none"),
}).strict().default({});
export const Finishing = z.object({
  type: z.enum(FINISHING_TYPES).default("none"),
  sheenAngle: z.number().min(0).max(360).default(135),
}).strict().default({});
export const TypographyScale = z.object({
  displayScale: z.enum(DISPLAY_SCALES).default("editorial"),
  // Omitted tracking inherits the locale-safe registered type set.
  headlineTracking: Tracking.optional(),
  metaTracking: Tracking.optional(),
}).strict().default({});

export const Theme = z.object({
  meta: z.object({
    name: z.string(),
    mood: z.array(z.string()).max(4),
    // One paragraph: what the key decision is and why.
    rationale: z.string().max(400),
  }),

  palette: z.object({
    bg: Hex,
    surface: Hex,
    ink: Hex,
    muted: Hex,
    accent: Hex,
    accentAlt: Hex,
  }),

  // Hand-tuned typographic pairing. See registry/typesets.
  typeSet: z.enum(TYPE_SET_IDS),

  // Hand-built material. See registry/materials.
  materialSet: z.enum(MATERIAL_SET_IDS),
  artwork: z.enum(ARTWORK_IDS).default("none"),
  generatedVisual: VisualRef.optional(),
  foil: z.object({ enabled: z.boolean(), color: Hex }),
  atmosphere: Atmosphere,
  surface: SurfaceTokens,
  finishing: Finishing,
  typographyScale: TypographyScale,

  ornament: z.object({
    pack: z.enum(ORNAMENT_PACK_IDS), // includes 'none'
    density: z.enum(["light", "medium"]), // 'rich' deliberately excluded
    placement: z
      .array(z.enum(["divider", "corners", "hero-frame", "watermark"]))
      .max(2),
    color: z.enum(["accent", "accentAlt", "muted"]),
  }),

  layout: z.object({
    preset: z.enum(LAYOUT_IDS),
    composition: z.enum(COMPOSITION_IDS).default("letter"),
    hero: z.enum(["full-photo", "typographic", "ornament-frame"]),
    photoArrangement: z.enum(["row", "stack", "offset"]).default("row"),
    visualPlacement: z.enum(["band", "side-left", "side-right", "medallion", "inset"]).default("band"),
    nameFlow: z.enum(["natural", "stacked"]).default("natural"),
    sectionOrder: z.array(z.enum(SECTION_IDS)),
  }),

  // Per-composition placement; crop/quality/treatment remain in the asset plan.
  photos: z.array(z.object({
    id: z.string().min(1).max(100),
    section: z.enum(SECTION_IDS),
    index: z.number().int().min(0).max(40),
    position: z.enum(["before", "after"]),
  })).max(40).optional(),

  motion: z.object({
    preset: z.enum(MOTION_IDS),
    ambient: z.enum(["none", "dust", "petals", "snow"]),
  }),
});

export type Theme = z.infer<typeof Theme>;
export const ThemeSchema = Theme;
export type ThemeInput = z.input<typeof Theme>;
export type Palette = Theme["palette"];
