import type { CSSProperties, ReactNode } from "react";

/** The heading remains a normal grid item; only its text responds to its
 * actual column width. Omitting the measure preserves existing renderers. */
export function FittedHeadingText({ measure, children }: { measure?: number; children: ReactNode }) {
  return measure === undefined ? <>{children}</> : <span className="studio-fitted-heading-text" style={{ "--studio-heading-measure": measure } as CSSProperties}>{children}</span>;
}
