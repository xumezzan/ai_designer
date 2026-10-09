import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { perform } from "../qa/run.mjs";
assert(process.env.STUDIO_QA_LIVE === "1", "This acceptance makes a real screenshot vision request. Set STUDIO_QA_LIVE=1.");
const { chromium } = await import(pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME_EXECUTABLE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const slug = `qa-quality-${randomUUID().slice(0, 8)}`, base = process.env.STUDIO_QA_URL || "http://127.0.0.1:3147";
const dir = path.join(process.cwd(), "projects", slug), out = process.env.STUDIO_QA_OUTPUT || path.join(process.cwd(), "docs/m6");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const result = { mode: "Production browser and real Anthropic screenshot vision; controlled fictional theme baseline", fixture: "Fictional event and existing NASA Apollo 11 group photo; no private event data", unverifiedBlocked: false, visionLive: false, badges: false, explicitApproval: false, staleBlocked: false, evidence: false, defects: [], widths: [], errors: [] };
page.on("pageerror", (error) => result.errors.push(error.message));
await mkdir(out, { recursive: true });
try {
  const demo = JSON.parse(await readFile("projects/demo/content.json", "utf8"));
  const created = await page.request.post(`${base}/api/projects`, { data: { ...demo, slug, hosts: [{ name: "Демо" }, { name: "Проверка" }], headline: "Демо · Проверка", media: [], refs: [], brief: "Проверка страницы" } });
  assert.equal(created.status(), 201);
  let project = await created.json();
  const upload = await page.request.post(`${base}/api/projects/${slug}/media`, { multipart: { revision: project.revision, kind: "photo", file: { name: "nasa-group.jpg", mimeType: "image/jpeg", buffer: await readFile("docs/m3/fixtures/group-source.jpg") } } });
  assert.equal(upload.status(), 200); project = await upload.json();
  project = await (await page.request.get(`${base}/api/projects/${slug}`)).json();
  const asset = { ...project.assetPlan.assets[0], subject: "group", quality: "high", role: "portrait", safeArea: { x: 0, y: 0, w: 1, h: 1 }, allowedRatios: ["3:2"], placement: { section: "greeting", index: 0 } };
  const planned = await page.request.put(`${base}/api/projects/${slug}/asset-plan`, { data: { revision: project.revision, planRevision: project.planRevision, assetPlan: { assets: [asset], unifiedTreatment: "none" } } });
  assert.equal(planned.status(), 200);
  // Explicit test setup, never a production AI fallback.
  const theme = JSON.parse(await readFile("projects/demo/concepts/letter/v1.json", "utf8"));
  theme.artwork = "none"; theme.foil.enabled = true; theme.motion = { preset: "still", ambient: "none" }; theme.photos = [{ id: asset.id, section: "greeting", index: 0, position: "after" }];
  theme.meta = { name: "Демо · Контроль качества", mood: ["проверка"], rationale: "Контролируемый макет для проверки детектора." };
  const batchId = randomUUID(), concepts = [];
  for (const [index, composition] of ["letter", "poster", "folio", "arch", "botanical"].entries()) {
    const id = `variant-${batchId.slice(0, 8)}-${index + 1}`;
    const copy = structuredClone(theme); copy.layout.composition = composition;
    await mkdir(path.join(dir, "concepts", id));
    await writeFile(path.join(dir, "concepts", id, "v1.json"), JSON.stringify(copy, null, 2) + "\n", { flag: "wx" });
    concepts.push({ id, version: "1" });
  }
  const style = { name: "Тест качества", mood: ["проверка"], rationale: "Контролируемый макет", palette: theme.palette, typeSet: theme.typeSet, materialSet: theme.materialSet, artwork: theme.artwork, foil: theme.foil, motion: theme.motion, ornament: { pack: theme.ornament.pack, density: theme.ornament.density, color: theme.ornament.color } };
  await writeFile(path.join(dir, "generation.json"), JSON.stringify({ batchId, createdAt: new Date().toISOString(), brief: "Проверка страницы", model: "controlled acceptance baseline", elapsedMs: 0, style, adjustments: [], references: 0, concepts }, null, 2) + "\n");
  project = await (await page.request.get(`${base}/api/projects/${slug}`)).json();
  const id = concepts[0].id;
  const payload = (p) => ({ slug, conceptId: id, version: "1", revision: p.revision, planRevision: p.planRevision, generationRevision: p.generationRevision, approvalRevision: p.approvalRevision });
  assert.equal((await page.request.post(`${base}/api/approve`, { data: { ...payload(project), qaOverride: true } })).status(), 409); result.unverifiedBlocked = true;
  await page.goto(`${base}/studio/${slug}`); await page.getByRole("button", { name: "04 Пять дизайнов", exact: true }).click();
  const card = page.locator(".studio-preview-card").first();
  assert(await card.getByRole("button", { name: "Выбрать v1", exact: true }).isDisabled());
  const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/qa"), { timeout: 180000 });
  await card.getByRole("button", { name: "Проверить дизайн", exact: true }).click();
  const response = await responsePromise; project = await response.json(); assert.equal(response.status(), 200, JSON.stringify(project));
  const qa = project.concepts[0].history[0].qa; assert(qa && !qa.stale);
  assert(qa.report.visionModel); assert(qa.report.checks.every((check) => check.status !== "error")); result.visionLive = true;
  await writeFile(path.join(out, "report.json"), JSON.stringify(qa.report, null, 2) + "\n");
  await card.locator(".studio-qa details summary").click();
  await page.screenshot({ path: path.join(out, "studio-desktop.png"), fullPage: true });
  assert(["passed", "warning", "failed"].includes(await card.locator(".studio-qa").getAttribute("data-qa-status"))); result.badges = true;
  for (const entry of qa.report.evidence.filter((entry) => entry.file.startsWith("viewport-"))) {
    const image = await page.request.get(`${base}/api/projects/${slug}/qa/${id}/1/${entry.file}`); assert.equal(image.status(), 200);
    await writeFile(path.join(out, entry.file), await image.body());
  }
  assert.equal((await page.request.get(`${base}/api/projects/${slug}/qa/${id}/1/not-allowed.png`)).status(), 404); result.evidence = true;
  const failed = qa.report.checks.some((check) => check.status === "fail");
  if (failed) assert(await card.getByRole("button", { name: "Выбрать v1", exact: true }).isDisabled());
  await card.getByRole("button", { name: failed ? "Выбрать v1 с замечаниями" : "Выбрать v1", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Выбрана версия v1" }).waitFor(); result.explicitApproval = true;
  const approvedBefore = await readFile(path.join(dir, "approved.json"), "utf8");
  project = await (await page.request.get(`${base}/api/projects/${slug}`)).json();
  const refinement = await page.request.post(`${base}/api/refine`, { data: { ...payload(project), fromVersion: "1", instruction: "Отключи фольгу. Остальное сохрани без изменений." }, timeout: 300000 });
  const refined = await refinement.json(); assert.equal(refinement.status(), 200, JSON.stringify(refined));
  assert.equal(refined.concepts[0].version, "2");
  const refinedQa = refined.concepts[0].history.find((entry) => entry.version === "2").qa;
  assert(refinedQa?.report.visionModel && !refinedQa.stale && refinedQa.report.checks.every((check) => check.status !== "error"));
  assert.equal(await readFile(path.join(dir, "approved.json"), "utf8"), approvedBefore);
  result.automaticRefinementQa = true;
  await writeFile(path.join(out, "refined-report.json"), JSON.stringify(refinedQa.report, null, 2) + "\n");
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert(dimensions.scrollWidth <= width, JSON.stringify(dimensions)); result.widths.push(dimensions);
  }
  await page.setViewportSize({ width: 390, height: 900 }); await card.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, "studio-mobile.png") });
  const before = await readFile(path.join(dir, "approved.json"), "utf8");
  project = await (await page.request.get(`${base}/api/projects/${slug}`)).json();
  assert.equal((await page.request.put(`${base}/api/projects/${slug}`, { data: { revision: project.revision, content: { ...project.content, greeting: "Новый текст делает прежнюю проверку устаревшей." } } })).status(), 200);
  await page.reload(); await page.getByRole("button", { name: "04 Пять дизайнов", exact: true }).click();
  assert.equal(await card.locator(".studio-qa").getAttribute("data-qa-status"), "stale");
  project = await (await page.request.get(`${base}/api/projects/${slug}`)).json();
  assert.equal((await page.request.post(`${base}/api/approve`, { data: { ...payload(project), qaOverride: true } })).status(), 409);
  assert.equal(await readFile(path.join(dir, "approved.json"), "utf8"), before); result.staleBlocked = true;
  const broken = await perform({ url: `${base}/preview/${slug}/${id}/1?embed=1`, assets: [asset], output: path.join(out, "broken"), testStyles: `#hero-title { min-width: 800px !important; width: 800px !important; max-width: none !important; transform: translateX(-200px) !important; } .foil-text { color: #cccccc !important; background-image: none !important; } .directed-photo { width:260px !important; height:120px !important; aspect-ratio:auto !important; } .directed-photo img { object-fit:cover !important; object-position:100% 50% !important; }` });
  for (const id of ["overflow", "contrast", "face-crop"]) { assert.equal(broken.checks.find((check) => check.id === id)?.status, "fail", id); result.defects.push(id); }
  await writeFile(path.join(out, "broken/report.json"), JSON.stringify(broken, null, 2) + "\n");
  assert.deepEqual(result.errors, []);
  result.immutableTheme = hash(await readFile(path.join(dir, "concepts", id, "v1.json"), "utf8")) === hash(JSON.stringify(theme, null, 2) + "\n");
  assert(result.immutableTheme);
  await writeFile(path.join(out, "qa.json"), JSON.stringify(result, null, 2) + "\n"); console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); await rm(dir, { recursive: true, force: true }); }
