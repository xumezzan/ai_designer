import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import assets from "../../registry/font-assets.generated.json";
import { typeSets } from "../../registry/typesets";
import { supportsLocale } from "../../registry/fonts";
import { typeSetSupportsLocale, typeSetStackFor } from "../../registry/typesets";
import { displayFontPreloads } from "./resources";

const require = createRequire(import.meta.url);
const fontkitModule = require("next/dist/compiled/@next/font/dist/fontkit");
const fontFromBuffer = fontkitModule.default.default ?? fontkitModule.default;
const load = (path: string) => readFileSync(new URL(`../../public${path}`, import.meta.url));

describe("prepared fonts", () => {
  for (const [id, family] of Object.entries(assets.families)) {
    it(`${id}: assets match recorded hashes and metrics`, () => {
      for (const face of family.faces) {
        const buffer = load(face.path);
        const font = fontFromBuffer(buffer);
        expect(createHash("sha256").update(buffer).digest("hex")).toBe(face.sha256);
        expect(buffer.length).toBe(face.bytes);
        expect(font.ascent).toBe(face.ascent);
        expect(font.descent).toBe(face.descent);
        expect(font.lineGap).toBe(face.lineGap);
        expect(font.unitsPerEm).toBe(face.unitsPerEm);
        // The scaled fallback's line box must match the real face's metrics.
        const adjust = parseFloat(face.metrics.sizeAdjust) / 100;
        expect(parseFloat(face.metrics.ascentOverride) / 100 * adjust).toBeCloseTo(face.ascent / face.unitsPerEm, 5);
        expect(parseFloat(face.metrics.descentOverride) / 100 * adjust).toBeCloseTo(Math.abs(face.descent) / face.unitsPerEm, 5);
      }
    });

    it(`${id}: prepared faces cover Russian and Uzbek text`, () => {
      for (const face of family.faces) {
        const font = fontFromBuffer(load(face.path));
        const sample = face.subset === "cyrillic" ?
          "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя" :
          face.subset === "latin" ? "OilaGdayratToyʼ0123456789" : "ĀāĂăĄąĒēĪīŌōŪū";
        // Some static display fonts have only a partial extended Latin alphabet.
        // They remain useful for Russian/English; locale selection rejects Uzbek
        // unless the complete measured extended set and apostrophes are present.
        if (face.subset === "latin-ext" && !family.latinExt) {
          expect(supportsLocale(id, "uz-latn")).toBe(false);
          expect(font.characterSet.length).toBeGreaterThan(1);
        } else for (const character of sample) expect(font.hasGlyphForCodePoint(character.codePointAt(0)), character).toBe(true);
      }
    });
  }

  for (const set of Object.values(typeSets)) {
    if (!set) continue;
    it(`${set.id}: every level's weight is shipped, caps and figures actually shape`, () => {
      for (const [level, spec] of Object.entries(set.levels)) {
        const role = spec.role ?? (level === "display" || level === "displaySm" ? "display" : "body");
        const family = assets.families[set[role] as keyof typeof assets.families];
        expect(family.faces.some((face) => face.weight === spec.weight)).toBe(true);
        if (spec.features?.includes("smcp")) {
          for (const subset of ["latin", "cyrillic"]) {
            const face = family.faces.find((f) => f.weight === spec.weight && f.subset === subset)!;
            const font = fontFromBuffer(load(face.path));
            const text = subset === "latin" ? "invitation" : "приглашение";
            const ids = (features: string[]) => font.layout(text, features).glyphs.map((glyph: { id: number }) => glyph.id);
            expect(ids(["smcp"])).not.toEqual(ids([]));
          }
        }
        if (spec.features?.includes("onum")) {
          const face = family.faces.find((f) => f.weight === spec.weight && f.subset === "latin")!;
          const font = fontFromBuffer(load(face.path));
          expect(font.layout("0123456789", ["onum"]).glyphs.map((g: { id: number }) => g.id))
            .not.toEqual(font.layout("0123456789", ["lnum"]).glyphs.map((g: { id: number }) => g.id));
        }
      }
    });
    it(`${set.id}: its explicit body stack covers both Uzbek apostrophes`, () => {
      const ids = [set.body, ...(set.bodyGlyphFallback ? [set.bodyGlyphFallback] : [])];
      const faces = ids.flatMap((id) => assets.families[id as keyof typeof assets.families].faces)
        .map((face) => fontFromBuffer(load(face.path)));
      for (const character of "OʻzbekistonGʻayratToʼy") {
        expect(faces.some((font) => font.hasGlyphForCodePoint(character.codePointAt(0))), character).toBe(true);
      }
    });
  }

  it("preloads only the selected display weight and locale subsets", () => {
    expect(displayFontPreloads("ceremony", "en")).toEqual(["/font-assets/cormorant-garamond-latin-300-normal.woff2"]);
    expect(displayFontPreloads("ceremony", "ru")).toHaveLength(2);
    expect(displayFontPreloads("editorial", "uz-latn")).toEqual([
      "/font-assets/cormorant-garamond-latin-600-normal.woff2",
      "/font-assets/cormorant-garamond-latin-ext-600-normal.woff2",
    ]);
  });
  it("does not mistake a CSS range for actual Uzbek glyph coverage", () => {
    expect(supportsLocale("golos-text", "uz-latn")).toBe(false);
    expect(typeSetSupportsLocale(typeSets.editorial!, "uz-latn")).toBe(true);
    const stack = typeSetStackFor(typeSets.editorial!, "body");
    expect(stack.indexOf("Golos Text Fallback")).toBeLessThan(stack.indexOf("Cormorant Garamond"));
    for (const face of assets.families["golos-text"].faces) expect(face.unicodeRange).not.toContain("02BB");
  });
});
