import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AssetPlan } from "@/lib/schema/assetPlan";
import { cropForRatio, directAsset, preservesSafeArea, selectCrop, unusedAsset } from "./crop";
import { DirectedImage } from "@/components/primitives/DirectedImage";

const info = { width: 1600, height: 1000 };
const base = { ...unusedAsset("a", info), role: "portrait" as const, placement: { section: "greeting" as const, index: 0 } };
test("crop math matches CSS object-position semantics at both edges and centre", () => {
  expect(cropForRatio(info, "1:1", [0, .5])).toMatchObject({ x: 0, w: .625, h: 1 });
  expect(cropForRatio(info, "1:1", [1, .5])).toMatchObject({ x: .375, w: .625 });
  expect(cropForRatio(info, "1:1", [.5, .5]).x).toBe(.1875);
});
test("rejects a crop cutting the group and tries the next allowed ratio", () => {
  const asset = { ...base, focal: [0, .5] as [number, number], allowedRatios: ["3:4", "3:2"] as typeof base.allowedRatios, safeArea: { x: .05, y: .2, w: .8, h: .5 } };
  expect(selectCrop(info, asset).label).toBe("3:2");
  expect(preservesSafeArea(selectCrop(info, asset), asset.safeArea)).toBe(true);
});
test("uses the whole photograph when every proposed crop clips protected details", () => {
  expect(selectCrop(info, { ...base, allowedRatios: ["1:1"] })).toMatchObject({ mode: "whole", x: 0, y: 0, w: 1, h: 1, ratio: 1.6 });
});
test("every returned crop contains its safe area across focal/box/ratio combinations", () => {
  for (let index = 0; index < 200; index++) {
    const x = (index % 8) / 10, y = (index % 6) / 10;
    const asset = { ...base, focal: [(index % 11) / 10, (index % 9) / 8] as [number, number], safeArea: { x, y, w: .2, h: .3 } };
    expect(preservesSafeArea(selectCrop({ width: 300 + index * 13, height: 200 + index * 7 }, asset), asset.safeArea)).toBe(true);
  }
});
test("low-quality photos cannot be hero and source resolution independently constrains hero", () => {
  expect(directAsset({ ...base, quality: "low", placement: { section: "hero", index: 0 } }, "/a", info, "none")).toBeNull();
  expect(directAsset({ ...base, quality: "high", placement: { section: "hero", index: 0 } }, "/a", { width: 320, height: 240 }, "none")).toBeNull();
  const low = directAsset({ ...base, quality: "low", maxViewportShare: 1 }, "/a", { width: 320, height: 240 }, "bw")!;
  expect(low.viewportShare).toBe(.35);
  expect(low.pixelWidth).toBe(320);
  expect(low.treatment).toBe("bw");
  const html = renderToStaticMarkup(<DirectedImage photo={low} locale="ru" />);
  expect(html).toContain("35vw"); expect(html).toContain("320px"); expect(html).toContain('data-treatment="bw"');
  expect(html).not.toContain("/_next/image");
});
test("unified treatment overrides per-photo treatment and none keeps the individual choice", () => {
  expect(directAsset({ ...base, treatment: "duotone" }, "/a", info, "warm-film")?.treatment).toBe("warm-film");
  expect(directAsset({ ...base, treatment: "duotone" }, "/a", info, "none")?.treatment).toBe("duotone");
});
test("schema rejects out-of-bounds/empty safe areas, repeated ids and low-quality hero", () => {
  for (const bad of [{ ...base, focal: [-.1, .5] }, { ...base, safeArea: { x: .5, y: .2, w: .8, h: .5 } }, { ...base, safeArea: { x: 0, y: 0, w: 0, h: 1 } }, { ...base, quality: "low", role: "hero" }]) {
    expect(AssetPlan.safeParse({ assets: [bad], unifiedTreatment: "none" }).success).toBe(false);
  }
  expect(AssetPlan.safeParse({ assets: [base, base], unifiedTreatment: "none" }).success).toBe(false);
});
