import type { CompositionId, LayoutId } from "../keys";

export const layouts: Partial<Record<LayoutId, { compositions: readonly CompositionId[]; heroes: readonly string[] }>> = {
  "scroll-narrative": { compositions: ["letter", "poster", "folio", "arch", "botanical"], heroes: ["typographic", "ornament-frame", "full-photo"] },
};

export function getLayout(id: LayoutId) { return layouts[id]; }
