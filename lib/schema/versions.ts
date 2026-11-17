import { z } from "zod";
import { safeId } from "./ids";
import { Theme } from "./theme";
import { DesignSpec } from "./designSpec";
import { StudioTemplatePatch } from "./studioTemplate";
import type { QaState } from "./qa";

export const VersionId = z.string().regex(/^[1-9]\d{0,4}$/);
export const Change = z.object({ path: z.string().max(100), before: z.string().max(25000), after: z.string().max(25000) }).strict();
export const VersionRecord = z.object({
  version: VersionId, createdAt: z.string().datetime(), fromVersion: VersionId.nullable(),
  instruction: z.string().max(2000), summary: z.string().max(500),
  model: z.string().max(100), elapsedMs: z.number().nonnegative(),
  changes: z.array(Change).max(100), adjustments: z.array(z.string()).max(100),
}).strict();
export type VersionRecord = z.infer<typeof VersionRecord>;
export type HistoryItem = { version: string; name: string; record: VersionRecord | null; qa?: QaState };
export const Approval = z.object({ conceptId: z.string().refine(safeId), version: VersionId, approvedAt: z.string().datetime(), qa: z.object({ runId: z.string().uuid(), override: z.boolean() }).strict().optional() }).strict();
export type Approval = z.infer<typeof Approval>;

const spec = DesignSpec.innerType().shape;
const composition = spec.composition_rules.shape;
const decorations = composition.decorations.shape;

/** Refinement selects already built treatments; it never requests new art or metadata. */
export const DesignSpecPatch = z.object({
  archetype: spec.archetype.optional(),
  canvas: spec.canvas.partial().strict().optional(),
  typography: spec.typography.partial().strict().optional(),
  composition_rules: z.object({
    hero_alignment: composition.hero_alignment.optional(),
    card_framing: composition.card_framing.optional(),
    photo_treatment: composition.photo_treatment.partial().strict().optional(),
    decorations: z.object({
      wax_seal: decorations.wax_seal.partial().strict().optional(),
      foil_lines: decorations.foil_lines.partial().strict().optional(),
    }).strict().optional(),
  }).strict().optional(),
  component_manifest: spec.component_manifest.partial().strict().optional(),
  graphics_generation: spec.graphics_generation.pick({ placement: true }).partial().strict().optional(),
}).strict();
export type DesignSpecPatch = z.infer<typeof DesignSpecPatch>;

// Optional fields wrap defaults so an omitted field never becomes a patch.
export const ThemePatch = z.object({
  studioTemplate: StudioTemplatePatch.optional(),
  designSpec: DesignSpecPatch.optional(),
  palette: Theme.shape.palette.partial().strict().optional(),
  typeSet: Theme.shape.typeSet.optional(), materialSet: Theme.shape.materialSet.optional(),
  artwork: z.enum(["none", "suzani-atelier"]).optional(),
  foil: Theme.shape.foil.partial().strict().optional(),
  atmosphere: Theme.shape.atmosphere.removeDefault().partial().optional(),
  surface: Theme.shape.surface.removeDefault().partial().optional(),
  finishing: Theme.shape.finishing.removeDefault().partial().optional(),
  typographyScale: Theme.shape.typographyScale.removeDefault().partial().optional(),
  ornament: Theme.shape.ornament.partial().strict().optional(),
  layout: Theme.shape.layout.partial().strict().optional(),
  photos: z.array(Theme.shape.photos.unwrap().element.strict()).max(40).optional(),
  motion: Theme.shape.motion.partial().strict().optional(),
}).strict().refine((patch) => Object.keys(patch).length - (patch.designSpec ? 1 : 0) + Object.keys(patch.designSpec ?? {}).length <= 4, "Refinement must be a small partial edit of at most four categories, never a regenerated theme");
export type ThemePatch = z.infer<typeof ThemePatch>;
