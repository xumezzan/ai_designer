/**
 * Font registry (SPEC §16).
 *
 * Measured facts (weights, subset support) come only from
 * `registry/fonts.generated.json`, the output of `scripts/check-fonts.ts` —
 * never from memory. A face that fails the Cyrillic check does not enter the
 * registry. Judgment fields (roles, classification, fallbacks) are assigned by
 * hand on top of the measurements.
 *
 * Local licensed faces are registered in LOCAL_FONTS and loaded with
 * `@font-face` from `public/fonts/` (gitignored — see public/fonts/README.md).
 */
import generated from "./fonts.generated.json";

export type FontRole = "display" | "body" | "script";
export type FontClass = "serif" | "sans" | "script";

export interface FontSupport {
  cyrillic: boolean;
  latinExt: boolean;
  uzbekApostrophe: boolean;
}

export interface FontEntry {
  /** Stable id used by type sets (kebab-case of the family name). */
  id: string;
  family: string;
  source: "google" | "local";
  weights: number[];
  /** Present when the family ships a variable weight axis. */
  weightRange: [number, number] | null;
  roles: FontRole[];
  classification: FontClass;
  support: FontSupport;
  licensed: boolean;
  licenseNote: string;
  /** Provenance of the measured data (script output). */
  measuredFrom: string;
  /** Local woff2 paths under /fonts for `source: "local"` entries. */
  files?: Record<string, string>;
}

export function fontId(family: string): string {
  return family.toLowerCase().replace(/\s+/g, "-");
}

/** Hand-assigned roles; the script measures support, it cannot judge use. */
const ROLES: Record<string, FontRole[]> = {
  "cormorant-garamond": ["display"],
  "cormorant-infant": ["display"],
  "playfair-display": ["display"],
  prata: ["display"],
  forum: ["display"],
  "tenor-sans": ["display"],
  "old-standard-tt": ["display", "body"],
  alice: ["body"],
  philosopher: ["body"],
  "eb-garamond": ["body"],
  literata: ["body"],
  "pt-serif": ["body"],
  "noto-serif-display": ["display"],
  "golos-text": ["body"],
  onest: ["body"],
  manrope: ["body"],
  jost: ["body"],
  unbounded: ["display"],
  montserrat: ["body"],
  "marck-script": ["script"],
  caveat: ["script"],
  "bad-script": ["script"],
  comfortaa: ["display"],
};

const CLASSIFICATION: Record<string, FontClass> = {
  "cormorant-garamond": "serif",
  "cormorant-infant": "serif",
  "playfair-display": "serif",
  prata: "serif",
  forum: "serif",
  "tenor-sans": "sans",
  "old-standard-tt": "serif",
  alice: "serif",
  philosopher: "serif",
  "eb-garamond": "serif",
  literata: "serif",
  "pt-serif": "serif",
  "noto-serif-display": "serif",
  "golos-text": "sans",
  onest: "sans",
  manrope: "sans",
  jost: "sans",
  unbounded: "sans",
  montserrat: "sans",
  "marck-script": "script",
  caveat: "script",
  "bad-script": "script",
  comfortaa: "sans",
};

const FALLBACKS: Record<FontClass, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, "Segoe UI", Arial, sans-serif',
  script: '"Segoe Script", "Bradley Hand", cursive',
};

/**
 * Licensed faces purchased for studio work. Entries are added by hand; the
 * files themselves are never committed. `family` must match the name used in
 * the local `@font-face` declarations.
 */
export const LOCAL_FONTS: FontEntry[] = [
  // {
  //   id: "acme-display",
  //   family: "Acme Display",
  //   source: "local",
  //   weights: [400],
  //   weightRange: null,
  //   roles: ["display"],
  //   classification: "serif",
  //   support: { cyrillic: true, latinExt: true, uzbekApostrophe: true },
  //   licensed: true,
  //   licenseNote: "Purchased web licence — see public/fonts/README.md",
  //   measuredFrom: "local declaration",
  //   files: { "400": "/fonts/acme-display-400.woff2" },
  // },
];

function fromGenerated(): FontEntry[] {
  const entries: FontEntry[] = [];
  for (const f of generated.families) {
    // A face that fails the check does not enter the registry.
    if (f.source === "unmeasured" || !f.support.cyrillic) continue;
    const id = fontId(f.name);
    entries.push({
      id,
      family: f.name,
      source: "google",
      weights: f.weights,
      weightRange: f.weightRange as [number, number] | null,
      roles: ROLES[id] ?? ["body"],
      classification: CLASSIFICATION[id] ?? "serif",
      support: {
        cyrillic: f.support.cyrillic,
        latinExt: f.support.latinExt,
        uzbekApostrophe: f.support.uzbekApostrophe,
      },
      licensed: true,
      licenseNote: "SIL Open Font License via Google Fonts",
      measuredFrom: f.source,
    });
  }
  return entries;
}

export const fonts: Record<string, FontEntry> = Object.fromEntries(
  [...fromGenerated(), ...LOCAL_FONTS].map((entry) => [entry.id, entry]),
);

export function getFont(id: string): FontEntry | undefined {
  return fonts[id];
}

/** CSS font stack for a registered face, including the class fallback. */
export function stackFor(id: string): string {
  const entry = fonts[id];
  if (!entry) {
    throw new Error(`Unknown font id "${id}" — run npm run check-fonts and register it first`);
  }
  return `"${entry.family}", ${FALLBACKS[entry.classification]}`;
}

export function supportsLocale(id: string, locale: "ru" | "uz-latn" | "en"): boolean {
  const entry = fonts[id];
  if (!entry) return false;
  switch (locale) {
    case "ru":
      return entry.support.cyrillic;
    case "uz-latn":
      return entry.support.latinExt && entry.support.uzbekApostrophe;
    case "en":
      return true;
  }
}
