import { z } from "zod";

export const MATERIAL_SCENE_IDS = ["silk", "porcelain", "night-garden"] as const;
export const MATERIAL_LAYOUT_IDS = ["editorial", "immersive", "keepsake"] as const;

/** Public visual decisions only. Prompts and server-owned media are kept outside
 * this bounded concept; artwork references remain on the invitation draft. */
export const MaterialArtDirectionSchema = z.object({
  title: z.string().trim().min(1).max(100),
  scene: z.enum(MATERIAL_SCENE_IDS),
  layout: z.enum(MATERIAL_LAYOUT_IDS),
}).strict();
export type MaterialArtDirection = z.infer<typeof MaterialArtDirectionSchema>;
