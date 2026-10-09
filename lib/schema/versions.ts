import { z } from "zod";
import { safeId } from "./ids";
import { Theme } from "./theme";
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

// Optional fields wrap defaults so an omitted field never becomes a patch.
export const ThemePatch = z.object({
  palette: Theme.shape.palette.partial().strict().optional(),
  typeSet: Theme.shape.typeSet.optional(), materialSet: Theme.shape.materialSet.optional(),
  artwork: z.enum(["none", "suzani-atelier"]).optional(),
  foil: Theme.shape.foil.partial().strict().optional(),
  ornament: Theme.shape.ornament.partial().strict().optional(),
  layout: Theme.shape.layout.partial().strict().optional(),
  photos: z.array(Theme.shape.photos.unwrap().element.strict()).max(40).optional(),
  motion: Theme.shape.motion.partial().strict().optional(),
}).strict().refine((patch) => Object.keys(patch).length <= 4, "Refinement must be a small partial edit, never a regenerated theme");
export type ThemePatch = z.infer<typeof ThemePatch>;
