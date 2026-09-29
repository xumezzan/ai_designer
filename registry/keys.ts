/**
 * Registry key identifiers — the single source of truth for every id the theme
 * schema may reference. Validation rejects any key outside these lists, and a
 * preset registry must provide an object for a key before a theme using it can
 * pass `validateTheme`.
 *
 * The lists are declared in full ahead of the presets (e.g. `card-stack` and
 * `glass` arrive at M8) so that shipping a new preset never touches the theme
 * schema — see docs/decisions.md.
 */

export const SECTION_IDS = [
  "hero",
  "greeting",
  "countdown",
  "timeline",
  "venue",
  "dressCode",
  "rsvp",
  "footer",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const LAYOUT_IDS = ["scroll-narrative", "card-stack"] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const TYPE_SET_IDS = ["ceremony", "editorial"] as const;
export type TypeSetId = (typeof TYPE_SET_IDS)[number];

export const MATERIAL_SET_IDS = ["paper", "glass"] as const;
export type MaterialSetId = (typeof MATERIAL_SET_IDS)[number];

export const ORNAMENT_PACK_IDS = [
  "none",
  "uzbek-suzani",
  "geometric-islamic",
] as const;
export type OrnamentPackId = (typeof ORNAMENT_PACK_IDS)[number];

export const MOTION_IDS = ["still", "unfold", "drift", "overture"] as const;
export type MotionId = (typeof MOTION_IDS)[number];
