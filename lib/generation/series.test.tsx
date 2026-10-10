import { expect, test } from "vitest";
import { fixtureSeries } from "./fixture";
import { composeSeries, sharedStyleSignature } from "./series";
import { directAsset, unusedAsset } from "@/lib/assets/crop";
import { availablePhotoLayout, compositionPhotos } from "@/lib/assets/layout";
import { renderToStaticMarkup } from "react-dom/server";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { readFile } from "node:fs/promises";
import { Content } from "@/lib/schema/content";

const info = { width: 1600, height: 1000 };
const photo = directAsset({ ...unusedAsset("photo-a", info), quality: "high", role: "portrait", placement: { section: "greeting", index: 0 } }, "/api/projects/test/media/a.webp", info, "bw")!;
const withPhotos = () => { const series = structuredClone(fixtureSeries); series.variants.forEach((variant, index) => { variant.photos = [{ id: photo.asset.id, section: index % 2 ? "venue" : "greeting", index: 0, position: index % 2 ? "before" : "after" }]; }); return series; };
test("creates five new configurations with one shared style and distinct spatial compositions", () => {
  const result = composeSeries(fixtureSeries, "ru", []);
  expect(result.themes).toHaveLength(5);
  expect(new Set(result.themes.map(sharedStyleSignature)).size).toBe(1);
  expect(new Set(result.themes.map((theme) => theme.layout.composition)).size).toBe(5);
  expect(result.themes.every((theme) => theme.ornament.pack === "art-deco")).toBe(true);
});
test("contrast is repaired once in the common palette rather than diverging between variants", () => {
  const raw = structuredClone(fixtureSeries); raw.style.palette.ink = "#222222";
  const result = composeSeries(raw, "ru", []);
  expect(result.adjustments.length).toBeGreaterThan(0);
  expect(result.style.palette.ink).not.toBe("#222222");
  expect(new Set(result.themes.map(sharedStyleSignature)).size).toBe(1);
});
test("duplicate compositions and omission of enabled photos are rejected", () => {
  const raw = structuredClone(fixtureSeries); raw.variants[1] = structuredClone(raw.variants[0]);
  expect(() => composeSeries(raw, "ru", [])).toThrow("distinct");
  expect(() => composeSeries(fixtureSeries, "ru", [photo])).toThrow("every");
});

test("repeated bases may vary visible generated-art placement, but invisible choices cannot fake diversity", () => {
  const raw = structuredClone(fixtureSeries);
  raw.variants.forEach((variant, index) => { variant.layout.composition = "letter"; variant.layout.visualPlacement = ["band", "side-left", "side-right", "medallion", "inset"][index] as typeof variant.layout.visualPlacement; variant.ornamentPlacement = []; });
  expect(() => composeSeries(raw, "ru", [])).toThrow("distinct");
  expect(composeSeries(raw, "ru", [], true).themes).toHaveLength(5);
});
test("rejects unknown ids, duplicate placements, low quality hero and disabled layout sections", () => {
  const raw = withPhotos(); raw.variants[0].photos[0].id = "reference-id";
  expect(() => composeSeries(raw, "ru", [photo])).toThrow("every");
  const repeated = withPhotos(); repeated.variants[0].photos.push(repeated.variants[0].photos[0]);
  expect(() => composeSeries(repeated, "ru", [photo])).toThrow("every");
  const low = { ...photo, asset: { ...photo.asset, quality: "low" as const } };
  const hero = withPhotos(); hero.variants[0].photos[0].section = "hero";
  expect(() => composeSeries(hero, "ru", [low])).toThrow("high-quality");
  const absent = withPhotos(); absent.variants[0].layout.sectionOrder = ["hero", "footer"];
  expect(() => composeSeries(absent, "ru", [photo])).toThrow("sectionOrder");
});
test("photo variants change sections/positions without changing protected crops, treatment or limits", async () => {
  const result = composeSeries(withPhotos(), "ru", [photo]);
  const first = compositionPhotos([photo], result.themes[0])[0];
  const second = compositionPhotos([photo], result.themes[1])[0];
  expect(first.photo.crop).toEqual(second.photo.crop);
  expect(second.photo.treatment).toBe("bw");
  expect(second.photo.pixelWidth).toBe(photo.pixelWidth);
  expect(first.photo.asset.placement?.section).toBe("greeting");
  expect(second.photo.asset.placement?.section).toBe("venue");
  expect(second.position).toBe("before");
  expect(photo.asset.placement?.section).toBe("greeting");
  const content = Content.parse(JSON.parse(await readFile("projects/demo/content.json", "utf8")));
  const html = renderToStaticMarkup(<ScrollNarrative content={content} theme={result.themes[1]} photos={[photo]} initialNow={0} />);
  expect(html.indexOf('data-photo-section="venue"')).toBeLessThan(html.indexOf('id="venue"'));
  expect(html).toContain('data-arrangement="offset"');
});

test("a generated full-photo preview adapts when its photo disappears without changing its snapshot", () => {
  const series = withPhotos();
  series.variants[0].layout.hero = "full-photo";
  series.variants[0].photos[0].section = "hero";
  const stored = composeSeries(series, "ru", [photo]).themes[0];
  expect(availablePhotoLayout(stored, true)).toBe(stored);
  expect(availablePhotoLayout(stored, false).layout.hero).toBe("typographic");
  expect(stored.layout.hero).toBe("full-photo");
  expect(compositionPhotos([], stored)).toEqual([]);
});
