// Explicitly controlled fixture for store/policy regression tests; never used by production QA.
import { randomUUID } from "node:crypto";
import { CHECK_IDS, QA_ENGINE, type QaReport } from "@/lib/schema/qa";
import type { Project, ProjectStore } from "@/lib/studio/store";
import { digest, rendererRevision } from "./fingerprint";
export async function controlledReport(store: ProjectStore, project: Project, version = "1", conceptId = project.concepts[0].id): Promise<QaReport> {
  const theme = await store.version(project.content.slug, conceptId, version);
  return { runId: randomUUID(), slug: project.content.slug, conceptId, version, createdAt: new Date().toISOString(), engine: QA_ENGINE, contentRevision: project.revision, planRevision: project.planRevision, themeRevision: digest(JSON.stringify(theme)), rendererRevision: await rendererRevision(), viewports: [390, 1024, 1440], checks: CHECK_IDS.map((id) => ({ id, status: "pass", samples: 1, findings: [] })), visionModel: "controlled-test", evidence: [] };
}
