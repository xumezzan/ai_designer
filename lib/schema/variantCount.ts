import { z } from "zod";

export const VariantCount = z.number().int().min(1).max(5);

export function variantCountLabel(count: number) {
  return `${count} ${count === 1 ? "вариант" : count >= 2 && count <= 4 ? "варианта" : "вариантов"}`;
}
