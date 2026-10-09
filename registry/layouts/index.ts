import type { CompositionId, LayoutId } from "../keys";

export const layouts: Partial<Record<LayoutId, { compositions: readonly CompositionId[]; heroes: readonly string[] }>> = {
  "scroll-narrative": { compositions: ["letter", "poster", "folio", "arch", "botanical"], heroes: ["typographic", "ornament-frame"] },
};

export function getLayout(id: LayoutId) { return layouts[id]; }
