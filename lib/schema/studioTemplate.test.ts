import { describe, expect, it } from "vitest";
import { StudioComposition, StudioSelection, StudioTemplate, STUDIO_COMPOSITION_JSON_SCHEMA, STUDIO_SECTION_VARIANTS } from "./studioTemplate";
import { resolveStudioComposition } from "@/registry/studioTemplates";

describe("bounded studio composition", () => {
  const selection = { templateId: "editorial", paletteId: "ivory", fontPairId: "editorial", ornamentSetId: "editorial-rules" } as const;

  it("does not migrate old recipes or inject a new composition into saved cards", () => {
    expect(StudioSelection.parse(selection)).toEqual(selection);
    const { templateId, ...tokens } = selection;
    const marker = { id: templateId, revision: 1, ...tokens };
    expect(StudioTemplate.parse(marker)).toEqual(marker);
    const preset = resolveStudioComposition(templateId);
    preset.decorConfig.opacity = 0;
    expect(resolveStudioComposition(templateId).decorConfig.opacity).toBeGreaterThan(0);
  });

  it("keeps provider JSON enums and runtime validation in sync", () => {
    const properties = STUDIO_COMPOSITION_JSON_SCHEMA.properties;
    expect(STUDIO_COMPOSITION_JSON_SCHEMA.required).toEqual(["heroLayout", "photoShape", "surfaceStyle", "spacingScale", "typographyAccent", "decorConfig", "sectionVariants"]);
    expect(properties.sectionVariants.required).toEqual(["countdown", "program", "venue", "gallery", "rsvp"]);
    for (const key of ["heroLayout", "photoShape", "surfaceStyle", "spacingScale", "typographyAccent"] as const) {
      expect(properties[key].enum).toEqual([...StudioComposition.shape[key].options]);
    }
    for (const [key, values] of Object.entries(STUDIO_SECTION_VARIANTS)) {
      expect(properties.sectionVariants.properties[key].enum).toEqual([...values]);
    }
  });

  it("preserves the original composition when optional section and motion choices are absent", () => {
    const legacy = resolveStudioComposition("editorial");
    expect(StudioComposition.parse(legacy)).toEqual(legacy);
    expect(legacy).not.toHaveProperty("motionPreset");
    expect(legacy).not.toHaveProperty("sectionOrder");
    expect(legacy.sectionVariants).not.toHaveProperty("wishes");
    expect(StudioComposition.parse({
      ...legacy,
      motionPreset: "unfold",
      sectionOrder: "event-first",
      sectionVariants: { ...legacy.sectionVariants, story: "letter", dressCode: "swatch-led", wishes: "dedication" },
    })).toMatchObject({ motionPreset: "unfold", sectionOrder: "event-first", sectionVariants: { story: "letter", dressCode: "swatch-led", wishes: "dedication" } });
  });

  it("rejects partial, unbounded and arbitrary CSS configs instead of silently changing them", () => {
    const composition = resolveStudioComposition("editorial");
    for (const invalid of [
      { ...composition, heroLayout: "custom" },
      { ...composition, fontSize: "100px" },
      { ...composition, decorConfig: { ...composition.decorConfig, opacity: -1 } },
      { ...composition, decorConfig: { ...composition.decorConfig, opacity: 1.01 } },
      { ...composition, decorConfig: { ...composition.decorConfig, url: "https://example.test" } },
      { ...composition, sectionVariants: { ...composition.sectionVariants, program: "custom" } },
      { ...composition, motionPreset: "arbitrary" },
      { ...composition, sectionOrder: ["rsvp", "hero"] },
      { ...composition, sectionVariants: { ...composition.sectionVariants, wishes: "arbitrary" } },
      { ...composition, sectionVariants: {} },
    ]) expect(StudioSelection.safeParse({ ...selection, composition: invalid }).success).toBe(false);
  });
});
