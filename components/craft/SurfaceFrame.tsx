import type { ReactNode } from "react";
import type { Theme } from "@/lib/schema/theme";

/** Decorative inset rails do not change the composition's content width. */
export function SurfaceFrame({ children, surface }: { children: ReactNode; surface: Theme["surface"] }) {
  return <div className="surface-frame" data-texture={surface.texture} data-border-style={surface.borderStyle}>
    <div className="surface-rails" aria-hidden="true" />
    {children}
  </div>;
}
