import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

// Explicit opt-in: this acceptance run calls the configured provider once.
assert.equal(process.env.STUDIO_QA_LIVE, "1", "Set STUDIO_QA_LIVE=1 to authorize one real generation call.");
const { chromium } = process.env.STUDIO_PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.STUDIO_PLAYWRIGHT_MODULE).href) : await import("playwright");
const base = process.env.STUDIO_QA_URL ?? "http://127.0.0.1:3147";
const slug = `qa-generation-${randomUUID().slice(0, 8)}`;
const directory = path.join(process.cwd(), "projects", slug);
const out = process.env.STUDIO_QA_OUTPUT ?? path.join(process.cwd(), "docs/m4");
const temp = await mkdtemp(path.join(os.tmpdir(), "studio-generation-qa-"));
await mkdir(out, { recursive: true });
const source = path.join(process.cwd(), "docs/m3/fixtures/group-source.jpg");
const low = path.join(temp, "small-group.jpg");
const reference = path.join(temp, "art-deco-reference.png");
await sharp(source).resize({ width: 320 }).jpeg().toFile(low);
await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768"><rect width="768" height="768" fill="#161B20"/><g fill="none" stroke="#D9B967" stroke-width="5"><path d="M60 708V60H708V708Z M84 684V84H684V684Z M108 660V108H660V660Z"/><path d="M250 384L384 250L518 384L384 518Z M290 384L384 290L478 384L384 478Z"/></g></svg>')).png().toFile(reference);
const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROME ? { executablePath: process.env.STUDIO_CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const report = { mode: "production, real Anthropic generation", fixture: "Fictional event; public-domain NASA Apollo 11 photo, downscaled copy, handcrafted geometric reference", emptyInitially: false, autoSavedBrief: false, generation: null, variants: [], viewports: [], modal: false, reload: false, failedRegenerationPreserved: false, staleRevisions: [], errors: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
const hash = (text) => createHash("sha256").update(text).digest("hex");
const snapshot = async () => {
  const contentText = await readFile(path.join(directory, "content.json"), "utf8");
  const planText = await readFile(path.join(directory, "asset-plan.json"), "utf8");
  let generationText = "";
  try { generationText = await readFile(path.join(directory, "generation.json"), "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  return { slug, revision: hash(contentText), planRevision: hash(planText), generationRevision: hash(generationText), content: JSON.parse(contentText) };
};
try {
  const demo = JSON.parse(await readFile(path.join(process.cwd(), "projects/demo/content.json"), "utf8"));
  const created = await page.request.post(`${base}/api/projects`, { data: { ...demo, slug, hosts: [{ name: "Тест" }, { name: "Серия" }], headline: "Демонстрация · Ар-деко", media: [], refs: [], brief: "" } });
  assert.equal(created.status(), 201);
  assert.equal((await created.json()).concepts.length, 0);
  await page.goto(`${base}/studio/${slug}`);
  await page.getByRole("button", { name: "04 Пять дизайнов", exact: true }).click();
  assert.equal(await page.locator(".studio-preview-card").count(), 0);
  report.emptyInitially = true;
  await page.getByRole("button", { name: "02 Фотографии и референсы", exact: true }).click();
  let chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "+ Загрузить", exact: true }).first().click();
  await (await chooser).setFiles([source, low]);
  await page.getByRole("status").filter({ hasText: "Загружено изображений: 2." }).waitFor();
  chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "+ Загрузить", exact: true }).nth(1).click();
  await (await chooser).setFiles(reference);
  await page.getByAltText("Референс 1", { exact: true }).waitFor();
  const state = await snapshot();
  const assetPlan = { unifiedTreatment: "bw", assets: state.content.media.map((media, index) => ({ id: media.id, role: "portrait", subject: "group", focal: [.5, .5], safeArea: { x: 0, y: 0, w: 1, h: 1 }, allowedRatios: ["1:1"], quality: index ? "low" : "high", treatment: "none", issues: index ? ["low-res"] : [], maxViewportShare: index ? .35 : .6, placement: { section: "greeting", index } })) };
  const savedPlan = await page.request.put(`${base}/api/projects/${slug}/asset-plan`, { data: { ...state, assetPlan } });
  assert.equal(savedPlan.status(), 200);
  await page.reload();
  await page.getByRole("button", { name: "04 Пять дизайнов", exact: true }).click();
  const brief = "Великий Гэтсби: единый чёрно-золотой ар-деко, геометрические рамки и ромбы как в референсе. Пять похожих вариантов с разным расположением фотографий, имён, даты и узоров. Не добавляй цветы.";
  await page.getByRole("textbox", { name: /^Пожелания к дизайну/ }).fill(brief);
  const generatedResponse = page.waitForResponse((response) => response.url().endsWith("/api/generate"), { timeout: 540000 });
  await page.getByRole("button", { name: "Сгенерировать 5 вариантов", exact: true }).click();
  const response = await generatedResponse;
  const generated = await response.json();
  assert.equal(response.status(), 200, JSON.stringify(generated));
  assert.equal(generated.content.brief, brief);
  report.autoSavedBrief = true;
  const generation = generated.generation;
  report.generation = { model: generation.model, elapsedMs: generation.elapsedMs, style: generation.style, references: generation.references, adjustments: generation.adjustments };
  assert.equal(generation.references, 1);
  assert.equal(generated.concepts.length, 5);
  assert.equal(generation.style.ornament.pack, "art-deco");
  assert.equal(new Set(generated.concepts.map(({ theme }) => theme.layout.composition)).size, 5);
  assert(new Set(generated.concepts.map(({ theme }) => JSON.stringify(theme.photos))).size > 1, "Photo placement must vary");
  for (const { theme } of generated.concepts) {
    const { meta, layout, photos, ornament, ...shared } = theme;
    assert.deepEqual(shared, Object.fromEntries(Object.keys(shared).map((key) => [key, generation.style[key]])));
    assert.equal(ornament.pack, generation.style.ornament.pack);
    assert.equal(ornament.color, generation.style.ornament.color);
    assert.equal(ornament.density, generation.style.ornament.density);
    assert.equal(photos.length, 2);
    assert(!photos.some((photo) => photo.id === state.content.media[1].id && photo.section === "hero"));
    report.variants.push({ name: meta.name, composition: layout.composition, arrangement: layout.photoArrangement, ornaments: ornament.placement, photos });
  }
  await page.getByRole("status").filter({ hasText: "Созданы пять новых композиций" }).waitFor();
  const cards = page.locator(".studio-preview-card");
  assert.equal(await cards.count(), 5);
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    const frame = await (await card.locator("iframe").elementHandle()).contentFrame();
    await frame.locator("#hero-title").waitFor();
    assert.equal(await frame.locator(".directed-photo").count(), 2);
    for (const photo of await frame.locator(".directed-photo").all()) assert.equal(await photo.getAttribute("data-treatment"), "bw");
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, "grid-desktop.jpg"), type: "jpeg", quality: 85, fullPage: true });
  await cards.first().getByRole("button", { name: /^Посмотреть/ }).click();
  await page.locator("dialog[open] iframe").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("dialog[open]").waitFor({ state: "detached" });
  report.modal = true;
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert(dimensions.scrollWidth <= dimensions.viewport);
    report.viewports.push({ view: "studio", ...dimensions });
    if (width === 390) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(out, "grid-mobile.jpg"), type: "jpeg", quality: 85 }); }
  }
  for (const concept of generated.concepts) {
    await page.goto(`${base}/preview/${slug}/${concept.id}/${concept.version}?embed=1`);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator("#hero-title").waitFor();
      const clippedTitle = await page.locator("#hero-title").evaluate((heading) => {
        const range = document.createRange();
        range.selectNodeContents(heading);
        return [...range.getClientRects()].some((rect) => rect.left < -.5 || rect.right > innerWidth + .5);
      });
      assert.equal(clippedTitle, false, `${concept.theme.layout.composition}: title clipped at ${width}px`);
      assert.equal(await page.locator(".directed-photo").count(), 2);
      for (const figure of await page.locator(".directed-photo").all()) {
        await figure.scrollIntoViewIfNeeded();
        await figure.locator("img").evaluate((image) => image.decode());
        assert.equal(await figure.getAttribute("data-crop"), "whole");
      }
      const lowBounds = await page.locator(`[data-photo-id="${state.content.media[1].id}"]`).boundingBox();
      assert(lowBounds.width <= width * .35 + 1 && lowBounds.height <= 900 * .35 + 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      report.viewports.push({ view: concept.theme.layout.composition, viewport: width, lowPhotoWidth: lowBounds.width });
      if (concept === generated.concepts[0]) { await page.locator(".slot-hero").scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, `invitation-${width}.jpg`), type: "jpeg", quality: 85 }); }
    }
  }
  await page.goto(`${base}/studio/${slug}`);
  await page.getByRole("button", { name: "04 Пять дизайнов", exact: true }).click();
  assert.equal(await cards.count(), 5);
  report.reload = true;
  const before = await readFile(path.join(directory, "generation.json"), "utf8");
  await page.route("**/api/generate", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Контрольная ошибка провайдера" }) }));
  await page.getByRole("button", { name: "Сгенерировать ещё 5 вариантов", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Контрольная ошибка провайдера" }).waitFor();
  assert.equal(await cards.count(), 5);
  assert.equal(await readFile(path.join(directory, "generation.json"), "utf8"), before);
  report.failedRegenerationPreserved = true;
  await page.unroute("**/api/generate");
  const current = await snapshot();
  for (const key of ["revision", "planRevision", "generationRevision"]) {
    const stale = await page.request.post(`${base}/api/generate`, { data: { ...current, [key]: "stale" } });
    assert.equal(stale.status(), 409);
    report.staleRevisions.push(key);
  }
  assert.deepEqual(report.errors, []);
  await writeFile(path.join(out, "qa.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, generation: { model: generation.model, elapsedMs: generation.elapsedMs, references: generation.references }, variants: report.variants.map(({ composition }) => composition) }, null, 2));
} finally {
  await browser.close();
  await rm(directory, { recursive: true, force: true });
  await rm(temp, { recursive: true, force: true });
}
