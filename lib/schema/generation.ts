import { z } from "zod";
import { Theme } from "./theme";
import { safeId } from "./ids";
import { DesignIntent } from "./visual";

export const SharedStyle = Theme.pick({ palette: true, typeSet: true, materialSet: true, artwork: true, generatedVisual: true, foil: true, motion: true }).extend({
  intent: DesignIntent.optional(),
  name: z.string().min(1).max(100),
  mood: z.array(z.string().min(1).max(60)).min(1).max(4),
  rationale: z.string().min(1).max(400),
  ornament: Theme.shape.ornament.omit({ placement: true }),
}).strict();
export const Composition = z.object({
  name: z.string().min(1).max(100),
  rationale: z.string().min(1).max(400),
  layout: Theme.shape.layout,
  ornamentPlacement: Theme.shape.ornament.shape.placement,
  photos: Theme.shape.photos.unwrap(),
}).strict();
export const DesignSeries = z.object({ style: SharedStyle, variants: z.array(Composition).length(5) }).strict();
export type DesignSeries = z.infer<typeof DesignSeries>;

export const Generation = z.object({
  batchId: z.string().uuid(),
  createdAt: z.string().datetime(),
  brief: z.string().min(1).max(150000),
  model: z.string().min(1).max(100),
  elapsedMs: z.number().nonnegative(),
  style: SharedStyle,
  adjustments: z.array(z.string()).max(100),
  references: z.number().int().min(0).max(40),
  concepts: z.array(z.object({ id: z.string().refine(safeId), version: z.string().regex(/^[1-9]\d{0,4}$/) })).length(5),
});
export type Generation = z.infer<typeof Generation>;
