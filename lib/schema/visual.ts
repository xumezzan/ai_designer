import { z } from "zod";

// Server-issued reference. Model tools and client refinement patches exclude it.
export const VisualRef = z.object({
  id: z.string().uuid(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  width: z.number().int().min(256).max(4096), height: z.number().int().min(256).max(4096),
}).strict();
export const DesignIntent = z.object({
  summary: z.string().min(1).max(500),
  cues: z.array(z.string().min(1).max(160)).min(1).max(6),
  avoid: z.array(z.string().min(1).max(160)).max(6),
  referenceNotes: z.string().max(800),
  artworkPrompt: z.string().min(1).max(2400),
}).strict();
export const VisualRecord = VisualRef.extend({
  model: z.string().min(1).max(100), prompt: z.string().min(1).max(5000),
  createdAt: z.string().datetime(), references: z.number().int().min(0).max(40),
}).strict();
export type VisualRef = z.infer<typeof VisualRef>;
export type VisualRecord = z.infer<typeof VisualRecord>;
export type GeneratedVisual = { record: VisualRecord; data: Buffer };
