import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { expect, test } from "vitest";
import { Content } from "@/lib/schema/content";
import { StudioDesignPreference, StudioTemplate } from "@/lib/schema/studioTemplate";
import { studioTemplateTheme, studioTemplates, studioPalettes, studioCompositionPresets } from "@/registry/studioTemplates";
import { composeStudioTemplate } from "@/lib/generation/studioTemplate";
import { ProjectStore } from "@/lib/studio/store";
import { applyRefinement } from "@/lib/versions/refine";
import { validateTheme } from "@/lib/theme/validate";
import { refinementTool } from "@/lib/ai/refineTheme";
import { generateSeries } from "@/lib/ai/generateSeries";
import { typeSetStackFor, typeSetSupportsLocale, getTypeSet } from "@/registry/typesets";

const selection = { templateId: "editorial", paletteId: "ivory", fontPairId: "editorial", ornamentSetId: "editorial-rules" } as const;
const content = Content.parse({ slug: "studio-recipe-test", locale: "ru", eventType: "wedding", hosts: [{ name: "Малика" }, { name: "Амир" }], date: { start: "", day: "2027-06-12" }, venue: { name: "Сад", address: "Ташкент" }, brief: "Редакционное приглашение на тёплой бумаге.", variantCount: 1, studioDesign: { templateId: "editorial", paletteId: "ivory" } });

