import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { QaReport, CHECK_IDS, QA_ENGINE } from "@/lib/schema/qa";
import { projectStore, StudioError, type Project } from "@/lib/studio/store";
import { digest, rendererRevision } from "./fingerprint";
import { inspectVision } from "./vision";

type Request = { slug: string; conceptId: string; version: string; revision: string; planRevision: string; generationRevision: string };
// Shared bounded workers within this server process; the store rechecks revisions under its cross-process lock.
let active = 0;
const waiting: (() => void)[] = [];
const jobs = new Map<string, Promise<Project>>();
const saves = new Map<string, Promise<Project>>();
function save(report: QaReport, generationRevision: string) {
  const previous = saves.get(report.slug);
  const next = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() => projectStore.saveQa(report, generationRevision));
  saves.set(report.slug, next);
  void next.then(() => { if (saves.get(report.slug) === next) saves.delete(report.slug); }, () => { if (saves.get(report.slug) === next) saves.delete(report.slug); });
  return next;
}
async function slot() {
  if (active < 2) { active++; return; }
  if (waiting.length >= 10) throw new StudioError("Проверки заняты. Повторите через минуту.", 429);
  await new Promise<void>((resolve) => waiting.push(resolve));
}
function release() { const next = waiting.shift(); if (next) next(); else active--; }
async function browser(input: { url: string; assets: Project["assetPlan"]["assets"]; output: string }): Promise<{ checks: QaReport["checks"]; evidence: QaReport["evidence"]; measurements: QaReport["measurements"] }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), "qa/run.mjs")], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
    let output = "", settled = false;
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else { try { resolve(JSON.parse(output)); } catch { reject(new Error("Incomplete browser report")); } } };
    const terminate = () => { child.kill("SIGTERM"); const force = setTimeout(() => child.kill("SIGKILL"), 3000); force.unref(); child.once("close", () => clearTimeout(force)); };
    const timer = setTimeout(() => { terminate(); finish(new Error("QA timeout")); }, 110000);
    child.stdout.on("data", (data) => { output += data.toString(); if (output.length > 2000000) { terminate(); finish(new Error("QA report too large")); } });
    child.stderr.on("data", () => {}); // No event data, environment values, or browser output in logs.
    child.on("error", (error) => finish(error));
    child.on("close", (code) => finish(code === 0 ? undefined : new Error("Browser QA unavailable")));
    child.stdin.on("error", () => {}); child.stdin.end(JSON.stringify(input));
  });
}
async function execute(input: Request) {
  await slot();
  let directory = "", committed = false;
  try {
    const project = await projectStore.read(input.slug);
    if (input.slug === "demo") throw new StudioError("Проверьте вариант в своём проекте.", 403);
    if (project.revision !== input.revision || project.planRevision !== input.planRevision || project.generationRevision !== input.generationRevision) throw new StudioError("Проект изменился. Обновите страницу перед проверкой.", 409);
    if (!project.generation?.concepts.some((concept) => concept.id === input.conceptId)) throw new StudioError("Выберите вариант текущей серии.", 404);
    const theme = await projectStore.version(input.slug, input.conceptId, input.version);
    const report = { runId: randomUUID(), slug: input.slug, conceptId: input.conceptId, version: input.version, createdAt: new Date().toISOString(), engine: QA_ENGINE, contentRevision: input.revision, planRevision: input.planRevision, themeRevision: digest(JSON.stringify(theme)), rendererRevision: await rendererRevision(), viewports: [390, 1024, 1440], checks: [] as QaReport["checks"], visionModel: null as string | null, evidence: [] as QaReport["evidence"], measurements: undefined as QaReport["measurements"] };
    directory = projectStore.qaDirectory(input.slug, input.conceptId, input.version, report.runId);
    try {
      // Never derive the origin from Host, JSON, or forwarded headers.
      const base = new URL(process.env.QA_BASE_URL || "http://127.0.0.1:3147");
      if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("Invalid QA origin");
      const measured = await browser({ url: new URL(`/preview/${input.slug}/${input.conceptId}/${input.version}?embed=1`, base).href, assets: project.assetPlan.assets, output: directory });
      const vision = await inspectVision(directory, measured.evidence);
      report.evidence = measured.evidence; report.visionModel = vision.model;
      report.measurements = measured.measurements;
      for (const id of CHECK_IDS) {
        const matches = [...measured.checks, ...vision.checks].filter((check) => check.id === id);
        const status = (["error", "fail", "warning", "pass", "skipped"] as const).find((status) => matches.some((check) => check.status === status)) ?? "error";
        report.checks.push({ id, status, samples: matches.reduce((count, check) => count + check.samples, 0), findings: matches.flatMap((check) => check.findings).slice(0, 200) });
      }
    } catch {
      report.checks = CHECK_IDS.map((id) => ({ id, status: "error", samples: 0, findings: [] }));
    }
    const saved = await save(QaReport.parse(report), input.generationRevision); committed = true; return saved;
  } finally { release(); if (directory && !committed) await rm(directory, { recursive: true, force: true }); }
}
export function checkVersion(input: Request): Promise<Project> {
  const key = JSON.stringify(input);
  const existing = jobs.get(key); if (existing) return existing;
  const job = execute(input); jobs.set(key, job);
  void job.then(() => jobs.delete(key), () => jobs.delete(key));
  return job;
}
export async function checkGenerated(project: Project, conceptIds?: string[]) {
  await Promise.all(project.concepts.filter((concept) => !conceptIds || conceptIds.includes(concept.id)).map((concept) => checkVersion({ slug: project.content.slug, conceptId: concept.id, version: concept.version, revision: project.revision, planRevision: project.planRevision, generationRevision: project.generationRevision })));
  return projectStore.read(project.content.slug);
}
