import { z } from "zod";
import { Hex } from "./common";
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
 * picks named sets from registries; it never sets numeric craft values
 * (tracking, leading, scale ratios, grain density, durations). Those live in
 * the registries, tuned once by hand.
 *
 * The schema must never gain: text alignment, radii, shadows, font sizes,
 * padding, line length, animation durations.
 */
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
  foil: z.object({ enabled: z.boolean(), color: Hex }),

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
export type ThemeInput = z.input<typeof Theme>;
export type Palette = Theme["palette"];
