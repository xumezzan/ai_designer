/**
 * Type sets (SPEC §6.1) — hand-tuned typographic pairings. The model selects a
 * set whole; it never sets sizes, tracking or leading. Values follow §6.1:
 * a large display/body gap (≈5×, never an even 1.2 ladder), negative tracking
 * on display, positive on small caps, serif body leading 1.5–1.65, real
 * `smcp`/`onum` features, measure in characters.
 *
 * Refined against the measured M0.5 references in docs/references.md.
 * Font members are registry fonts.ts ids and
 * must have passed `scripts/check-fonts.ts`.
 */
import type { TypeSetId } from "../keys";
import { stackFor, supportsLocale } from "../fonts";

export type TypeSetLevel = "display" | "displaySm" | "lead" | "body" | "small" | "caps";

export interface TypeLevelSpec {
  /** CSS length; fluid from mobile to the desktop reference size. */
  size: string;
  /** letter-spacing in em. */
  tracking: string;
  /** Unitless line-height. */
  leading: number;
  weight: number;
  /** Optional role override; caps use the display serif's real Cyrillic smcp. */
  role?: "display" | "body";
  /** font-feature-settings; small caps here, never text-transform + tracking. */
  features?: string;
}

export interface TypeSet {
  id: TypeSetId;
  name: string;
  description: string;
  /** registry/fonts.ts ids. */
  display: string;
  /** Verified per-glyph fallback for scripts or signs absent from the display face. */
  displayGlyphFallback?: string;
  body: string;
  /** Explicit same-pair fallback for glyphs absent from the body source. */
  bodyGlyphFallback?: string;
  levels: Record<TypeSetLevel, TypeLevelSpec>;
  /** Maximum body measure in characters. */
  measure: number;
}

export function typeSetStackFor(typeSet: TypeSet, role: "display" | "body"): string {
  return stackFor(role === "display" ? typeSet.display : typeSet.body,
    role === "body" ? typeSet.bodyGlyphFallback : typeSet.displayGlyphFallback);
}

export function typeSetSupportsLocale(
  typeSet: TypeSet,
  locale: "ru" | "uz-latn" | "en",
): boolean {
  return (
    (supportsLocale(typeSet.display, locale) ||
      !!(typeSet.displayGlyphFallback && supportsLocale(typeSet.displayGlyphFallback, locale))) &&
    (supportsLocale(typeSet.body, locale) ||
      !!(typeSet.bodyGlyphFallback && supportsLocale(typeSet.bodyGlyphFallback, locale)))
  );
}

export const typeSets: Partial<Record<TypeSetId, TypeSet>> = {
  // Postamt's light serif, with Gatsby's deliberate display/body hierarchy.
  ceremony: {
    id: "ceremony",
    name: "Ceremony",
    description:
      "Light ceremonial serif over a humanist body; measured against Postamt and Gatsby. For formal family events.",
    display: "cormorant-garamond",
    body: "eb-garamond",
    measure: 58,
    levels: {
      display: {
        size: "clamp(3.75rem, 1.5rem + 9vw, 8.75rem)",
        tracking: "-0.03em",
        leading: 1.08,
        weight: 300,
        features: "'liga' 1, 'kern' 1",
      },
      displaySm: {
        size: "clamp(2.125rem, 1.5rem + 2.6vw, 3.25rem)",
        tracking: "-0.02em",
        leading: 1.12,
        weight: 300,
        features: "'liga' 1, 'kern' 1",
      },
      lead: {
        size: "clamp(1.375rem, 1.25rem + 0.6vw, 1.75rem)",
        tracking: "-0.01em",
        leading: 1.4,
        weight: 400,
        features: "'liga' 1, 'kern' 1, 'onum' 1",
      },
      body: {
        size: "1.0625rem",
        tracking: "0",
        leading: 1.6,
        weight: 400,
        features: "'liga' 1, 'kern' 1, 'onum' 1",
      },
      small: {
        size: "0.8125rem",
        tracking: "0.01em",
        leading: 1.5,
        weight: 500,
        features: "'liga' 1, 'kern' 1, 'onum' 1",
      },
      caps: {
        size: "0.875rem",
        role: "display",
        tracking: "0.1em",
        leading: 1.2,
        weight: 300,
        features: "'smcp' 1, 'onum' 1",
      },
    },
  },

  // Magazine voice: strong display serif over a clean grotesque body.
  editorial: {
    id: "editorial",
    name: "Editorial",
    description:
      "Strong serif display over a clean grotesque, following Jafar–Sitora's role contrast. For contemporary celebrations.",
    display: "cormorant-garamond",
    body: "golos-text",
    bodyGlyphFallback: "cormorant-garamond",
    measure: 62,
    levels: {
      display: {
        size: "clamp(3.5rem, 1.35rem + 9.5vw, 9rem)",
        tracking: "-0.035em",
        leading: 1.06,
        weight: 600,
        features: "'liga' 1, 'kern' 1",
      },
      displaySm: {
        size: "clamp(1.875rem, 1.35rem + 2.4vw, 3rem)",
        tracking: "-0.02em",
        leading: 1.1,
        weight: 600,
        features: "'liga' 1, 'kern' 1",
      },
      lead: {
        size: "clamp(1.3125rem, 1.15rem + 0.75vw, 1.6875rem)",
        tracking: "-0.005em",
        leading: 1.38,
        weight: 500,
        features: "'liga' 1, 'kern' 1, 'onum' 1",
      },
      body: {
        size: "1rem",
        tracking: "0",
        leading: 1.55,
        weight: 400,
        features: "'liga' 1, 'kern' 1, 'onum' 1",
      },
      small: {
        size: "0.8125rem",
        tracking: "0.015em",
        leading: 1.45,
        weight: 500,
        features: "'liga' 1, 'kern' 1, 'onum' 1",
      },
      caps: {
        size: "0.8125rem",
        role: "display",
        tracking: "0.12em",
        leading: 1.2,
        weight: 600,
        features: "'smcp' 1, 'onum' 1",
      },
    },
  },
};

