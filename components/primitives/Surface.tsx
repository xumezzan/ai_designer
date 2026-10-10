import type { ReactNode } from "react";
import { GrainOverlay } from "./GrainOverlay";
import { DeckleEdge } from "./DeckleEdge";

export function Surface({ children }: { children: ReactNode }) {
  return <div className="invitation-surface"><GrainOverlay />{children}<DeckleEdge /></div>;
}
