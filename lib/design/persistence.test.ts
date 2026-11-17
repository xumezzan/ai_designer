import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Content } from "@/lib/schema/content";
import { ProjectStore } from "@/lib/studio/store";
import { composeSpecification } from "@/lib/generation/designSpec";
import { readDirectedPhotos } from "@/lib/assets/read";
import { readGeneratedVisual } from "@/lib/artwork/generated";
import { applyRefinement } from "@/lib/versions/refine";
import { editorialExamples } from "./fixtures";

const demo = Content.parse(JSON.parse(await readFile("projects/demo/content.json", "utf8")));
let root: string;
let store: ProjectStore;
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), "editorial-persistence-")); store = new ProjectStore(root); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const event = () => Content.parse({ ...structuredClone(demo), slug: "editorial-persistence", variantCount: 1, media: [], refs: [], brief: "Редакционное приглашение на хлопковой бумаге.", hosts: [{ name: "Алия" }, { name: "Тимур" }] });

describe("editorial specifications across generation and version persistence", () => {
  it("saves the complete exact spec and the actual pinned photo role without changing event facts", async () => {
    let project = await store.create(event());
    const bytes = await sharp({ create: { width: 900, height: 1400, channels: 3, background: "#A89A7D" } }).png().toBuffer();
    await store.upload(project.content.slug, project.revision, "photo", new File([new Uint8Array(bytes)], "venue.png", { type: "image/png" }));
    project = await store.read(project.content.slug);
    const asset = project.assetPlan.assets[0];
    await store.updatePlan(project.content.slug, { ...project.assetPlan, assets: [{ ...asset, role: "story", subject: "venue", quality: "high", placementPinned: true, placement: { section: "venue", index: 7 } }] }, project.revision, project.planRevision);
    project = await store.read(project.content.slug);
    const photos = await readDirectedPhotos(project.content, project.assetPlan, path.join(root, project.content.slug));
    // Deliberately wrong model role: the owner pin must be the saved/effective role.
    const result = { ...composeSpecification(editorialExamples.botanical, [{ id: asset.id, section: "greeting", index: 0, position: "after" }], project.content, photos), model: "controlled-test", elapsedMs: 1, references: 0 };
    const saved = await store.saveGeneration(project.content.slug, result, project.revision, project.planRevision, project.generationRevision);
    const theme = saved.concepts[0].theme;
    expect(saved.content).toEqual(project.content);
    expect(theme.designSpec).toEqual(result.themes[0].designSpec);
    expect(theme.photos).toEqual([{ id: asset.id, section: "venue", index: 7, position: "after" }]);
    expect(theme.layout.sectionOrder).toContain("venue");
    expect((await store.version(project.content.slug, saved.concepts[0].id, "1")).designSpec).toEqual(theme.designSpec);
    expect((await store.recentDesigns(project.content.slug))[0].spec).toMatchObject({ archetype: "BOTANICAL_PLATE", mask_type: "oval_portrait", paper_tone: "sage" });
  });

  it.each(["accent", "scene"] as const)("keeps original %s image bytes and metadata through placement refinement and restoration", async (kind) => {
    const project = await store.create(event());
    const spec = structuredClone(editorialExamples.arch);
    spec.graphics_generation = { needed: true, prompt: "Original botanical illustration on cotton paper, no lettering.", placement: kind === "scene" ? "hero_background" : "framed_illustration" };
    const composed = composeSpecification(spec, [], project.content, []);
    const data = await sharp({ create: { width: 512, height: 768, channels: 4, background: "#C2B49A" } }).webp().toBuffer();
    const record = { id: randomUUID(), sha256: createHash("sha256").update(data).digest("hex"), width: 512, height: 768, kind,
      isolated: kind === "accent", model: "controlled-fixture", prompt: "Controlled illustration\nDirection: original botanical art", createdAt: new Date().toISOString(), references: 0 };
    const ref = { id: record.id, sha256: record.sha256, width: record.width, height: record.height, isolated: record.isolated, kind };
    const result = { ...composed, themes: composed.themes.map((theme) => ({ ...theme, generatedVisual: ref })), style: { ...composed.style, generatedVisual: ref },
      model: "controlled-test", elapsedMs: 1, references: 0, visual: { data, record } };
    const saved = await store.saveGeneration(project.content.slug, result, project.revision, project.planRevision, project.generationRevision);
    const concept = saved.concepts[0];
    const source = await store.version(saved.content.slug, concept.id, "1");
    const artDirectory = path.join(root, saved.content.slug, "art", record.id);
    const originalMetadata = await readFile(path.join(artDirectory, "meta.json"), "utf8");
    expect((await readGeneratedVisual(saved.content.slug, record.id, ref, root))?.data).toEqual(data);
    const placement = kind === "scene" ? "framed_illustration" : "hero_background";
    const refined = { ...applyRefinement(source, { designSpec: { graphics_generation: { placement } } }, saved), model: "controlled-test", elapsedMs: 1, summary: "Изменено положение существующей иллюстрации." };
    expect(refined.theme.generatedVisual).toEqual(ref);
    const updated = await store.saveRefinement({ slug: saved.content.slug, conceptId: concept.id, fromVersion: "1", instruction: "Перемести иллюстрацию", revision: saved.revision,
      planRevision: saved.planRevision, generationRevision: saved.generationRevision, source, result: refined });
    expect(updated.concepts[0].theme.designSpec!.graphics_generation).toEqual({ ...source.designSpec!.graphics_generation, placement });
    expect(updated.concepts[0].theme.generatedVisual).toEqual(ref);
    expect(await readFile(path.join(artDirectory, "meta.json"), "utf8")).toBe(originalMetadata);
    expect(await readFile(path.join(artDirectory, "image.webp"))).toEqual(data);
    expect((await store.version(saved.content.slug, concept.id, "1")).designSpec).toEqual(source.designSpec);
    const restored = await store.restoreVersion(saved.content.slug, concept.id, "1", updated.revision, updated.planRevision, updated.generationRevision);
    expect(restored.concepts[0].theme.designSpec).toEqual(source.designSpec);
    expect(restored.concepts[0].theme.generatedVisual).toEqual(ref);
  });
});
