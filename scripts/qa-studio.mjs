import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Real persistence and uploads; generation is a local fixture, with no provider calls.
const playwright = process.env.STUDIO_PLAYWRIGHT_MODULE;
const { chromium } = playwright ? await import(pathToFileURL(playwright).href) : await import("playwright");
const base = process.env.STUDIO_QA_URL ?? "http://127.0.0.1:3147";
const destination = process.env.STUDIO_QA_OUTPUT ?? path.join(process.cwd(), "docs/studio-workspace");
const temporary = await mkdtemp(path.join(os.tmpdir(), "studio-workspace-qa-"));
const cleanup = new Set();
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROME ? { executablePath: process.env.STUDIO_CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const report = { mode: process.env.STUDIO_QA_MODE ?? "development", generation: "local fixture, no paid calls", checks: {}, viewports: [], errors: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const detail = (text) => page.locator("summary").filter({ hasText: text }).first().locator("..");
const open = async (text) => { const box = detail(text); if (!await box.evaluate((element) => element.open)) await box.locator("summary").first().click(); };
const stored = async (slug) => JSON.parse(await readFile(path.join(process.cwd(), "projects", slug, "content.json"), "utf8"));
async function fillBasics() {
  await page.getByRole("textbox", { name: "Имя 1", exact: true }).fill("Дилшод");
  await page.getByRole("textbox", { name: "Имя 2", exact: true }).fill("Малика");
  await page.locator('input[type="datetime-local"]').fill("2027-05-16T18:30");
  await page.getByRole("textbox", { name: "Название места", exact: true }).fill("Сад «Ситора»");
  await page.getByRole("textbox", { name: "Адрес", exact: true }).fill("Ташкент, улица Весенняя, 16");
}
let generateRequests = 0;
await page.route("**/api/generate", async (route) => {
  generateRequests++;
  const request = route.request().postDataJSON();
  cleanup.add(request.slug);
  const response = await page.request.get(`${base}/api/projects/${request.slug}`);
  assert.equal(response.status(), 200);
  const project = await response.json();
  assert.equal(request.revision, project.revision);
  assert.equal(request.planRevision, project.planRevision);
  assert.equal(request.createVisual, false);
  if (generateRequests > 1) {
    assert.equal(project.assetPlan.unifiedTreatment, "bw", "Photo edits must save with generation");
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Тест: генерация временно недоступна. Черновик сохранён." }) });
    return;
  }
  assert.equal(project.content.variantCount, 3);
  assert(project.content.brief.includes("бархат"));
  const template = JSON.parse(await readFile("projects/demo/concepts/folio/v1.json", "utf8"));
  const concepts = [];
  for (const [index, composition] of ["letter", "poster", "folio"].entries()) {
    const id = `variant-workspace-${index + 1}`;
    const theme = { ...template, meta: { name: ["Камерный вечер", "Крупный акцент", "Личное письмо"][index], mood: ["вечер"], rationale: "Тестовый вариант для проверки интерфейса." }, layout: { ...template.layout, composition }, photos: [] };
    await mkdir(path.join("projects", request.slug, "concepts", id), { recursive: true });
    await writeFile(path.join("projects", request.slug, "concepts", id, "v1.json"), JSON.stringify(theme));
    concepts.push({ id, version: "1", theme });
  }
  const { meta, layout, photos, ornament, ...style } = template;
  void meta; void layout; void photos;
  const { placement, ...sharedOrnament } = ornament; void placement;
  const generation = { batchId: randomUUID(), createdAt: new Date().toISOString(), brief: project.content.brief, model: "browser-qa-fixture", elapsedMs: 0, style: { ...style, ornament: sharedOrnament, name: "Тестовая серия", mood: ["вечер"], rationale: "Локальная серия для проверки интерфейса." }, adjustments: [], references: 0, concepts: concepts.map(({id,version}) => ({id,version})) };
  await writeFile(path.join("projects", request.slug, "generation.json"), JSON.stringify(generation));
  const generated = await page.request.get(`${base}/api/projects/${request.slug}`);
  assert.equal(generated.status(), 200, await generated.text());
  await route.fulfill({ status: 200, contentType: "application/json", body: await generated.text() });
});
try {
  await page.goto(`${base}/studio`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(destination, "projects-desktop.jpg"), type: "jpeg", quality: 85 });
  await page.getByRole("link", { name: "+ Новый проект" }).click();
  await page.locator(".studio-draft-paper").waitFor();
  assert.equal(await page.locator(".studio-sidebar").count(), 0);
  assert.equal(await page.locator(".studio-preview-card").count(), 0);
  assert(await page.locator(".studio-draft-paper").isVisible());
  assert.equal(await page.locator(".studio-disclosure[open]").count(), 0);
  await fillBasics();
  assert((await page.locator(".studio-draft-paper h3").textContent()).includes("Дилшод и Малика"));
  await page.getByRole("button", { name: "Бархат", exact: false }).click();
  assert.equal(await page.locator(".studio-draft-paper").getAttribute("data-direction"), "velvet");
  await page.screenshot({ path: path.join(destination, "workspace-desktop.jpg"), type: "jpeg", quality: 85 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(destination, "workspace-mobile.jpg"), type: "jpeg", quality: 85 });
  const primary = page.getByRole("button", { name: "Создать дизайны", exact: true });
  if (await primary.isDisabled()) throw new Error("QA requires the configured generation capability; all provider calls are intercepted.");
  await primary.click();
  await page.waitForURL(/\/studio\/event-[a-f0-9]{8}$/);
  const slug = new URL(page.url()).pathname.split("/").at(-1); cleanup.add(slug);
  await page.locator(".studio-preview-card").first().waitFor();
  assert.equal(await page.locator(".studio-preview-card").count(), 3);
  assert.equal((await stored(slug)).date.start, "2027-05-16T18:30:00+05:00");
  assert.equal(generateRequests, 1);
  report.checks.oneClickGeneration = report.checks.liveDraft = report.checks.optionalSectionsClosed = true;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  for (const iframe of await page.locator(".studio-preview-card iframe").all()) {
    await iframe.scrollIntoViewIfNeeded();
    const frame = await (await iframe.elementHandle()).contentFrame();
    await frame.locator("#hero-title").waitFor();
    await frame.evaluate(() => document.fonts.ready);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(destination, "designs-desktop.jpg"), type: "jpeg", quality: 85 });
  const first = page.locator(".studio-preview-card").first();
  assert(await first.getByRole("button", { name: "Выбрать v1", exact: true }).isDisabled());
  assert.equal(await first.locator(".studio-refine-disclosure").evaluate((element) => element.open), false);
  await first.getByRole("button", { name: /^Посмотреть/ }).click();
  await page.locator("dialog[open] iframe").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("dialog[open]").waitFor({ state: "detached" });
  report.checks.modal = report.checks.qaGatePreserved = report.checks.refinementCollapsed = true;
  // Invalid fields in a collapsed optional section reveal themselves before validation.
  await open("Слова и программа");
  await page.getByRole("button", { name: "+ Добавить пункт программы", exact: true }).click();
  await detail("Слова и программа").locator("summary").first().click();
  await page.getByRole("button", { name: "Сохранить черновик", exact: true }).click();
  assert.equal(await detail("Слова и программа").evaluate((element) => element.open), true);
  assert.equal(await page.getByRole("textbox", { name: "Что запланировано", exact: true }).evaluate((element) => element === document.activeElement), true);
  await page.getByRole("textbox", { name: "Что запланировано", exact: true }).fill("Встреча в саду");
  await page.getByRole("textbox", { name: "Обращение к гостям", exact: true }).fill("Будем рады провести этот вечер вместе с вами.");
  report.checks.collapsedValidation = true;
  await open("Дресс-код и ответ гостей");
  await page.getByRole("checkbox", { name: "Добавить дресс-код" }).check();
  await page.getByRole("textbox", { name: "Название дресс-кода" }).fill("В природных оттенках");
  await page.getByRole("button", { name: "+ Цвет", exact: true }).click();
  await page.getByRole("checkbox", { name: "Попросить подтвердить участие" }).check();
  await page.getByRole("textbox", { name: "Имя в Telegram", exact: true }).fill("@studio_qa_example");
  await open("Фото и референсы");
  const upload = async (index, files) => {
    const chooser = page.waitForEvent("filechooser");
    await page.locator(".studio-media-heading").getByRole("button", { name: "Добавить", exact: true }).nth(index).click();
    await (await chooser).setFiles(files);
  };
  await upload(0, "public/artwork/suzani-atelier/hero-v1.webp");
  await page.getByRole("status").filter({ hasText: "Снимки уже включены" }).waitFor();
  await upload(1, "public/artwork/suzani-atelier/velvet-v1.webp");
  await page.getByRole("status").filter({ hasText: "Добавлено референсов: 1" }).waitFor();
  const content = await stored(slug);
  assert.equal(content.timeline.length, 1); assert.equal(content.dressCode.swatches.length, 1);
  assert.equal(content.media.length, 1); assert.equal(content.refs.length, 1);
  assert.equal(content.greeting, "Будем рады провести этот вечер вместе с вами.");
  const plan = JSON.parse(await readFile(`projects/${slug}/asset-plan.json`, "utf8"));
  assert.equal(plan.assets.length, 1); assert.equal(plan.assets[0].role, "portrait");
  assert.deepEqual(plan.assets[0].safeArea, { x: 0, y: 0, w: 1, h: 1 });
  assert(!plan.assets.some((asset) => content.refs.includes(asset.id)));
  report.checks.uploadSavesDraft = report.checks.photosEnabledWithoutExtraStep = true;
  await open("Настроить кадры и обработку");
  await page.getByRole("combobox", { name: "Общая обработка серии", exact: true }).selectOption("bw");
  await page.getByRole("button", { name: "Создать новые дизайны", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Тест: генерация временно недоступна" }).waitFor();
  assert.equal(await page.locator(".studio-preview-card").count(), 3);
  report.checks.photoEditsAutoSave = report.checks.failedGenerationPreservesDesigns = true;
  assert.equal((await page.request.post(`${base}/api/projects`, { data: { ...content, media: [], refs: [] } })).status(), 409);
  assert.equal((await page.request.put(`${base}/api/projects/${slug}`, { data: { content, revision: "stale" } })).status(), 409);
  assert.equal((await page.request.post(`${base}/api/projects`, { data: { ...content, slug: "another" }, headers: { origin: "https://foreign.example" } })).status(), 403);
  report.checks.revisionAndOriginProtection = true;
  const invalid = path.join(temporary, "invalid.png"); await writeFile(invalid, "not an image");
  await upload(0, invalid);
  await page.getByRole("alert").filter({ hasText: "Файл не удалось прочитать" }).waitFor();
  await page.getByRole("button", { name: "Удалить фотографию 1", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Изображение удалено" }).waitFor();
  assert.equal((await stored(slug)).media.length, 0);
  report.checks.invalidUploadAndRemove = true;
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert(dimensions.scrollWidth <= width, `${width}px: overflow ${dimensions.scrollWidth}`);
    report.viewports.push(dimensions);
  }
  await page.reload();
  assert.equal(await page.locator(".studio-preview-card").count(), 3);
  await open("Слова и программа");
  assert.equal(await page.getByRole("textbox", { name: "Обращение к гостям", exact: true }).inputValue(), content.greeting);
  report.checks.reload = true;
  await page.getByRole("button", { name: "Включить тёмную тему", exact: true }).click();
  assert.equal(await page.locator(".studio").getAttribute("data-theme"), "dark");
  await page.reload();
  assert.equal(await page.locator(".studio").getAttribute("data-theme"), "dark");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(destination, "workspace-dark.jpg"), type: "jpeg", quality: 85 });
  await page.getByRole("button", { name: "Включить светлую тему", exact: true }).click();
  report.checks.themePersistence = true;
  // A new project's first upload also saves and creates it automatically.
  await page.goto(`${base}/studio/new`); await fillBasics(); await open("Фото и референсы");
  await upload(0, "public/artwork/suzani-atelier/hero-v1.webp");
  await page.waitForURL(/\/studio\/event-[a-f0-9]{8}$/);
  const uploadSlug = new URL(page.url()).pathname.split("/").at(-1); cleanup.add(uploadSlug);
  assert.equal((await stored(uploadSlug)).media.length, 1);
  assert.equal(JSON.parse(await readFile(`projects/${uploadSlug}/asset-plan.json`, "utf8")).assets[0].role, "portrait");
  report.checks.firstUploadCreatesProject = true;
  assert.deepEqual(report.errors, []);
  await writeFile(path.join(destination, "qa.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  for (const slug of cleanup) await rm(path.join(process.cwd(), "projects", slug), { recursive: true, force: true });
  await rm(temporary, { recursive: true, force: true });
}
