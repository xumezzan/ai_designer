import { z } from "zod";

/** Colour as #RRGGBB. Palette semantics live in the theme schema. */
export const Hex = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "expected a hex colour like #1F2A24");
export type Hex = z.infer<typeof Hex>;
