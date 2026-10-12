import type { CompositionId, LayoutId } from "../keys";
import { COMPOSITION_IDS, MATERIAL_COMPOSITIONS } from "../keys";

export const layouts: Partial<Record<LayoutId, { compositions: readonly CompositionId[]; heroes: readonly string[] }>> = {
  "scroll-narrative": { compositions: COMPOSITION_IDS.filter((id) => !(MATERIAL_COMPOSITIONS as readonly string[]).includes(id)), heroes: ["typographic", "ornament-frame", "full-photo"] },
  "card-stack": { compositions: MATERIAL_COMPOSITIONS, heroes: ["typographic", "ornament-frame"] },
};

export function getLayout(id: LayoutId) { return layouts[id]; }
