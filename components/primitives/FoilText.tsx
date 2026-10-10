import type { ReactNode } from "react";

/** The layout grants this treatment only to its single hero title. */
export function FoilText({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  return <span className={enabled ? "foil-text" : undefined} data-foil={enabled || undefined}>{children}</span>;
}