test("canonical recipe identity survives server revalidation, storage, reading and version refinement", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-recipe-"));
  try {
    const store = new ProjectStore(root);
    const project = await store.create(content);
    const generated = { ...composeStudioTemplate(selection, [], "Тёплая редакционная композиция.", content, []), model: "controlled-test", elapsedMs: 1, references: 0 };
    const saved = await store.saveGeneration(content.slug, generated, project.revision, project.planRevision, project.generationRevision);
    const theme = saved.concepts[0].theme;
    expect(theme.studioTemplate).toEqual(generated.themes[0].studioTemplate);
    expect(saved.generation?.style.studioTemplate).toEqual(theme.studioTemplate);
    expect(saved.content.studioDesign).toEqual(content.studioDesign);
    expect((await store.version(content.slug, saved.concepts[0].id, "1")).studioTemplate).toEqual(theme.studioTemplate);
    const refined = applyRefinement(theme, { studioTemplate: { paletteId: "rose", fontPairId: "ceremony" } }, saved);
    expect(refined.theme.palette.bg).toBe(studioPalettes.rose.bg);
    expect(refined.theme.layout).toEqual(theme.layout);
    expect(refined.theme.photos).toEqual(theme.photos);
    expect(refined.theme.studioTemplate).toEqual({ ...theme.studioTemplate, paletteId: "rose", fontPairId: "ceremony" });
    const version = await store.saveRefinement({ slug: content.slug, conceptId: saved.concepts[0].id, fromVersion: "1", instruction: "Палитра: пыльная роза.", revision: saved.revision, planRevision: saved.planRevision, generationRevision: saved.generationRevision, source: theme, result: { ...refined, summary: "Согласованная палитра и пара шрифтов.", model: "authored-template-v1", elapsedMs: 0 } });
    expect(version.concepts[0].version).toBe("2");
    expect((await store.version(content.slug, saved.concepts[0].id, "1")).palette.bg).toBe(studioPalettes.ivory.bg);
    expect((await store.version(content.slug, saved.concepts[0].id, "2")).studioTemplate?.paletteId).toBe("rose");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("choosing a template alone creates and stores the authored recipe without an AI brief or provider", async () => {
  const manual = { ...content, brief: "" };
  const result = await generateSeries(manual, [], [], undefined, { curatedTemplates: true });
  expect(result.model).toBe("authored-template-v1");
  expect(result.themes[0].studioTemplate?.id).toBe("editorial");
  expect(manual.brief).toBe("");
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-manual-"));
  try {
    const store = new ProjectStore(root);
    const project = await store.create(manual);
    const saved = await store.saveGeneration(manual.slug, result, project.revision, project.planRevision, project.generationRevision);
    expect(saved.content.brief).toBe("");
    expect(saved.generation?.brief).toContain("Авторский шаблон");
    expect(saved.concepts[0].theme.studioTemplate?.paletteId).toBe("ivory");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Chinese Heritage is a reusable studio recipe with deterministic generation and compatible refinement", async () => {
  const heritageContent = { ...content, brief: "", studioDesign: { templateId: "heritage" as const, paletteId: "cinnabar" as const } };
  const result = await generateSeries(heritageContent, [], [], undefined, { curatedTemplates: true });
  const theme = result.themes[0];
  expect(result.model).toBe("authored-template-v1");
  expect(theme.studioTemplate).toEqual({ id: "heritage", revision: 1, paletteId: "cinnabar", fontPairId: "ceremony", ornamentSetId: "chinese-garden" });
  expect(theme.palette).toMatchObject({ bg: "#F8F4EC", accent: "#991E25" });
  expect(theme.generatedVisual).toBeUndefined();
  const refined = applyRefinement(theme, { studioTemplate: { paletteId: "champagne", fontPairId: "editorial" } }, { content: heritageContent, assetPlan: { assets: [], unifiedTreatment: "none" }, mediaInfo: {} });
  expect(refined.theme.studioTemplate).toMatchObject({ id: "heritage", paletteId: "champagne", fontPairId: "editorial" });
  expect(refined.theme.palette.bg).toBe(studioPalettes.champagne.bg);
  expect(validateTheme(refined.theme, { locale: "ru" }).ok).toBe(true);
});

test("a template cannot be diluted by arbitrary colours, fonts, framing, graphics or template switching", () => {
  const theme = studioTemplateTheme(selection);
  const context = { content, assetPlan: { assets: [], unifiedTreatment: "none" as const }, mediaInfo: {} };
  for (const patch of [{ palette: { bg: "#AABBCC" } }, { typeSet: "modernist" }, { layout: { composition: "arch" } }, { designSpec: { canvas: { noise_opacity: .05 } } }, { motion: { preset: "overture" } }, { studioTemplate: { paletteId: "wine" } }, { studioTemplate: { id: "corporate" } }]) expect(() => applyRefinement(theme, patch, context)).toThrow();
  for (const corrupted of [{ ...theme, palette: { ...theme.palette, bg: "#AABBCC" } }, { ...theme, typeSet: "modernist" }, { ...theme, layout: { ...theme.layout, composition: "arch" } }, { ...theme, studioTemplate: { ...theme.studioTemplate!, ornamentSetId: "deco-lines" } }]) expect(validateTheme(corrupted).ok).toBe(false);
  const still = applyRefinement(theme, { motion: { preset: "still" } }, context);
  expect(validateTheme(still.theme).ok).toBe(true);
});

test("refinement exposes only current-template alternatives and rejects unsupported persisted marker revisions", () => {
  const tool = JSON.stringify(refinementTool(studioTemplateTheme(selection)).input_schema);
  expect(tool).toContain('"paletteId"');
  expect(tool).not.toContain('"designSpec"');
  expect(tool).not.toContain('"background_color"');
  expect(StudioTemplate.safeParse({ ...studioTemplateTheme(selection).studioTemplate, revision: 2 }).success).toBe(false);
  expect(StudioDesignPreference.safeParse({ templateId: "invented", paletteId: "auto" }).success).toBe(false);
  for (const template of studioTemplates) for (const id of template.fontPairIds) {
    const fonts = getTypeSet(id)!;
    expect(typeSetSupportsLocale(fonts, "uz-latn")).toBe(true);
    if (fonts.displayGlyphFallback) expect(typeSetStackFor(fonts, "display")).toContain("Cormorant Garamond");
  }
});


test("parameterized composition survives storage, reload and cross-template palette/font refinement", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-composition-"));
  try {
    const store = new ProjectStore(root);
    const parameterContent = { ...content, studioDesign: { templateId: "editorial" as const, paletteId: "auto" as const } };
    const project = await store.create(parameterContent);
    const composition = { ...structuredClone(studioCompositionPresets.editorial), heroLayout: "framed-arch" as const,
      surfaceStyle: "glassmorphism" as const, spacingScale: "airy-gallery" as const,
      sectionVariants: { countdown: "date-led" as const, program: "cards" as const, venue: "split" as const, gallery: "filmstrip" as const, rsvp: "minimal" as const } };
    const result = { ...composeStudioTemplate({ ...selection, paletteId: "wine", fontPairId: "ceremony", ornamentSetId: "deco-lines", composition }, [], "Камерный вечер при свечах.", parameterContent, []), model: "controlled-test", elapsedMs: 1, references: 0 };
    const saved = await store.saveGeneration(parameterContent.slug, result, project.revision, project.planRevision, project.generationRevision);
    const theme = await store.version(parameterContent.slug, saved.concepts[0].id, "1");
    expect(theme.studioTemplate?.composition).toEqual(composition);
    expect(saved.generation?.style.studioTemplate?.composition).toEqual(composition);
    const refined = applyRefinement(theme, { studioTemplate: { paletteId: "forest", fontPairId: "poetic" } }, saved);
    expect(refined.theme.studioTemplate).toEqual({ ...theme.studioTemplate, paletteId: "forest", fontPairId: "poetic" });
    expect(refined.theme.layout).toEqual(theme.layout);
    expect(refined.theme.photos).toEqual(theme.photos);
    expect(validateTheme(refined.theme, { locale: "ru" }).ok).toBe(true);
    const next = await store.saveRefinement({ slug: parameterContent.slug, conceptId: saved.concepts[0].id, fromVersion: "1", instruction: "Лесная палитра и поэтический шрифт.", revision: saved.revision, planRevision: saved.planRevision, generationRevision: saved.generationRevision, source: theme, result: { ...refined, summary: "Палитра и шрифт обновлены.", model: "controlled-test", elapsedMs: 0 } });
    expect((await store.version(parameterContent.slug, next.concepts[0].id, "2")).studioTemplate?.composition).toEqual(composition);
    expect((await store.version(parameterContent.slug, next.concepts[0].id, "1")).studioTemplate?.paletteId).toBe("wine");
    const tool = JSON.stringify(refinementTool(refined.theme).input_schema);
    expect(tool).toContain('"cobalt"');
    expect(tool).toContain('"modernist"');
    expect(tool).not.toContain('"composition"');
  } finally { await rm(root, { recursive: true, force: true }); }
});
