import type { ReactNode } from "react";
import type { Theme } from "@/lib/schema/theme";

/** The layout grants this treatment only to its single hero title. */
export function FoilText({ children, enabled, finishing = "none" }: { children: ReactNode; enabled: boolean; finishing?: Theme["finishing"]["type"] }) {
  const finish = finishing === "blind-emboss" ? "blind-deboss" : enabled
    ? { none: "foil-text", "gold-foil": "foil-text foil-gold", "silver-chrome": "foil-text foil-silver", "bronze-patina": "foil-text foil-bronze" }[finishing]
    : undefined;
  return <span className={finish} data-foil={enabled && finishing !== "blind-emboss" || undefined}>{children}</span>;
}
