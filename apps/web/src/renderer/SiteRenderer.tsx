"use client";
import React, { useMemo } from "react";
import type { DesignDocument, Section } from "@/design/schema";
import {
  BODY_SIZE,
  HEADING_SIZE,
  IMAGE_FILTER,
  RADIUS,
  SPACING,
  TRACKING,
  googleFontsHref,
  isDark,
  mix,
} from "@/design/tokens";
import { RendererContext, SectionContext, type RendererContextValue } from "./context";
import { Hero } from "./sections/Hero";
import {
  Contact,
  Countdown,
  Divider,
  DressCode,
  EventDetails,
  Footer,
  Gallery,
  ImageBlock,
  MapSection,
  Quote,
  Schedule,
  Speakers,
  Story,
  TextBlock,
} from "./sections/Content";
import { Rsvp } from "./sections/Rsvp";
import "./site.css";

const REGISTRY: Record<Section["type"], React.ComponentType> = {
  hero: Hero,
  story: Story,
  event_details: EventDetails,
  schedule: Schedule,
  gallery: Gallery,
  countdown: Countdown,
  quote: Quote,
  map: MapSection,
  dress_code: DressCode,
  speakers: Speakers,
  rsvp: Rsvp,
  text: TextBlock,
  image: ImageBlock,
  divider: Divider,
  contact: Contact,
  footer: Footer,
};

export function themeToCssVars(doc: DesignDocument): React.CSSProperties {
  const { theme, layout } = doc;
  const c = theme.colors;
  const sp = SPACING[theme.spacing];
  const hs = HEADING_SIZE[theme.typography.scale];
  const vars: Record<string, string> = {
    "--c-bg": c.background,
    "--c-surface": c.surface,
    "--c-text": c.text,
    "--c-muted": c.muted,
    "--c-accent": c.accent,
    "--c-accent-text": c.accentText,
    "--c-line": mix(c.text, c.background, 0.85),
    "--c-dark": isDark(c.text) ? c.text : mix(c.text, "#000000", 0.2),
    "--c-dark-text": c.background,
    "--f-heading": `"${theme.typography.headingFont}", Georgia, serif`,
    "--f-body": `"${theme.typography.bodyFont}", system-ui, sans-serif`,
    "--fw-heading": String(theme.typography.headingWeight),
    "--tt-heading": theme.typography.headingCase,
    "--ls-heading": TRACKING[theme.typography.headingTracking],
    "--fs-heading": theme.typography.headingItalic ? "italic" : "normal",
    "--h-sm": hs.sm,
    "--h-md": hs.md,
    "--h-lg": hs.lg,
    "--h-xl": hs.xl,
    "--fs-body": BODY_SIZE[theme.typography.scale],
    "--py-sm": `${sp.sm}rem`,
    "--py-md": `${sp.md}rem`,
    "--py-lg": `${sp.lg}rem`,
    "--py-xl": `${sp.xl}rem`,
    "--gap": theme.spacing === "compact" ? "1.25rem" : theme.spacing === "airy" ? "2.5rem" : "1.75rem",
    "--radius": RADIUS[theme.radius],
    "--shadow": theme.shadows === "soft" ? "0 20px 60px -30px rgba(0,0,0,.25)" : "none",
    "--img-filter": IMAGE_FILTER[theme.imageTreatment],
    "--max-w": `${layout.maxWidth}px`,
    "--decor": theme.decoration === "none" ? "0" : "1",
  };
  return vars as React.CSSProperties;
}

export function SiteRenderer({
  doc,
  editable = false,
  viewport = "desktop",
  selectedSectionId,
  selectedElement,
  onSelect,
  onTextChange,
  projectId,
  publicSlug,
  renderSectionFrame,
}: Omit<Partial<RendererContextValue>, "doc"> & {
  doc: DesignDocument;
  renderSectionFrame?: (section: Section, node: React.ReactNode, index: number) => React.ReactNode;
}) {
  const vars = useMemo(() => themeToCssVars(doc), [doc]);
  const fontsHref = googleFontsHref([doc.theme.typography.headingFont, doc.theme.typography.bodyFont]);

  const ctx: RendererContextValue = {
    doc,
    editable,
    viewport,
    selectedSectionId,
    selectedElement,
    onSelect,
    onTextChange,
    projectId,
    publicSlug,
  };

  return (
    <RendererContext.Provider value={ctx}>
      <link rel="stylesheet" href={fontsHref} />
      <div
        className={`inv-site inv-vp-${viewport} ${editable ? "inv-editing" : ""}`}
        style={vars}
        data-decoration={doc.theme.decoration}
      >
        {doc.sections
          .filter((s) => s.visible || editable)
          .map((section, index) => {
            const Comp = REGISTRY[section.type];
            if (!Comp) return null;
            const isSelected = editable && selectedSectionId === section.id;
            const node = (
              <SectionContext.Provider value={section} key={section.id}>
                <section
                  id={section.type === "rsvp" ? undefined : section.id}
                  data-section-id={section.id}
                  data-type={section.type}
                  className={`inv-section inv-s-${section.type} inv-bg-${section.style.background} inv-py-${section.style.paddingY} inv-align-${section.style.align} ${isSelected ? "inv-section-selected" : ""} ${!section.visible ? "inv-hidden-section" : ""}`}
                  style={{
                    ...(section.style.backgroundColor ? { background: section.style.backgroundColor } : {}),
                    ...(section.style.textColor ? { color: section.style.textColor } : {}),
                  }}
                  onClick={editable ? () => onSelect?.(section.id) : undefined}
                >
                  <Comp />
                </section>
              </SectionContext.Provider>
            );
            return renderSectionFrame ? (
              <React.Fragment key={section.id}>{renderSectionFrame(section, node, index)}</React.Fragment>
            ) : (
              node
            );
          })}
      </div>
    </RendererContext.Provider>
  );
}
