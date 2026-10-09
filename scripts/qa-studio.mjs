import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Uses a provided Playwright runtime without adding a production dependency.
const playwright = process.env.STUDIO_PLAYWRIGHT_MODULE;
const { chromium } = playwright ? await import(pathToFileURL(playwright).href) : await import("playwright");
const base = process.env.STUDIO_QA_URL ?? "http://127.0.0.1:3147";
const slug = `qa-studio-${randomUUID().slice(0, 8)}`;
const destination = path.join(process.cwd(), "docs/m2");
const temporary = await mkdtemp(path.join(os.tmpdir(), "studio-browser-qa-"));
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROME ? { executablePath: process.env.STUDIO_CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const errors = [];
const report = { mode: process.env.STUDIO_QA_MODE ?? "development", created: false, uploads: false, saved: false, previews: [], viewports: [], modal: false, reload: false, errors };
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(`${base}/studio`);
  await page.screenshot({ path: path.join(destination, "list-desktop.jpg"), type: "jpeg", quality: 85 });
  await page.getByRole("link", { name: "+ Новый проект" }).click();
  await page.getByRole("textbox", { name: "Имя 1", exact: true }).fill("Дилшод");
  await page.getByRole("textbox", { name: "Имя 2", exact: true }).fill("Малика");
  await page.getByRole("textbox", { name: /^Адрес проекта/ }).fill(slug);
  await page.locator('input[type="datetime-local"]').fill("2027-05-16T18:30");
  await page.getByRole("textbox", { name: "Название места", exact: true }).fill("Сад «Ситора»");
  await page.getByRole("textbox", { name: "Адрес", exact: true }).fill("Ташкент, улица Весенняя, 16");
  await page.getByRole("textbox", { name: "Обращение к гостям", exact: true }).fill("Дорогие друзья! Будем рады провести этот вечер вместе с вами.");
  await page.getByRole("button", { name: "+ Добавить пункт программы", exact: true }).click();
  await page.getByRole("textbox", { name: "Что запланировано", exact: true }).fill("Встреча в саду");
  await page.getByRole("checkbox", { name: "Добавить дресс-код" }).check();
  await page.getByRole("textbox", { name: "Название дресс-кода" }).fill("В природных оттенках");
  await page.getByRole("button", { name: "+ Цвет", exact: true }).click();
  await page.getByRole("checkbox", { name: "Попросить подтвердить участие" }).check();
  await page.getByRole("textbox", { name: "Имя в Telegram", exact: true }).fill("@studio_qa_example");
  await page.getByRole("button", { name: "Создать проект", exact: true }).click();
  await page.waitForURL(`${base}/studio/${slug}`);
  await page.getByRole("button", { name: "Сохранить", exact: true }).waitFor();
  report.created = true;
  const file = path.join(process.cwd(), "projects", slug, "content.json");
  let stored = JSON.parse(await readFile(file, "utf8"));
  assert.equal(stored.date.start, "2027-05-16T18:30:00+05:00");
  assert.equal(stored.timeline.length, 1);
  assert.equal(stored.dressCode.swatches.length, 1);
  assert.equal((await page.request.post(`${base}/api/projects`, { data: stored })).status(), 409);
  assert.equal((await page.request.put(`${base}/api/projects/${slug}`, { data: { content: stored, revision: "stale" } })).status(), 409);
  assert.equal((await page.request.post(`${base}/api/projects`, { data: { ...stored, slug: "another" }, headers: { origin: "https://foreign.example" } })).status(), 403);
  assert.equal((await page.request.put(`${base}/api/projects/${slug}`, { data: null })).status(), 400);
  await page.screenshot({ path: path.join(destination, "questionnaire-desktop.jpg"), type: "jpeg", quality: 85 });
  await page.getByRole("textbox", { name: "Обращение к гостям", exact: true }).fill("Новый текст сохраняется вместе с загруженными фотографиями.");
  await page.getByRole("button", { name: "02 Фотографии и референсы", exact: true }).click();
  const photo = path.join(process.cwd(), "public/artwork/suzani-atelier/hero-v1.webp");
  const reference = path.join(process.cwd(), "public/artwork/suzani-atelier/velvet-v1.webp");
  const uploadButtons = page.getByRole("button", { name: "+ Загрузить", exact: true });
  let chooserEvent = page.waitForEvent("filechooser");
  await uploadButtons.nth(0).click();
  await (await chooserEvent).setFiles(photo);
  await page.getByRole("status").filter({ hasText: "Загружено изображений: 1." }).waitFor();
  chooserEvent = page.waitForEvent("filechooser");
  await uploadButtons.nth(1).click();
  await (await chooserEvent).setFiles(reference);
  await page.getByAltText("Референс 1", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Сохранить", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Сохранено." }).waitFor();
  stored = JSON.parse(await readFile(file, "utf8"));
  assert.equal(stored.media.length, 1);
  assert.equal(stored.refs.length, 1);
  assert.equal(stored.greeting, "Новый текст сохраняется вместе с загруженными фотографиями.");
  report.uploads = true; report.saved = true;
  await page.getByRole("button", { name: "02 Фотографии и референсы", exact: true }).click();
  await page.screenshot({ path: path.join(destination, "media-desktop.jpg"), type: "jpeg", quality: 85 });
  await page.getByRole("button", { name: "Удалить фотографию 1", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Изображение удалено" }).waitFor();
  stored = JSON.parse(await readFile(file, "utf8"));
  assert.equal(stored.media.length, 0); assert.equal(stored.refs.length, 1);
  const invalid = path.join(temporary, "invalid.png");
  await writeFile(invalid, "this is not an image");
  chooserEvent = page.waitForEvent("filechooser");
  await uploadButtons.nth(0).click();
  await (await chooserEvent).setFiles(invalid);
  await page.getByRole("alert").filter({ hasText: "Файл не удалось прочитать" }).waitFor();
  await page.getByRole("button", { name: "03 Пять дизайнов", exact: true }).click();
  assert.equal(await page.locator(".studio-preview-card").count(), 5);
  for (const card of await page.locator(".studio-preview-card").all()) {
    await card.scrollIntoViewIfNeeded();
    const frame = await card.locator("iframe").elementHandle();
    const contentFrame = await frame.contentFrame();
    await contentFrame.locator("#hero-title").waitFor();
    const heading = await contentFrame.locator("#hero-title").innerText();
    assert(heading.includes("Дилшод") && heading.includes("Малика"));
    report.previews.push({ title: await card.locator("h3").innerText(), heading, sections: await contentFrame.locator("[data-section]").count() });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(destination, "grid-desktop.jpg"), type: "jpeg", quality: 85, fullPage: true });
  await page.getByRole("button", { name: "Компьютер", exact: true }).click();
  await page.locator(".studio-preview-window iframe").first().waitFor();
  await page.getByRole("button", { name: "Телефон", exact: true }).click();
  await page.getByRole("button", { name: "Посмотреть Сузани · Atelier", exact: true }).click();
  await page.locator("dialog[open] iframe").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("dialog[open]").waitFor({ state: "detached" });
  report.modal = true;
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ["01 Анкета", "02 Фотографии и референсы", "03 Пять дизайнов"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert(dimensions.scrollWidth <= dimensions.viewport, `${width} ${tab}: overflow ${dimensions.scrollWidth}`);
      report.viewports.push({ width, tab, ...dimensions });
    }
    if (width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const first = await page.locator(".studio-preview-card iframe").first().elementHandle();
      await (await first.contentFrame()).locator("#hero-title").waitFor();
      await page.screenshot({ path: path.join(destination, "grid-mobile.jpg"), type: "jpeg", quality: 85 });
    }
  }
  await page.reload();
  await page.getByRole("textbox", { name: "Обращение к гостям", exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Обращение к гостям", exact: true }).inputValue(), stored.greeting);
  report.reload = true;
  assert.deepEqual(errors, []);
  await writeFile(path.join(destination, "qa.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await rm(path.join(process.cwd(), "projects", slug), { recursive: true, force: true });
  await rm(temporary, { recursive: true, force: true });
}
