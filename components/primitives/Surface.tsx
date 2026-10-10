import type { ReactNode } from "react";
import { GrainOverlay } from "./GrainOverlay";
import { DeckleEdge } from "./DeckleEdge";
import { SurfaceFrame } from "@/components/craft/SurfaceFrame";
import type { Theme } from "@/lib/schema/theme";

export function Surface({ children, surface }: { children: ReactNode; surface: Theme["surface"] }) {
  return <div className="invitation-surface"><SurfaceFrame surface={surface}><GrainOverlay />{children}<DeckleEdge /></SurfaceFrame></div>;
}
