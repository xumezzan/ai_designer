import { z } from "zod";
import { Hex } from "./common";
import {
  LAYOUT_IDS,
  MATERIAL_SET_IDS,
  MOTION_IDS,
  ORNAMENT_PACK_IDS,
  SECTION_IDS,
  TYPE_SET_IDS,
} from "../../registry/keys";

/**
 * `theme.json` — the only thing the AI produces. Schema principle: the model
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
    hero: z.enum(["full-photo", "typographic", "ornament-frame"]),
    sectionOrder: z.array(z.enum(SECTION_IDS)),
  }),

  motion: z.object({
    preset: z.enum(MOTION_IDS),
    ambient: z.enum(["none", "dust", "petals", "snow"]),
  }),
});

export type Theme = z.infer<typeof Theme>;
export type ThemeInput = z.input<typeof Theme>;
export type Palette = Theme["palette"];
