import type { TypeSetId } from "@/registry/keys";
import { displayAdvanceGroups } from "./display-advances";

const advances = Object.fromEntries(Object.entries(displayAdvanceGroups).map(([family, groups]) => [
  family,
  new Map(groups.flatMap(([width, characters]) => Array.from(characters, (character) => [character, width] as const))),
]));
const widthFamilyByTypeSet: Partial<Record<TypeSetId, keyof typeof displayAdvanceGroups>> = {
  modernist: "modernist",
  poetic: "poetic",
  gallery: "gallery",
  "botanical-haute": "poetic",
  "velvet-noir": "bodoni",
};

/** A conservative width for the longest unbreakable token in display-font em.
 * CSS uses the real container width to cap type before an emergency word break.
 * No browser measurement or JavaScript is required to render a complete page.
 * Ordinary spaces and hyphens remain natural break opportunities; typographic
 * nonbreaking spaces stay attached to their following word. */
export function displayTokenMeasure(text: string, typeSet: TypeSetId, uppercase = false): number {
  const family = widthFamilyByTypeSet[typeSet] ?? "serif";
  const glyphs = advances[family];
  const companion = typeSet === "velvet-noir" || typeSet === "botanical-haute" ? advances.serif : undefined;
  const source = (uppercase ? text.toLocaleUpperCase() : text).normalize("NFC");
  const tokens = source.split(/[\t\n\r \-\u2010\u2013\u2014]+/u).filter(Boolean);
  const width = (token: string) => Array.from(token).reduce((sum, character) =>
    sum + (/\p{M}/u.test(character) ? 0 : (glyphs.get(character) ?? companion?.get(character) ?? 1.25)) + (uppercase ? 0.075 : 0), 0);
  // A small allowance covers italic overhang and subpixel rounding. Negative
  // authored tracking only increases the available safety margin.
  return Math.round((Math.max(1, ...tokens.map(width)) + 0.15) * 1000) / 1000;
}
