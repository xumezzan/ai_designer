import { expect, test } from "vitest";
import { studioCompositionPresets, studioTemplateTheme } from "@/registry/studioTemplates";
import { designIdentity, differingDesignAxes, assertDistinctDesigns } from "./diversity";

const selection = { templateId: "editorial", paletteId: "wine", fontPairId: "ceremony", ornamentSetId: "deco-lines", composition: studioCompositionPresets.editorial } as const;

test("curated identity uses rendered composition tokens and ignores copy, palette and hidden variants", () => {
  const theme = studioTemplateTheme(selection);
  theme.layout.sectionOrder = ["hero", "footer"];
  theme.studioTemplate!.composition!.decorConfig.density = "none";
  const changed = structuredClone(theme);
  changed.meta.name = "Another event";
  changed.palette = { ...theme.palette, bg: "#123456" };
  changed.studioTemplate!.composition!.photoShape = "circle";
  changed.studioTemplate!.composition!.sectionVariants.program = "cards";
  changed.studioTemplate!.composition!.sectionVariants.gallery = "filmstrip";
  changed.studioTemplate!.composition!.decorConfig.placement = "background-pattern";
  changed.studioTemplate!.composition!.decorConfig.opacity = .9;
  expect(differingDesignAxes(designIdentity(theme), designIdentity(changed))).toEqual([]);
});

test("hero, visible sections, surfaces and typography contribute real curated diversity", () => {
  const first = studioTemplateTheme(selection);
  const second = structuredClone(first);
  second.studioTemplate!.composition!.heroLayout = "typographic-poster";
  second.studioTemplate!.composition!.surfaceStyle = "glassmorphism";
  second.studioTemplate!.composition!.typographyAccent = "oversized-display";
  expect(differingDesignAxes(designIdentity(first), designIdentity(second))).toEqual(["composition", "typography", "material"]);
  expect(() => assertDistinctDesigns([designIdentity(second)], [designIdentity(first)])).not.toThrow();
  const third = structuredClone(first);
  third.studioTemplate!.composition!.sectionVariants.program = "cards";
  expect(differingDesignAxes(designIdentity(first), designIdentity(third))).toEqual(["composition"]);
});

test("changing a preset label alone cannot make the same parameterized blocks unique", () => {
  const first = studioTemplateTheme(selection);
  const second = structuredClone(first);
  second.studioTemplate!.id = "classic";
  expect(designIdentity(second)).toEqual(designIdentity(first));
});
