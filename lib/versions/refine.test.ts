import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { Content } from "@/lib/schema/content";
import { ThemePatch } from "@/lib/schema/versions";
import { fixtureSeries } from "@/lib/generation/fixture";
import { composeSeries } from "@/lib/generation/series";
import { applyRefinement, mergePatch, themeChanges } from "./refine";

const content = Content.parse(JSON.parse(await readFile("projects/demo/content.json", "utf8")));
export const context = { content, assetPlan: { assets: [], unifiedTreatment: "none" as const }, mediaInfo: {} };
export const source = composeSeries(fixtureSeries, "ru", []).themes[0];
test("darker/remove ornaments changes exactly the requested fields and preserves the original", () => {
  const original = structuredClone(source);
  const result = applyRefinement(source, { palette: { bg: "#101318", surface: "#191D24" }, ornament: { pack: "none", placement: [] } }, context);
  expect(result.changes.map((change) => change.path)).toEqual(["palette.bg", "palette.surface", "ornament.pack", "ornament.placement"]);
  expect(source).toEqual(original);
  expect(result.theme.typeSet).toBe(source.typeSet);
  expect(result.theme.layout).toEqual(source.layout);
  expect(result.theme.foil).toEqual(source.foil);
  expect(result.theme.meta).toEqual(source.meta);
  expect(result.adjustments).toEqual([]);
});
test("a patch never inserts schema defaults; arrays replace rather than merge by index", () => {
  expect(ThemePatch.parse({ layout: { hero: "typographic" } })).toEqual({ layout: { hero: "typographic" } });
  expect(mergePatch({ ornament: { placement: ["corners", "divider"], pack: "art-deco" } }, { ornament: { placement: [] } })).toEqual({ ornament: { placement: [], pack: "art-deco" } });
  expect(themeChanges(source, source)).toEqual([]);
});

test("art placement can be refined while the original server-issued image identity stays immutable", () => {
  const ref = { id: "72b0b3f7-f7ec-430d-a8bf-d84c43c67b88", sha256: "a".repeat(64), width: 1536, height: 1024 };
  const original = { ...source, generatedVisual: ref };
  const result = applyRefinement(original, { layout: { visualPlacement: "side-right" } }, context);
  expect(result.theme.generatedVisual).toEqual(ref);
  expect(result.changes.map((change) => change.path)).toEqual(["layout.visualPlacement"]);
  expect(() => applyRefinement(original, { generatedVisual: { ...ref, id: "invented" } }, context)).toThrow();
});
test("metadata, arbitrary CSS, prototype keys, wholesale regeneration and unbuilt presets are rejected", () => {
  for (const patch of [{ meta: { name: "replacement" } }, { layout: { padding: 20 } }, JSON.parse('{"palette":{"__proto__":{"polluted":true}}}')]) expect(() => applyRefinement(source, patch, context)).toThrow();
  expect(() => applyRefinement(source, { palette: source.palette, typeSet: source.typeSet, materialSet: source.materialSet, artwork: source.artwork, foil: source.foil }, context)).toThrow("partial");
  expect(() => applyRefinement(source, { materialSet: "glass" }, context)).toThrow("registered preset");
});
test("no-op edits, omitted event sections and invented/reference photo ids are rejected", () => {
  expect(() => applyRefinement(source, { foil: { enabled: source.foil.enabled } }, context)).toThrow("does not change");
  expect(() => applyRefinement(source, { layout: { sectionOrder: ["hero", "footer"] } }, context)).toThrow("populated");
  expect(() => applyRefinement(source, { photos: [{ id: "reference", section: "hero", index: 0, position: "after" }] }, context)).toThrow("enabled project");
  expect(() => applyRefinement(source, { photos: [{ id: "photo", section: "greeting", index: 0, position: "after", safeArea: { x: 0, y: 0, w: 1, h: 1 } }] }, context)).toThrow();
});
test("necessary contrast repairs are included in both the adjustment log and actual changes", () => {
  const result = applyRefinement(source, { palette: { ink: source.palette.bg } }, context);
  expect(result.adjustments.length).toBeGreaterThan(0);
  expect(result.theme.palette.ink).not.toBe(source.palette.bg);
  expect(result.changes.some((change) => change.path === "palette.ink")).toBe(true);
  expect(result.theme.layout).toEqual(source.layout);
});
