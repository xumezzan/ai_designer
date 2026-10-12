import type { CompositionId, LayoutId } from "../keys";
import { COMPOSITION_IDS } from "../keys";

export const layouts: Partial<Record<LayoutId, { compositions: readonly CompositionId[]; heroes: readonly string[] }>> = {
  "scroll-narrative": { compositions: COMPOSITION_IDS, heroes: ["typographic", "ornament-frame", "full-photo"] },
};

export function getLayout(id: LayoutId) { return layouts[id]; }