export function getTypeSet(id: TypeSetId): TypeSet | undefined {
  return typeSets[id];
}

const base = typeSets.editorial!;
const modernEditorial: TypeSet = {
  ...base,
  id: "modern-editorial",
  name: "Modern Editorial",
  description: "Cormorant Garamond headlines with Inter for prose and details.",
  body: "inter",
  bodyGlyphFallback: undefined,
  measure: 58,
  levels: {
    ...base.levels,
    display: { ...base.levels.display, size: "clamp(3.125rem, 1.5rem + 7.5vw, 6rem)", leading: 1.02 },
    lead: { size: "clamp(1.125rem, 1rem + 0.6vw, 1.375rem)", tracking: "-0.015em", leading: 1.5, weight: 500 },
    body: { size: "1rem", tracking: "0", leading: 1.65, weight: 400 },
    small: { size: "0.8125rem", tracking: "0.01em", leading: 1.5, weight: 500 },
    caps: { size: "0.75rem", role: "body", tracking: "0.14em", leading: 1.45, weight: 600 },
  },
};
typeSets["modern-editorial"] = modernEditorial;

typeSets["botanical-haute"] = {
  ...modernEditorial,
  id: "botanical-haute",
  name: "Botanical Haute",
  description: "Prata with a Cormorant Garamond glyph fallback, and Manrope with Inter for Uzbek modifier letters.",
  display: "prata",
  displayGlyphFallback: "cormorant-garamond",
  body: "manrope",
  bodyGlyphFallback: "inter",
  measure: 56,
  levels: {
    ...modernEditorial.levels,
    display: { size: "clamp(2.75rem, 1.6rem + 6vw, 5.25rem)", tracking: "-0.028em", leading: 1.1, weight: 400 },
    displaySm: { size: "clamp(1.75rem, 1.4rem + 2vw, 2.75rem)", tracking: "-0.018em", leading: 1.18, weight: 400 },
  },
};

typeSets["velvet-noir"] = {
  ...modernEditorial,
  id: "velvet-noir",
  name: "Velvet Noir",
  description: "Bodoni Moda with Cormorant Garamond for Cyrillic and missing Uzbek glyphs, and Montserrat for prose.",
  display: "bodoni-moda",
  displayGlyphFallback: "cormorant-garamond",
  body: "montserrat",
  measure: 55,
  levels: {
    ...modernEditorial.levels,
    display: { size: "clamp(2.875rem, 1.55rem + 7vw, 6rem)", tracking: "-0.025em", leading: 1.06, weight: 600 },
    displaySm: { size: "clamp(1.875rem, 1.35rem + 2.6vw, 3rem)", tracking: "-0.015em", leading: 1.13, weight: 600 },
    caps: { ...modernEditorial.levels.caps, tracking: "0.16em" },
  },
};

// These use different display letterforms.
for (const [id, name, display, weight, size, leading] of [
  ["modernist", "Modernist", "unbounded", 500, "clamp(2.1rem, 5.7vw, 5.5rem)", 1.14],
  ["poetic", "Poetic", "prata", 400, "clamp(2.8rem, 7.5vw, 7rem)", 1.16],
  ["gallery", "Gallery", "tenor-sans", 400, "clamp(2.8rem, 7.2vw, 6.75rem)", 1.12],
  ["handwritten", "Handwritten", "marck-script", 400, "clamp(3.6rem, 8.5vw, 8.5rem)", 1.2],
] as const) {
  typeSets[id] = {
    ...base, id, name, display, bodyGlyphFallback: "cormorant-garamond",
    displayGlyphFallback: id === "poetic" || id === "gallery" ? "cormorant-garamond" : undefined,
    description: `${name}: ${display} with quiet Golos body text; a distinct authored typographic voice.`,
    levels: {
      ...base.levels,
      display: { ...base.levels.display, weight, size, leading, tracking: "-0.025em" },
      displaySm: { ...base.levels.displaySm, weight, size: "clamp(1.75rem, 3.2vw, 2.8rem)", leading: 1.22 },
      // Metadata belongs to the neutral body face, not a simulated serif smcp.
      caps: { ...base.levels.caps, role: "body", weight: 500, features: "'kern' 1" },
    },
  };
}
