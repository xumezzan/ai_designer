import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const { chromium } = process.env.STUDIO_PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.STUDIO_PLAYWRIGHT_MODULE).href) : await import("playwright");
const base = process.env.STUDIO_QA_URL ?? "http://127.0.0.1:3147";
const slug = `qa-photos-${randomUUID().slice(0, 8)}`;
const directory = path.join(process.cwd(), "projects", slug);
const out = process.env.STUDIO_QA_OUTPUT ?? path.join(process.cwd(), "docs/m3");
const temp = await mkdtemp(path.join(os.tmpdir(), "studio-photo-qa-"));
await mkdir(out, { recursive: true });
const source = path.join(process.cwd(), "docs/m3/fixtures/group-source.jpg");
const files = [path.join(temp, "studio.jpg"), path.join(temp, "flash-simulation.jpg"), path.join(temp, "low-res-group.jpg")];
await sharp(source).jpeg({ quality: 92 }).toFile(files[0]);
await sharp(source).resize({ width: 1200 }).modulate({ brightness: 1.6, saturation: 1.25 }).jpeg({ quality: 70 }).toFile(files[1]);
await sharp(source).resize({ width: 320 }).blur(.5).jpeg({ quality: 45 }).toFile(files[2]);
const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROME ? { executablePath: process.env.STUDIO_CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const report = { mode: process.env.STUDIO_QA_MODE ?? "development", fixture: "NASA Apollo 11 group portrait; exposure and low-resolution variants are controlled test simulations", saved: false, reload: false, photos: [], previews: [], viewports: [], missingKey: false, errors: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
const hash = (text) => createHash("sha256").update(text).digest("hex");
async function setRange(locator, value) {
  await locator.evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
try {
  const demo = JSON.parse(await readFile(path.join(process.cwd(), "projects/demo/content.json"), "utf8"));
  const created = await page.request.post(`${base}/api/projects`, { data: { ...demo, slug, hosts: [{ name: "Тест" }, { name: "Фото" }], media: [], refs: [], brief: "Photo regression fixture; not a real event" } });
  assert.equal(created.status(), 201);
  await page.goto(`${base}/studio/${slug}`);
  await page.getByText("Фото и референсы", { exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator(".studio-media-heading").getByRole("button", { name: "Добавить", exact: true }).first().click();
  await (await chooser).setFiles(files);
  await page.getByRole("status").filter({ hasText: "Добавлено фото: 3." }).waitFor();
  await page.locator(".studio-upload-disclosure").evaluate((element) => { element.open = true; });
  await page.getByText("Настроить кадры и обработку", { exact: true }).click();
  const cards = page.locator(".studio-photo-settings");
  assert.equal(await cards.count(), 3);
  await page.getByRole("combobox", { name: /^Общая обработка серии/ }).selectOption("bw");
  for (let index = 0; index < 3; index++) {
    const card = cards.nth(index);
    await card.getByRole("combobox", { name: /^Роль фото/ }).selectOption(index === 0 ? "hero" : "portrait");
    await card.getByRole("combobox", { name: /^Что изображено/ }).selectOption("group");
    await setRange(card.getByRole("slider", { name: /Область: слева/ }), 15);
    await setRange(card.getByRole("slider", { name: /Область: сверху/ }), 10);
    await setRange(card.getByRole("slider", { name: /Ширина области/ }), 68);
    await setRange(card.getByRole("slider", { name: /Высота области/ }), 48);
    for (const ratio of index === 2 ? ["4:5", "1:1", "3:2", "16:9"] : ["4:5", "3:2", "16:9"]) await card.getByRole("checkbox", { name: ratio, exact: true }).uncheck();
  }
  const firstStage = cards.first().locator(".studio-photo-stage");
  const bounds = await firstStage.boundingBox();
  await firstStage.click({ position: { x: bounds.width * .6, y: bounds.height * .3 } });
  const value = Number(await cards.first().getByRole("slider", { name: /Фокус по горизонтали/ }).inputValue());
  assert(Math.abs(value - 60) <= 1);
  await cards.nth(2).getByRole("slider", { name: /Максимальная доля экрана/ }).focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  assert.equal(await cards.nth(2).getByRole("slider", { name: /Максимальная доля экрана/ }).inputValue(), "16");
  await setRange(cards.nth(2).getByRole("slider", { name: /Максимальная доля экрана/ }), 35);
  await page.locator("#save-photo-plan").click();
  await page.getByRole("status").filter({ hasText: "Настройки фото сохранены." }).waitFor();
  let plan = JSON.parse(await readFile(path.join(directory, "asset-plan.json"), "utf8"));
  assert.equal(plan.assets.length, 3); assert.equal(plan.unifiedTreatment, "bw");
  assert.equal(plan.assets[0].placement.section, "hero");
  assert.equal(plan.assets[2].quality, "low");
  report.saved = true;
  await page.evaluate(() => scrollTo(0, document.querySelector(".studio-photo-settings").getBoundingClientRect().top + scrollY - 30));
  await page.screenshot({ path: path.join(out, "editor-desktop.jpg"), type: "jpeg", quality: 85 });
  const content = JSON.parse(await readFile(path.join(directory, "content.json"), "utf8"));
  if (await page.getByRole("button", { name: "Проанализировать фото", exact: true }).isDisabled()) {
    const response = await page.request.post(`${base}/api/plan-assets`, { data: { slug, revision: hash(await readFile(path.join(directory, "content.json"), "utf8")), planRevision: hash(await readFile(path.join(directory, "asset-plan.json"), "utf8")) } });
    assert.equal(response.status(), 503); assert((await response.json()).error.includes("ANTHROPIC_API_KEY"));
    assert.equal(await page.getByRole("button", { name: "Проанализировать фото", exact: true }).isDisabled(), true);
    report.missingKey = true;
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.equal(dimensions.scrollWidth, dimensions.viewport);
    report.viewports.push({ view: "editor", ...dimensions });
    if (width === 390) {
      await firstStage.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, "editor-mobile.jpg"), type: "jpeg", quality: 85 });
    }
  }
  await page.reload();
  await page.locator(".studio-upload-disclosure").evaluate((element) => { element.open = true; });
  await page.getByText("Настроить кадры и обработку", { exact: true }).click();
  assert.equal(await page.getByRole("combobox", { name: /^Общая обработка серии/ }).inputValue(), "bw");
  report.reload = true;
  // Legacy hand-authored fixtures are explicitly copied for this renderer test only.
  // Production project creation is empty; real generated grids are covered by qa-generation.mjs.
  await cp(path.join(process.cwd(), "projects/demo/concepts"), path.join(directory, "concepts"), { recursive: true });
  for (const id of ["letter", "poster", "folio", "arch", "botanical"]) {
    await page.goto(`${base}/preview/${slug}/${id}/1?embed=1`);
    await page.locator(".directed-photo").first().waitFor();
    assert.equal(await page.locator(".directed-photo").count(), 3);
    report.previews.push({ fixture: id, photos: 3 });
  }
  // Add a new fixture version; never rewrite an existing theme snapshot.
  const theme = JSON.parse(await readFile(path.join(directory, "concepts/letter/v1.json"), "utf8"));
  theme.layout.hero = "full-photo";
  await writeFile(path.join(directory, "concepts/letter/v2.json"), JSON.stringify(theme, null, 2) + "\n");
  await page.goto(`${base}/preview/${slug}/letter/2?embed=1`);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator(".directed-photo").first().waitFor();
    // Decode every lazy image before checking protected areas in actual CSS pixels.
    for (const figure of await page.locator(".directed-photo").all()) {
      await figure.scrollIntoViewIfNeeded();
      await figure.locator("img").evaluate((image) => image.decode());
    }
    const final = await page.evaluate(({ assets }) => {
      return [...document.querySelectorAll(".directed-photo")].map((figure) => {
        const image = figure.querySelector("img");
        const asset = assets.find((asset) => asset.id === figure.dataset.photoId);
        const box = figure.getBoundingClientRect();
        const sx = box.width / image.naturalWidth, sy = box.height / image.naturalHeight;
        const scale = Math.max(sx, sy);
        const x = (image.naturalWidth * scale - box.width) * asset.focal[0];
        const y = (image.naturalHeight * scale - box.height) * asset.focal[1];
        const safe = asset.safeArea;
        const rect = { left: safe.x * image.naturalWidth * scale - x, top: safe.y * image.naturalHeight * scale - y, right: (safe.x + safe.w) * image.naturalWidth * scale - x, bottom: (safe.y + safe.h) * image.naturalHeight * scale - y };
        return { id: asset.id, width: box.width, height: box.height, naturalWidth: image.naturalWidth, crop: figure.dataset.crop, ratio: figure.dataset.ratio, treatment: figure.dataset.treatment, filter: getComputedStyle(image).filter, safe: rect, valid: rect.left >= -.01 && rect.top >= -.01 && rect.right <= box.width + .01 && rect.bottom <= box.height + .01 };
      });
    }, plan);
    assert.equal(final.length, 3);
    assert(final.every((photo) => photo.treatment === "bw" && photo.filter.includes("grayscale(1)")));
    assert(final.every((photo) => photo.naturalWidth > 0 && photo.valid), JSON.stringify(final));
    assert.equal(final[0].ratio, "1:1");
    assert.equal(final[2].crop, "whole");
    assert(final[2].width <= Math.min(320, width * .35) + 1);
    assert(final[2].height <= 1000 * .35 + 1);
    report.photos.push({ viewport: width, photos: final });
    report.viewports.push({ view: "invitation", viewport: width, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    if (width === 1440) {
      await page.locator(".slot-greeting").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, "invitation-desktop.jpg"), type: "jpeg", quality: 85 });
    }
    if (width === 390) {
      await page.locator(".slot-hero").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, "invitation-mobile.jpg"), type: "jpeg", quality: 85 });
    }
  }
  assert(content.media.length === 3);
  assert.deepEqual(report.errors, []);
  await writeFile(path.join(out, "qa.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(out, "failure.jpg"), type: "jpeg", quality: 85 });
  console.error(await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
  await rm(directory, { recursive: true, force: true });
  await rm(temp, { recursive: true, force: true });
}
