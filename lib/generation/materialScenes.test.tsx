import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Content } from "@/lib/schema/content";
import { materialExamples, exampleTheme } from "@/lib/materials/examples";
import { artDirection, composeSeries } from "./series";
import { validateTheme } from "@/lib/theme/validate";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { directAsset, unusedAsset } from "@/lib/assets/crop";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProjectStore } from "@/lib/studio/store";

const content = Content.parse({ slug: "material-test", locale: "ru", eventType: "wedding", hosts: [{ name: "Екатерина-Александра" }, { name: "Константин-Владислав" }], greeting: "Ждём вас на нашем празднике", date: { start: "2027-06-13T18:00:00+05:00" }, venue: { name: "Место встречи", address: "Адрес события" } });
const themes = materialExamples.map((example) => exampleTheme(example.id, content)!);
const series = () => ({ mode: "exploration", style: { ...themes[0], name: themes[0].meta.name, mood: themes[0].meta.mood, rationale: themes[0].meta.rationale, ornament: { pack: themes[0].ornament.pack, density: themes[0].ornament.density, color: themes[0].ornament.color }, meta: undefined, layout: undefined }, variants: themes.map((theme) => ({ direction: artDirection(theme), name: theme.meta.name, rationale: theme.meta.rationale, layout: theme.layout, ornamentPlacement: theme.ornament.placement, photos: [] })) });
function input() { const value = series(); delete value.style.meta; delete value.style.layout; return value; }

test("different materials, finishing and motion survive canonical series revalidation", () => {
  const result = composeSeries(input(), "ru", []);
  expect(result.themes.map((theme) => theme.surface.texture)).toEqual(["raw-silk", "cotton-paper", "smooth"]);
  expect(result.themes.map((theme) => theme.materialSet)).toEqual(["paper", "paper", "glass"]);
  expect(result.themes.map((theme) => theme.motion.ambient)).toEqual(["none", "petals", "dust"]);
  expect(result.themes.map((theme) => artDirection(theme))).toEqual(themes.map(artDirection));
});
test("saving and reopening a series retains each independent material identity", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "material-series-"));
  try {
    const store = new ProjectStore(root);
    const project = await store.create({ ...content, variantCount: 3, brief: "Три разных материальных композиции" });
    const generated = { ...composeSeries(input(), "ru", []), model: "controlled-material-test", elapsedMs: 1, references: 0 };
    const saved = await store.saveGeneration(content.slug, generated, project.revision, project.planRevision, project.generationRevision);
    const reopened = await store.read(content.slug);
    expect(reopened.generation?.mode).toBe("exploration");
    expect(saved.concepts.map((concept) => artDirection(concept.theme))).toEqual(themes.map(artDirection));
    expect(reopened.concepts.map((concept) => artDirection(concept.theme))).toEqual(themes.map(artDirection));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("recoloring the same physical scene cannot pass exploration diversity", () => {
  const value = input();
  value.variants[1] = { ...structuredClone(value.variants[0]), direction: { ...artDirection(themes[0]), palette: themes[1].palette, typeSet: themes[1].typeSet } };
  expect(() => composeSeries(value, "ru", [])).toThrow(/recoloring/);
});
test("native scenes validate their actual layout and keep one live title and event facts", () => {
  for (const theme of themes) {
    expect(validateTheme(theme, { locale: "ru" }).ok).toBe(true);
    expect(validateTheme({ ...theme, layout: { ...theme.layout, preset: "scroll-narrative" } }, { locale: "ru" }).ok).toBe(false);
    const html = renderToStaticMarkup(<ScrollNarrative content={content} theme={theme} initialNow={0} embedded />);
    expect(html.match(/id="hero-title"/g)).toHaveLength(1);
    expect(html).toContain(content.hosts[0].name);
    expect(html).toContain('data-layout="card-stack"');
    expect(html).toContain('dateTime="2027-06-13T18:00:00+05:00"');
  }
});
test("physical photo frames retain the original protected crop and render photos once", () => {
  const photo = directAsset({ ...unusedAsset("protected", { width: 1024, height: 768 }), role: "portrait", placement: { section: "greeting", index: 0 } }, "/test-photo.webp", { width: 1024, height: 768 }, "bw")!;
  const theme = { ...themes[0], photos: [{ id: photo.asset.id, section: "greeting" as const, index: 0, position: "after" as const }] };
  const html = renderToStaticMarkup(<ScrollNarrative content={content} theme={theme} photos={[photo]} initialNow={0} embedded />);
  expect(html.match(/data-photo-id="protected"/g)).toHaveLength(1);
  expect(html).toContain('data-crop="whole"');
  expect(html).toContain('data-treatment="bw"');
  expect(photo.crop.mode).toBe("whole");
  expect(validateTheme({ ...theme, motion: { preset: "drift", ambient: "snow" } }, { locale: "ru" }).ok).toBe(false);
});
