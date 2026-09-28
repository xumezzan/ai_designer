"use client";
import { createContext, useContext } from "react";
import type { DesignDocument, Section } from "@/design/schema";

export interface RendererContextValue {
  doc: DesignDocument;
  /** editing affordances on/off */
  editable: boolean;
  selectedSectionId?: string | null;
  selectedElement?: string | null;
  onSelect?: (sectionId: string, element?: string) => void;
  onTextChange?: (sectionId: string, prop: string, value: string) => void;
  /** viewport emulation so responsive rules can be previewed inside the editor */
  viewport: "desktop" | "tablet" | "mobile";
  /** slug of the published project, used by RSVP */
  projectId?: string;
  publicSlug?: string;
}

export const RendererContext = createContext<RendererContextValue | null>(null);

export function useRenderer() {
  const ctx = useContext(RendererContext);
  if (!ctx) throw new Error("useRenderer must be used inside SiteRenderer");
  return ctx;
}

export const SectionContext = createContext<Section | null>(null);
export function useSection() {
  const s = useContext(SectionContext);
  if (!s) throw new Error("useSection outside of a section");
  return s;
}
