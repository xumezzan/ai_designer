import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Content } from "@/lib/schema/content";
import { ProjectStore, type Project } from "@/lib/studio/store";
import { fixtureSeries } from "@/lib/generation/fixture";
import { composeSeries } from "@/lib/generation/series";
import { applyRefinement } from "./refine";

const content = Content.parse(JSON.parse(await readFile("projects/demo/content.json", "utf8")));
let root: string, store: ProjectStore, project: Project;
const generated = { ...composeSeries(fixtureSeries, "ru", []), model: "controlled-test", elapsedMs: 1, references: 0 };
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "studio-version-test-")); store = new ProjectStore(root);
  project = await store.create({ ...content, slug: "version-test", media: [], refs: [], brief: "Ар-деко" });
  project = await store.saveGeneration(project.content.slug, generated, project.revision, project.planRevision, project.generationRevision);
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const approve = (p: Project, version: string) => store.approveVersion(p.content.slug, p.concepts[0].id, version, p.revision, p.planRevision, p.generationRevision, p.approvalRevision);
const restore = (p: Project, version: string) => store.restoreVersion(p.content.slug, p.concepts[0].id, version, p.revision, p.planRevision, p.generationRevision);
async function edit(p: Project, fromVersion: string, patch: unknown = { foil: { enabled: false } }) {
  const source = await store.version(p.content.slug, p.concepts[0].id, fromVersion);
  const result = { ...applyRefinement(source, patch, p), summary: "Убрана фольга", model: "controlled-test", elapsedMs: 1 };
  return store.saveRefinement({ slug: p.content.slug, conceptId: p.concepts[0].id, fromVersion, instruction: "Убери фольгу", revision: p.revision, planRevision: p.planRevision, generationRevision: p.generationRevision, source, result });
}
test("approval stays on v1 after refinement; history restores by pointer and branches get new monotonically increasing versions", async () => {
  const approved = await approve(project, "1");
  const directory = path.join(root, project.content.slug, "concepts", project.concepts[0].id);
  const v1 = await readFile(path.join(directory, "v1.json"), "utf8");
  const approval = await readFile(path.join(root, project.content.slug, "approved.json"), "utf8");
  const refined = await edit(approved, "1");
  expect(refined.concepts[0].version).toBe("2");
  expect(refined.approval?.version).toBe("1");
  expect(refined.concepts[0].history?.map((entry) => entry.version)).toEqual(["2", "1"]);
  expect(refined.concepts[0].history?.[0].record?.changes.map((change) => change.path)).toEqual(["foil.enabled"]);
  expect(await readFile(path.join(directory, "v1.json"), "utf8")).toBe(v1);
  expect(await readFile(path.join(root, project.content.slug, "approved.json"), "utf8")).toBe(approval);
  const v2 = await readFile(path.join(directory, "v2.json"), "utf8");
  const restored = await restore(refined, "1");
  expect(restored.concepts[0].version).toBe("1");
  expect(restored.approval).toEqual(approved.approval);
  const branch = await edit(restored, "1", { palette: { bg: "#101318" } });
  expect(branch.concepts[0].version).toBe("3");
  expect(branch.concepts[0].history?.[0].record?.fromVersion).toBe("1");
  expect(await readFile(path.join(directory, "v2.json"), "utf8")).toBe(v2);
  const selected = await approve(branch, "3");
  expect(selected.approval?.version).toBe("3");
  const newBatch = await store.saveGeneration(selected.content.slug, generated, selected.revision, selected.planRevision, selected.generationRevision);
  expect(newBatch.approval).toEqual(selected.approval);
  expect(newBatch.concepts.some((concept) => concept.id === selected.approval?.conceptId)).toBe(false);
});
test("stale and simultaneous refinements cannot fork silently or overwrite version files", async () => {
  const results = await Promise.allSettled([edit(project, "1"), edit(project, "1")]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const failure = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  expect(failure.reason.status).toBe(409);
  await expect(edit(project, "1")).rejects.toMatchObject({ status: 409 });
  const current = await store.read(project.content.slug);
  expect(current.concepts[0].history).toHaveLength(2);
  expect((await readdir(path.join(root, project.content.slug, "concepts", project.concepts[0].id))).some((name) => name.startsWith(".refine"))).toBe(false);
});
test("stale approval pointers, plan revisions, unknown versions and foreign concepts fail without changing selection", async () => {
  const selected = await approve(project, "1");
  await expect(approve(project, "1")).rejects.toMatchObject({ status: 409 });
  await expect(restore({ ...selected, planRevision: "stale" }, "1")).rejects.toMatchObject({ status: 409 });
  await expect(restore(selected, "99")).rejects.toMatchObject({ status: 404 });
  await expect(store.version(selected.content.slug, "../escape", "1")).rejects.toMatchObject({ status: 400 });
  await expect(store.restoreVersion(selected.content.slug, "foreign", "1", selected.revision, selected.planRevision, selected.generationRevision)).rejects.toMatchObject({ status: 404 });
  expect((await store.read(project.content.slug)).approval).toEqual(selected.approval);
});
