import { beforeEach, afterEach, expect, test } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProjectStore, type Project } from "@/lib/studio/store";
import { fixtureSeries } from "@/lib/generation/fixture";
import { composeSeries } from "@/lib/generation/series";
import { controlledReport } from "./fixture";
import { QaReport } from "@/lib/schema/qa";
let root: string, store: ProjectStore, p: Project;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "studio-qa-test-")); store = new ProjectStore(root);
  const demo = JSON.parse(await readFile("projects/demo/content.json", "utf8"));
  p = await store.create({ ...demo, slug: "qa-test", media: [], refs: [] });
  p = await store.saveGeneration("qa-test", { ...composeSeries(fixtureSeries, "ru", []), model: "controlled-test", elapsedMs: 1, references: 0 }, p.revision, p.planRevision, p.generationRevision);
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const approve = (project = p, override = false) => store.approveVersion("qa-test", p.concepts[0].id, "1", project.revision, project.planRevision, project.generationRevision, project.approvalRevision, override);
test("server refuses unverified, skipped and incomplete reports, even with override", async () => {
  await expect(approve(p, true)).rejects.toMatchObject({ status: 409 });
  for (const status of ["error", "skipped"] as const) {
    const report = await controlledReport(store, p); report.checks[0].status = status;
    p = await store.saveQa(report, p.generationRevision);
    await expect(approve(p, true)).rejects.toMatchObject({ status: 409 });
    expect(p.approval).toBeNull();
  }
});
test("hard findings need explicit override and provenance is kept with the approval", async () => {
  const report = await controlledReport(store, p);
  report.checks[0] = { id: "overflow", status: "fail", samples: 1, findings: [{ severity: "error", selector: "#hero-title", viewport: 390, message: "Controlled overflow" }] };
  p = await store.saveQa(report, p.generationRevision);
  await expect(approve()).rejects.toMatchObject({ status: 409 });
  p = await approve(p, true);
  expect(p.approval?.qa).toEqual({ runId: report.runId, override: true });
});
test("changing saved content invalidates QA without changing the selected version", async () => {
  p = await store.saveQa(await controlledReport(store, p), p.generationRevision); p = await approve();
  const approval = p.approval;
  await store.update("qa-test", { ...p.content, greeting: "Изменённый текст" }, p.revision);
  p = await store.read("qa-test");
  expect(p.concepts[0].history?.[0].qa?.stale).toBe(true);
  expect(p.approval).toEqual(approval);
  await expect(approve(p, true)).rejects.toMatchObject({ status: 409 });
});
test("a stale renderer or theme cannot publish a QA report; reports are identity-bound", async () => {
  const report = await controlledReport(store, p);
  await expect(store.saveQa({ ...report, rendererRevision: "a".repeat(64) }, p.generationRevision)).rejects.toMatchObject({ status: 409 });
  const file = path.join(root, "qa-test/concepts", p.concepts[0].id, "v1.json");
  const theme = JSON.parse(await readFile(file, "utf8")); theme.meta.name = "Changed in controlled tamper test";
  await writeFile(file, JSON.stringify(theme));
  await expect(store.saveQa(report, p.generationRevision)).rejects.toMatchObject({ status: 409 });
  const duplicate = { ...report, checks: report.checks.map(() => report.checks[0]) };
  expect(QaReport.safeParse(duplicate).success).toBe(false);
  await expect(store.qaEvidence("qa-test", p.concepts[0].id, "1", "../../content.json")).rejects.toMatchObject({ status: 404 });
});
test("old QA engine reports remain readable and stale instead of breaking a project", async () => {
  const report = await controlledReport(store, p);
  await store.saveQa(report, p.generationRevision);
  const file = path.join(root, "qa-test/concepts", p.concepts[0].id, "qa/v1.json");
  await writeFile(file, JSON.stringify({ ...report, engine: "m6-0" }));
  p = await store.read("qa-test");
  expect(p.concepts[0].history?.[0].qa?.stale).toBe(true);
  await expect(approve(p, true)).rejects.toMatchObject({ status: 409 });
});
test("photo-plan revisions invalidate an existing QA report", async () => {
  p = await store.saveQa(await controlledReport(store, p), p.generationRevision);
  await store.updatePlan("qa-test", { assets: [], unifiedTreatment: "bw" }, p.revision, p.planRevision);
  p = await store.read("qa-test");
  expect(p.concepts[0].history?.[0].qa?.stale).toBe(true);
  await expect(approve(p, true)).rejects.toMatchObject({ status: 409 });
});
