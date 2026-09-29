/**
 * Type sets (SPEC §6.1) — hand-tuned typographic pairings. The model selects a
 * set whole; it never sets sizes, tracking or leading. Values follow §6.1:
 * a large display/body gap (≈5×, never an even 1.2 ladder), negative tracking
 * on display, positive on small caps, serif body leading 1.5–1.65, real
 * `smcp`/`onum` features, measure in characters.
 *
 * First pass inside the spec's craft ranges; refined against the M0.5
 * teardowns (docs/references.md). Font members are registry fonts.ts ids and
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
  /** font-feature-settings; small caps here, never text-transform + tracking. */
  features?: string;
}

export interface TypeSet {
  id: TypeSetId;
  name: string;
  description: string;
  /** registry/fonts.ts ids. */
  display: string;
  body: string;
  levels: Record<TypeSetLevel, TypeLevelSpec>;
  /** Maximum body measure in characters. */
  measure: number;
}

export function typeSetStackFor(typeSet: TypeSet, role: "display" | "body"): string {
  return stackFor(role === "display" ? typeSet.display : typeSet.body);
}

export function typeSetSupportsLocale(
  typeSet: TypeSet,
  locale: "ru" | "uz-latn" | "en",
): boolean {
  return (
    supportsLocale(typeSet.display, locale) && supportsLocale(typeSet.body, locale)
  );
}

export const typeSets: Partial<Record<TypeSetId, TypeSet>> = {
  // Classic occasion: high-contrast display serif over a humanist serif body.
  // The display/body gap is deliberate: 88px against 17px.
  ceremony: {
    id: "ceremony",
    name: "Ceremony",
    description:
      "High-contrast display serif over humanist serif body. For weddings, anniversaries, formal family events.",
    display: "prata",
    body: "eb-garamond",
    measure: 62,
    levels: {
      display: {
        size: "clamp(3.25rem, 1.5rem + 7vw, 5.5rem)",
        tracking: "-0.03em",
        leading: 1.08,
        weight: 400,
        features: "'liga' 1, 'kern' 1",
      },
      displaySm: {
        size: "clamp(2.125rem, 1.5rem + 2.6vw, 3.25rem)",
        tracking: "-0.02em",
        leading: 1.12,
        weight: 400,
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
        tracking: "0.1em",
        leading: 1.2,
        weight: 500,
        features: "'smcp' 1, 'onum' 1",
      },
    },
  },

  // Magazine voice: strong display serif over a clean grotesque body.
  editorial: {
    id: "editorial",
    name: "Editorial",
    description:
      "Strong display serif over clean grotesque body. For corporate evenings, birthdays, contemporary celebrations.",
    display: "noto-serif-display",
    body: "golos-text",
    measure: 66,
    levels: {
      display: {
        size: "clamp(3rem, 1.35rem + 7.2vw, 5.25rem)",
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
