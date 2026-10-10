import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const recorded = process.env.STUDIO_QA_RECORDED === "1";
assert(recorded || process.env.STUDIO_QA_LIVE === "1", "Set STUDIO_QA_LIVE=1 for a real request, or STUDIO_QA_RECORDED=1 for recorded UI fixtures.");
const { chromium } = process.env.STUDIO_PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.STUDIO_PLAYWRIGHT_MODULE).href) : await import("playwright");
const base = process.env.STUDIO_QA_URL ?? "http://127.0.0.1:3147";
const slug = `qa-refinement-${randomUUID().slice(0, 8)}`;
const directory = path.join(process.cwd(), "projects", slug);
const out = process.env.STUDIO_QA_OUTPUT ?? path.join(process.cwd(), "docs/m5");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROME ? { executablePath: process.env.STUDIO_CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const report = { mode: recorded ? "production UI replay of recorded real-provider changes; no live call" : "production, real Anthropic refinement over an explicitly controlled baseline", fixture: "Fictional event, five manually prepared shared-style configs, no personal photos", approval: false, refined: false, originalImmutable: false, selectedImmutable: false, restore: false, explicitReselection: false, reload: false, failedEditPreserved: false, provider: null, viewports: [], errors: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
const hash = (text) => createHash("sha256").update(text).digest("hex");
async function chooseChecked(card, version) {
  const choose = card.getByRole("button", { name: `Выбрать v${version}`, exact: true });
  if (await choose.isDisabled()) {
    const response = page.waitForResponse((r) => r.url().endsWith("/api/qa"), { timeout: 180000 });
    await card.getByRole("button", { name: /Проверить (дизайн|снова)/ }).click();
    assert.equal((await response).status(), 200);
  }
  if (await choose.isDisabled()) await card.getByRole("button", { name: `Выбрать v${version} с замечаниями`, exact: true }).click();
  else await choose.click();
}
const snapshot = async () => ({ slug, revision: hash(await readFile(path.join(directory, "content.json"), "utf8")), planRevision: hash(await readFile(path.join(directory, "asset-plan.json"), "utf8")), generationRevision: hash(await readFile(path.join(directory, "generation.json"), "utf8")), approvalRevision: hash(await readFile(path.join(directory, "approved.json"), "utf8")) });
try {
  const demo = JSON.parse(await readFile(path.join(process.cwd(), "projects/demo/content.json"), "utf8"));
  const created = await page.request.post(`${base}/api/projects`, { data: { ...demo, slug, hosts: [{ name: "Демо" }, { name: "Версии" }], headline: "Демо · Версии", media: [], refs: [], brief: "Тёмный фон, золотые акценты и цветочный орнамент; тест версий." } });
  assert.equal(created.status(), 201);
  // Explicit test setup only. No production API ever supplies this baseline as AI output.
  const original = JSON.parse(await readFile(path.join(process.cwd(), "projects/demo/concepts/letter/v1.json"), "utf8"));
  original.palette = { bg: "#161B20", surface: "#20262C", ink: "#F4E8CF", muted: "#A7A99D", accent: "#D9B967", accentAlt: "#7CAAA8" };
  original.typeSet = "editorial"; original.materialSet = "paper"; original.artwork = "none";
  original.foil = { enabled: true, color: "#D9B967" };
  original.ornament = { pack: "uzbek-suzani", placement: ["corners", "divider"], density: "light", color: "accent" };
  original.motion = { preset: "still", ambient: "none" }; original.photos = [];
  original.layout.hero = "typographic"; original.layout.photoArrangement = "row";
  const batchId = randomUUID();
  const concepts = [];
  for (const [index, composition] of ["letter", "poster", "folio", "arch", "botanical"].entries()) {
    const id = `variant-${batchId.slice(0, 8)}-${index + 1}`;
    const theme = structuredClone(original); theme.layout.composition = composition;
    theme.meta = { name: `Тестовая композиция ${index + 1}`, mood: ["вечер"], rationale: "Контролируемая исходная версия для проверки доработки." };
    await mkdir(path.join(directory, "concepts", id));
    await writeFile(path.join(directory, "concepts", id, "v1.json"), JSON.stringify(theme, null, 2) + "\n", { flag: "wx" });
    concepts.push({ id, version: "1" });
  }
  const style = { name: "Контролируемая тёмная серия", mood: ["вечер"], rationale: "Исходные данные теста, не результат AI-генерации.", palette: original.palette, typeSet: original.typeSet, materialSet: original.materialSet, artwork: original.artwork, foil: original.foil, motion: original.motion, ornament: { pack: original.ornament.pack, density: original.ornament.density, color: original.ornament.color } };
  await writeFile(path.join(directory, "generation.json"), JSON.stringify({ batchId, createdAt: new Date().toISOString(), brief: demo.brief || "Тест версий", model: "controlled QA baseline", elapsedMs: 0, style, adjustments: [], references: 0, concepts }, null, 2) + "\n", { flag: "wx" });
  const id = concepts[0].id;
  const sourceFile = path.join(directory, "concepts", id, "v1.json");
  const sourceText = await readFile(sourceFile, "utf8");
  await page.goto(`${base}/studio/${slug}`);
  await page.locator(".studio-results").waitFor();
  const card = page.locator(".studio-preview-card").first();
  await chooseChecked(card, "1");
  await page.getByRole("status").filter({ hasText: "Выбрана версия v1" }).waitFor();
  const approvedText = await readFile(path.join(directory, "approved.json"), "utf8");
  report.approval = true;
  await card.locator(".studio-refine-disclosure").evaluate((element) => { element.open = true; });
  await card.locator("textarea").fill("Сделай фон и поверхность немного темнее. Убери цветочный орнамент полностью. Шрифты, золото, композицию, фотографии и остальную палитру оставь без изменений.");
  let updated;
  if (recorded) {
    // Seed only this test project from previously verified changes. No production
    // endpoint returns a pretend AI response; this run checks the rendered UI.
    const saved = JSON.parse(await readFile(path.join(process.cwd(), "docs/m5/qa.json"), "utf8"));
    const theme = JSON.parse(sourceText);
    for (const change of saved.provider.changes) {
      const keys = change.path.split(".");
      let target = theme;
      for (const key of keys.slice(0, -1)) target = target[key];
      target[keys.at(-1)] = JSON.parse(change.after);
    }
    const record = { version: "2", fromVersion: "1", createdAt: new Date().toISOString(), instruction: await card.locator("textarea").inputValue(), summary: "Повтор записанной правки: фоны темнее, цветочный орнамент отключён.", model: saved.provider.model, elapsedMs: saved.provider.elapsedMs, changes: saved.provider.changes, adjustments: saved.provider.adjustments };
    await writeFile(path.join(directory, "concepts", id, "v2.json"), JSON.stringify(theme, null, 2) + "\n", { flag: "wx" });
    await writeFile(path.join(directory, "concepts", id, "v2.meta.json"), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
    const generation = JSON.parse(await readFile(path.join(directory, "generation.json"), "utf8"));
    generation.concepts[0].version = "2";
    await writeFile(path.join(directory, "generation.json"), JSON.stringify(generation, null, 2) + "\n");
    updated = { concepts: [{ id, version: "2", theme, history: [{ version: "2", record }] }], approval: JSON.parse(approvedText) };
    await page.reload();
    await page.locator(".studio-results").waitFor();
  } else {
    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/refine"), { timeout: 300000 });
    await card.getByRole("button", { name: "Создать версию из v1", exact: true }).click();
    const response = await responsePromise;
    updated = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(updated));
    await page.getByRole("status").filter({ hasText: "Создана новая версия" }).waitFor();
  }
  const current = updated.concepts.find((concept) => concept.id === id);
  assert.equal(current.version, "2");
  assert.equal(updated.approval.version, "1");
  const versionRecord = current.history.find((entry) => entry.version === "2").record;
  report.provider = { model: versionRecord.model, elapsedMs: versionRecord.elapsedMs, changes: versionRecord.changes, adjustments: versionRecord.adjustments };
  console.log(JSON.stringify({ [recorded ? "recordedRefinement" : "liveRefinement"]: report.provider }));
  const requested = ["palette.bg", "palette.surface", "ornament.pack", "ornament.placement"];
  assert(versionRecord.changes.every((change) => requested.includes(change.path)), JSON.stringify(versionRecord.changes));
  assert.equal(current.theme.ornament.pack, "none");
  assert.notEqual(current.theme.palette.bg, original.palette.bg);
  assert.notEqual(current.theme.palette.surface, original.palette.surface);
  report.refined = true;
  assert.equal(await readFile(sourceFile, "utf8"), sourceText); report.originalImmutable = true;
  assert.equal(await readFile(path.join(directory, "approved.json"), "utf8"), approvedText); report.selectedImmutable = true;
  const v2File = path.join(directory, "concepts", id, "v2.json");
  const v2Text = await readFile(v2File, "utf8");
  await card.locator("select").selectOption("1");
  const frame = await (await card.locator("iframe").elementHandle()).contentFrame();
  await frame.locator("#hero-title").waitFor();
  assert.equal(await frame.locator("main").evaluate((main) => main.style.getPropertyValue("--bg")), original.palette.bg);
  await card.getByRole("button", { name: "Сделать v1 текущей", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Предыдущая версия снова текущая" }).waitFor();
  report.restore = true;
  assert.equal(await readFile(v2File, "utf8"), v2Text);
  await card.locator("select").selectOption("2");
  await chooseChecked(card, "2");
  await page.getByRole("status").filter({ hasText: "Выбрана версия v2" }).waitFor();
  assert.equal(JSON.parse(await readFile(path.join(directory, "approved.json"), "utf8")).version, "2");
  report.explicitReselection = true;
  await card.locator(".studio-version-details summary").click();
  await card.locator(".studio-concept-controls").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, "versions-desktop.jpg"), type: "jpeg", quality: 85 });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await card.locator("textarea").scrollIntoViewIfNeeded();
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (dimensions.scrollWidth > dimensions.viewport) console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".studio-approved *, .studio-concept-controls *")].map((element) => ({ className: element.className, text: element.textContent.slice(0, 80), right: element.getBoundingClientRect().right })).filter((element) => element.right > innerWidth))));
    assert(dimensions.scrollWidth <= dimensions.viewport, JSON.stringify(dimensions));
    report.viewports.push(dimensions);
    if (width === 390) await page.screenshot({ path: path.join(out, "versions-mobile.jpg"), type: "jpeg", quality: 85 });
  }
  await page.reload();
  await page.locator(".studio-results").waitFor();
  assert.equal(await card.locator("select").inputValue(), "1"); // restored current pointer, selected pointer remains v2
  assert((await page.locator(".studio-approved").innerText()).includes("v2"));
  assert.equal(await card.locator("option").count(), 2);
  report.reload = true;
  const beforeFailure = await readFile(path.join(directory, "generation.json"), "utf8");
  await page.route("**/api/refine", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Контрольная ошибка доработки" }) }));
  await card.locator(".studio-refine-disclosure").evaluate((element) => { element.open = true; });
  await card.locator("textarea").fill("Убери фольгу");
  await card.getByRole("button", { name: "Создать версию из v1", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Контрольная ошибка доработки" }).waitFor();
  assert.equal(await card.locator("textarea").inputValue(), "Убери фольгу");
  assert.equal(await readFile(path.join(directory, "generation.json"), "utf8"), beforeFailure);
  assert.equal(await readFile(sourceFile, "utf8"), sourceText);
  assert.equal(await readFile(v2File, "utf8"), v2Text);
  report.failedEditPreserved = true;
  await page.unroute("**/api/refine");
  const state = await snapshot();
  assert.equal((await page.request.post(`${base}/api/refine`, { data: { ...state, conceptId: id, fromVersion: "1", instruction: "Темнее", generationRevision: "stale" } })).status(), 409);
  assert.equal((await page.request.post(`${base}/api/approve`, { data: { ...state, conceptId: id, version: "1", approvalRevision: "stale" } })).status(), 409);
  assert.equal((await page.request.post(`${base}/api/restore`, { data: { ...state, conceptId: id, version: "99" } })).status(), 404);
  assert.deepEqual(report.errors, []);
  await writeFile(path.join(out, recorded ? "qa-ui.json" : "qa.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); await rm(directory, { recursive: true, force: true }); }
