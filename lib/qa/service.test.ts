import { expect, test, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProjectStore, projectStore } from "@/lib/studio/store";
import { composeSeries } from "@/lib/generation/series";
import { fixtureSeries } from "@/lib/generation/fixture";
import { checkGenerated } from "./service";
test("five unavailable browser workers save honest incomplete reports and serialize project writes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "qa-worker-test-"));
  const previous = process.env.QA_PLAYWRIGHT_MODULE;
  try {
    process.env.QA_PLAYWRIGHT_MODULE = "/nonexistent/qa-playwright/index.mjs";
    const store = new ProjectStore(root);
    const demo = JSON.parse(await readFile("projects/demo/content.json", "utf8"));
    let p = await store.create({ ...demo, slug: "worker-test", media: [], refs: [] });
    p = await store.saveGeneration("worker-test", { ...composeSeries(fixtureSeries, "ru", []), model: "controlled-test", elapsedMs: 1, references: 0 }, p.revision, p.planRevision, p.generationRevision);
    vi.spyOn(projectStore, "read").mockImplementation(store.read.bind(store));
    vi.spyOn(projectStore, "version").mockImplementation(store.version.bind(store));
    vi.spyOn(projectStore, "qaDirectory").mockImplementation(store.qaDirectory.bind(store));
    vi.spyOn(projectStore, "saveQa").mockImplementation(store.saveQa.bind(store));
    const checked = await checkGenerated(p);
    expect(checked.concepts).toHaveLength(5);
    for (const concept of checked.concepts) {
      const qa = concept.history?.[0].qa;
      expect(qa?.stale).toBe(false);
      expect(qa?.report.checks.every((check) => check.status === "error")).toBe(true);
      expect(qa?.report.visionModel).toBeNull();
      expect(qa?.report.evidence).toEqual([]);
    }
    await expect(store.approveVersion("worker-test", p.concepts[0].id, "1", p.revision, p.planRevision, p.generationRevision, p.approvalRevision, true)).rejects.toMatchObject({ status: 409 });
  } finally {
    vi.restoreAllMocks();
    if (previous === undefined) delete process.env.QA_PLAYWRIGHT_MODULE; else process.env.QA_PLAYWRIGHT_MODULE = previous;
    await rm(root, { recursive: true, force: true });
  }
});
