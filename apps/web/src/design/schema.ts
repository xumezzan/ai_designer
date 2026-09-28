/**
 * Invito Design DSL
 * -----------------
 * The single structured representation of an event website.
 * The AI never emits HTML — it emits (or edits) this document,
 * and the renderer turns it into a real, responsive website.
 *
 * Keep in sync with apps/api/app/design/schema.py
 */

export type EventType =
  | "wedding"
  | "birthday"
  | "engagement"
  | "party"
  | "corporate"
  | "baby_shower"
  | "other";

export type SpacingScale = "compact" | "comfortable" | "airy";
export type RadiusScale = "none" | "sm" | "md" | "lg";
export type ShadowLevel = "none" | "soft";
export type DecorationLevel = "none" | "minimal" | "moderate";
export type AnimationLevel = "none" | "subtle" | "moderate";
export type ImageTreatment = "natural" | "film" | "muted" | "mono" | "warm";
export type TypeScale = "compact" | "regular" | "display";
export type HeadingCase = "none" | "uppercase";

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
}

export interface ThemeTypography {
  headingFont: string;
  bodyFont: string;
  scale: TypeScale;
  headingWeight: 300 | 400 | 500 | 600 | 700;
  headingCase: HeadingCase;
  headingTracking: "tight" | "normal" | "wide";
  headingItalic: boolean;
}

export interface Theme {
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: SpacingScale;
  radius: RadiusScale;
  shadows: ShadowLevel;
  decoration: DecorationLevel;
  animation: AnimationLevel;
  imageTreatment: ImageTreatment;
}

export interface Layout {
  maxWidth: 960 | 1080 | 1200 | 1320;
}

export type SectionType =
  | "hero"
  | "story"
  | "event_details"
  | "schedule"
  | "gallery"
  | "countdown"
  | "quote"
  | "map"
  | "dress_code"
  | "speakers"
  | "rsvp"
  | "text"
  | "image"
  | "divider"
  | "contact"
  | "footer";

export type SectionBackground = "default" | "surface" | "accent" | "dark";
export type PaddingY = "sm" | "md" | "lg" | "xl";
export type Alignment = "left" | "center";
export type SizeToken = "sm" | "md" | "lg" | "xl";

export interface SectionStyle {
  background: SectionBackground;
  paddingY: PaddingY;
  align: Alignment;
  headingSize: SizeToken;
  /** Per‑section overrides of theme tokens (rare; used by AI for targeted edits). */
  textColor?: string;
  backgroundColor?: string;
}

export interface ScheduleItem {
  time: string;
  title: string;
  description?: string;
}
export interface Speaker {
  name: string;
  role?: string;
  image?: string;
}
export interface GalleryImage {
  src?: string | null;
  alt?: string;
}
export interface DetailItem {
  label: string;
  value: string;
  note?: string;
}

/** Content props per section type. Kept loose to let the DSL grow. */
export interface SectionProps {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  body?: string;
  date?: string;
  time?: string;
  venue?: string;
  address?: string;
  image?: string;
  imageAlt?: string;
  images?: GalleryImage[];
  items?: ScheduleItem[];
  details?: DetailItem[];
  speakers?: Speaker[];
  quote?: string;
  attribution?: string;
  buttonLabel?: string;
  buttonHref?: string;
  mapQuery?: string;
  targetDate?: string;
  dressCode?: string;
  email?: string;
  phone?: string;
  socials?: { label: string; href: string }[];
  note?: string;
  [key: string]: unknown;
}

export interface Section {
  id: string;
  type: SectionType;
  variant: string;
  visible: boolean;
  props: SectionProps;
  style: SectionStyle;
}

export interface DesignMeta {
  conceptName: string;
  direction: string;
  rationale: string;
  eventType: EventType;
}

export interface DesignDocument {
  version: 1;
  meta: DesignMeta;
  theme: Theme;
  layout: Layout;
  sections: Section[];
}

/* ------------------------------------------------------------------ */
/* Section variants                                                    */
/* ------------------------------------------------------------------ */

export const SECTION_VARIANTS: Record<SectionType, string[]> = {
  hero: ["centered", "split", "fullscreen", "editorial", "minimal", "asymmetric"],
  story: ["split", "centered", "columns"],
  event_details: ["cards", "list", "editorial"],
  schedule: ["timeline", "list"],
  gallery: ["grid", "editorial", "strip"],
  countdown: ["inline", "large"],
  quote: ["centered", "editorial"],
  map: ["embed", "card"],
  dress_code: ["simple", "swatches"],
  speakers: ["grid", "list"],
  rsvp: ["card", "minimal", "split"],
  text: ["prose", "statement"],
  image: ["full", "contained"],
  divider: ["line", "space", "ornament"],
  contact: ["simple"],
  footer: ["simple", "signature"],
};

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Hero",
  story: "Story",
  event_details: "Event details",
  schedule: "Schedule",
  gallery: "Gallery",
  countdown: "Countdown",
  quote: "Quote",
  map: "Map",
  dress_code: "Dress code",
  speakers: "Speakers",
  rsvp: "RSVP",
  text: "Text",
  image: "Image",
  divider: "Divider",
  contact: "Contact",
  footer: "Footer",
};

/* ------------------------------------------------------------------ */
/* Structured edit operations (AI → document)                          */
/* ------------------------------------------------------------------ */

export type EditAction =
  | "update" // set a property on a target
  | "remove" // remove a section or clear an element
  | "add" // add a section
  | "move" // move a section (value = index or "up"/"down")
  | "set_variant"; // change a section's layout variant

export interface EditOperation {
  /**
   * Target path. Examples:
   *  "theme.colors.accent"        → property on the theme
   *  "theme.typography.headingFont"
   *  "layout.maxWidth"
   *  "hero"                       → first section of type hero
   *  "hero.heading"               → prop `heading` of hero section
   *  "hero.style.paddingY"        → style token of hero
   *  "#sec_abc123"                → section by id
   *  "sections"                   → the sections array (for add)
   */
  target: string;
  action: EditAction;
  property?: string;
  value?: unknown;
  /** For `add`: the section payload. Missing fields are filled with defaults. */
  section?: Partial<Omit<Section, "style">> & { type: SectionType; style?: Partial<SectionStyle> };
  /** For `add`: index to insert at; defaults to before footer. */
  index?: number;
}

export interface EditProposal {
  summary: string;
  operations: EditOperation[];
}
