import { describe, expect, it } from "vitest";
import { STUDIO_TEMPLATE_IDS, STUDIO_PALETTE_IDS, STUDIO_FONT_PAIR_IDS, STUDIO_ORNAMENT_SET_IDS } from "@/lib/schema/studioTemplate";
import { contrastRatio, validateTheme } from "@/lib/theme/validate";
import { studioTemplates, studioPalettes, studioFontPairs, studioOrnamentSets, studioTemplateTheme, studioTemplateCatalog, resolveStudioComposition, studioCompositionCssVars } from "./studioTemplates";

describe("authored studio catalog", () => {
  it("covers every authored family with exactly three compatible palettes", () => {
    expect(studioTemplates.map(({ id }) => id)).toEqual([...STUDIO_TEMPLATE_IDS]);
    expect(Object.keys(studioPalettes)).toEqual([...STUDIO_PALETTE_IDS]);
    expect(Object.keys(studioFontPairs)).toEqual([...STUDIO_FONT_PAIR_IDS]);
    expect(Object.keys(studioOrnamentSets)).toEqual([...STUDIO_ORNAMENT_SET_IDS]);
    for (const template of studioTemplates) {
      expect(new Set(template.paletteIds).size).toBe(3);
      expect(template.paletteIds).toContain(template.defaultPaletteId);
      expect(template.fontPairIds).toContain(template.defaultFontPairId);
      expect(template.eventTypes.length).toBeGreaterThan(0);
    }
  });

  it("keeps both text colours readable on every raised and base surface", () => {
    for (const [id, palette] of Object.entries(studioPalettes)) {
      for (const text of ["ink", "muted"] as const) for (const background of ["bg", "surface"] as const) {
        expect(contrastRatio(palette[text], palette[background]), `${id}: ${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("validates every allowed family/palette/font combination for all three locales", () => {
    for (const template of studioTemplates) for (const paletteId of template.paletteIds) for (const fontPairId of template.fontPairIds) {
      const theme = studioTemplateTheme({ templateId: template.id, paletteId, fontPairId, ornamentSetId: template.ornamentSetId });
      expect(theme.studioTemplate).toEqual({ id: template.id, revision: 1, paletteId, fontPairId, ornamentSetId: template.ornamentSetId });
      expect(theme.designSpec).toBeUndefined();
      expect(theme.generatedVisual).toBeUndefined();
      for (const locale of ["ru", "uz-latn", "en"] as const) expect(validateTheme(theme, { locale }), `${template.id}/${paletteId}/${fontPairId}/${locale}`).toMatchObject({ ok: true });
    }
  });

  it("rejects cross-family tokens instead of silently inventing a new composition", () => {
    const base = { templateId: "editorial", paletteId: "ivory", fontPairId: "editorial", ornamentSetId: "editorial-rules" } as const;
    expect(() => studioTemplateTheme({ ...base, paletteId: "cobalt" })).toThrow(/Palette/);
    expect(() => studioTemplateTheme({ ...base, fontPairId: "modernist" })).toThrow(/Font pair/);
    expect(() => studioTemplateTheme({ ...base, ornamentSetId: "deco-lines" })).toThrow(/ornament set/);
    expect(() => studioTemplateTheme({ ...base, arbitraryCss: "url(https://example.test)" } as typeof base)).toThrow();
  });

  it("combines each skeleton with cross-family styles through asset tags", () => {
    for (const templateId of STUDIO_TEMPLATE_IDS) {
      const composition = resolveStudioComposition("modern");
      const theme = studioTemplateTheme({ templateId, paletteId: "wine", fontPairId: "modernist", ornamentSetId: "deco-lines", composition });
      expect(theme.studioTemplate?.composition).toEqual(composition);
      expect(theme.typeSet).toBe("modernist");
      expect(theme.palette.bg).toBe(studioPalettes.wine.bg);
      expect(validateTheme(theme, { locale: "ru" })).toMatchObject({ ok: true });
    }
  });

  it("enforces real asset and typographic constraints without a family whitelist", () => {
    const base = { templateId: "modern", paletteId: "wine", fontPairId: "ceremony", ornamentSetId: "chinese-garden", composition: resolveStudioComposition("classic") } as const;
    expect(() => studioTemplateTheme(base)).toThrow(/palette tags light/);
    expect(() => studioTemplateTheme({ ...base, paletteId: "sage" })).not.toThrow();
    expect(() => studioTemplateTheme({ ...base, composition: { ...base.composition, decorConfig: { ...base.composition.decorConfig, density: "none" } } })).not.toThrow();
    expect(() => studioTemplateTheme({ ...base, ornamentSetId: "deco-lines", fontPairId: "modernist", composition: resolveStudioComposition("editorial") })).toThrow(/serif/);
  });

  it("changes rhythm with bounded spacing tokens and serializes reusable compatibility tags", () => {
    const compact = studioCompositionCssVars(resolveStudioComposition("modern"));
    const airy = studioCompositionCssVars(resolveStudioComposition("editorial"));
    expect(parseInt(compact["--studio-section-space"])).toBeLessThan(parseInt(airy["--studio-section-space"]));
    const catalog = studioTemplateCatalog();
    expect(catalog.palettes.wine.tags).toContain("dark");
    expect(catalog.fontPairs.modernist.tags).toContain("sans");
    expect(catalog.ornamentSets["deco-lines"].compatibility.paletteTags).toEqual(["light", "dark"]);
  });

  it("serializes the real native library and does not leak mutable recipe state", () => {
    const catalog = studioTemplateCatalog();
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);
    expect(Object.entries(catalog.ornamentSets).every(([id, { source, elements, styleBible }]) => source === (id === "chinese-garden" ? "owner-supplied-artwork" : "authored-native") && elements.length > 0 && styleBible.referenceHandling.length > 0)).toBe(true);
    catalog.templates[0].paletteIds.pop();
    catalog.palettes.ivory.ink = "#000000";
    expect(studioTemplates[0].paletteIds).toHaveLength(3);
    expect(studioPalettes.ivory.ink).toBe("#2B2724");
    const selection = { templateId: "editorial", paletteId: "ivory", fontPairId: "editorial", ornamentSetId: "editorial-rules" } as const;
    const first = studioTemplateTheme(selection);
    first.layout.sectionOrder.pop();
    first.palette.ink = "#000000";
    const second = studioTemplateTheme(selection);
    expect(second.layout.sectionOrder.at(-1)).toBe("footer");
    expect(second.palette.ink).toBe("#2B2724");
  });
});
