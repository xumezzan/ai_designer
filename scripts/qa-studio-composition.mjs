import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

// Run against an isolated local server. Fixtures never call an AI provider and
// are removed in finally; only the report and screenshots survive the run.
const { chromium } = process.env.STUDIO_PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.STUDIO_PLAYWRIGHT_MODULE).href)
  : await import("playwright");
const base = process.env.STUDIO_QA_URL ?? "http://127.0.0.1:3154";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "QA requires a local server");
const output = process.env.STUDIO_QA_OUTPUT ?? path.join(process.cwd(), "docs/studio-templates/composition-qa");
const browser = await chromium.launch({ headless: true, ...(process.env.STUDIO_CHROME ? { executablePath: process.env.STUDIO_CHROME } : {}) });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const report = { responsive: [], checks: [], errors: [], externalRequests: [], fixtureCount: 0 };
const directories = [];
page.on("pageerror", error => report.errors.push(error.message));
page.on("request", request => {
  if (!request.url().startsWith("http")) return;
  if (!["localhost", "127.0.0.1"].includes(new URL(request.url()).hostname)) report.externalRequests.push(request.url());
});
const heroLayouts = ["fullscreen-cover", "split-editorial", "framed-arch", "typographic-poster", "minimal-card"];
const shapes = ["sharp", "rounded", "arch", "pill", "circle", "polaroid"];
const surfaces = ["flat", "glassmorphism", "bordered-hairline", "elevated-card", "soft-gradient"];
const sectionVariants = index => ({
  countdown: ["tiles", "date-led", "inline"][index % 3],
  program: ["timeline", "cards", "editorial-list"][index % 3],
  venue: ["stacked", "split", "card"][index % 3],
  gallery: ["grid", "filmstrip", "editorial"][index % 3],
  rsvp: ["card", "split", "minimal"][index % 3],
});
const composition = index => ({
  heroLayout: heroLayouts[index % heroLayouts.length],
  photoShape: shapes[index % shapes.length],
  surfaceStyle: surfaces[index % surfaces.length],
  spacingScale: ["compact-poster", "balanced", "airy-gallery"][index % 3],
  typographyAccent: ["italic-serif-accent", "uppercase-wide-tracking", "oversized-display", "classic-centered"][index % 4],
  ...(index === 5 ? { motionPreset: "unfold" } : {}),
  decorConfig: { placement: ["corners", "dividers", "background-pattern", "frame"][index % 4], density: index === 0 ? "none" : index % 2 ? "subtle" : "rich", opacity: 0.2 },
  sectionVariants: sectionVariants(index),
});
async function post(url, body) {
  const response = await fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) });
  const result = await response.json();
  assert(response.ok, `${url}: ${JSON.stringify(result)}`);
  return result;
}
async function visit(url, target = page) {
  const response = await target.goto(url, { waitUntil: "networkidle" });
  assert(response.ok(), `${url}: ${response.status()}`);
  await target.evaluate(() => document.fonts.ready);
}
async function fit() {
  return page.evaluate(() => {
    const filmstrip = element => {
      const set = element.closest(".studio-template-photo-set");
      return set && getComputedStyle(set).overflowX === "auto";
    };
    const overflow = [...document.querySelectorAll("main.studio-template :is(h1,h2,p,address,input,button,summary)")]
      .filter(element => element.checkVisibility() && !filmstrip(element) && (element.getBoundingClientRect().left < -1 || element.getBoundingClientRect().right > innerWidth + 1))
      .map(element => `${element.tagName}.${element.className}`);
    return { width: innerWidth, document: document.documentElement.scrollWidth, overflow };
  });
}
const fixtures = [];
const recipeSeeds = new Map();
try {
  await mkdir(output, { recursive: true });
  const demo = JSON.parse(await readFile("projects/demo/content.json", "utf8"));
  // Ten layouts cover every Hero with and without media; modulo choices cover
  // all masks, surfaces, type accents and section variants without a huge grid.
  for (let index = 0; index < 11; index++) {
    const slug = `qa-composition-${randomUUID().slice(0, 8)}`;
    const directory = path.join(process.cwd(), "projects", slug);
    directories.push(directory);
    const withPhotos = index >= 5;
    const heritage = index === 10;
    let project = await post("/api/projects", {
      ...demo, slug, media: [], refs: [], brief: "", variantCount: 1,
      hosts: [{ name: "Александра-Екатерина" }, { name: "Константин-Александр" }],
      headline: "Наш очень долгожданный вечер с любимыми людьми",
      venue: { ...demo.venue, name: "Камерный загородный ресторан «Сад воспоминаний»", address: "Ташкент, длинная улица Цветущего весеннего сада, дом 24, павильон 3" },
      studioDesign: { templateId: heritage ? "heritage" : "editorial", paletteId: "auto" },
      rsvp: { enabled: true, mode: "form", target: `${base}/qa-composition-response`, askGuestCount: true },
    });
    const templateId = heritage ? "heritage" : "editorial";
    if (!recipeSeeds.has(templateId)) {
      project = await post("/api/generate", { slug, revision: project.revision, planRevision: project.planRevision, generationRevision: project.generationRevision, createVisual: false });
      assert.equal(project.generation.model, "authored-template-v1");
      recipeSeeds.set(templateId, project.concepts[0]);
    }
    const concept = structuredClone(recipeSeeds.get(templateId));
    const tokens = composition(index);
    const theme = { ...concept.theme, studioTemplate: { ...concept.theme.studioTemplate, composition: tokens } };
    // Fixture-only writing uses a fresh project and snapshot, never existing data.
    if (withPhotos) {
      const filename = `${randomUUID()}.webp`;
      await mkdir(path.join(directory, "media"), { recursive: true });
      await sharp({ create: { width: 1200, height: 1600, channels: 3, background: "#A88D78" } })
        .composite([{ input: Buffer.from('<svg width="1200" height="1600"><circle cx="600" cy="800" r="170" fill="#DFCBB0"/><path d="M0 1400L1200 350V1600H0" fill="#6E8071"/></svg>') }])
        .webp().toFile(path.join(directory, "media", filename));
      const content = project.content;
      content.media = ["cover", "detail-one", "detail-two", "protected"].map(id => ({ id, src: `/api/projects/${slug}/media/${filename}` }));
      await writeFile(path.join(directory, "content.json"), JSON.stringify(content, null, 2) + "\n");
      const assets = content.media.map(({ id }, assetIndex) => ({
        id, role: assetIndex === 0 ? "hero" : "gallery", subject: "detail", focal: [.5, .5],
        safeArea: assetIndex === 3 ? { x: 0, y: 0, w: 1, h: 1 } : { x: .45, y: .45, w: .1, h: .1 },
        allowedRatios: ["3:4"], treatment: "none", quality: "high", issues: [], maxViewportShare: 1,
        placement: { section: assetIndex === 0 ? "hero" : "greeting", index: assetIndex }, placementPinned: true,
      }));
      await writeFile(path.join(directory, "asset-plan.json"), JSON.stringify({ assets, unifiedTreatment: "none" }, null, 2) + "\n");
    }
    await mkdir(path.join(directory, "concepts", concept.id), { recursive: true });
    await writeFile(path.join(directory, "concepts", concept.id, "v2.json"), JSON.stringify(theme, null, 2) + "\n");
    fixtures.push({ index, slug, conceptId: concept.id, tokens, withPhotos, heritage, url: `${base}/preview/${slug}/${concept.id}/2?embed=1&guest=Алина` });
  }
  report.fixtureCount = fixtures.length;
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const fixture of fixtures) {
      await visit(fixture.url);
      const dimensions = await fit();
      assert(dimensions.document <= width && dimensions.overflow.length === 0, `Fixture ${fixture.index}@${width}: ${JSON.stringify(dimensions)}`);
      assert.equal(await page.locator("main.studio-template").count(), 1, "Parametric heritage uses the shared composition renderer");
      assert.equal(await page.locator(".studio-composition-opening").getAttribute("data-hero-layout"), fixture.tokens.heroLayout);
      assert.equal(await page.locator("main.studio-template").getAttribute("data-surface-style"), fixture.tokens.surfaceStyle);
      assert.equal(await page.locator("main.studio-template").getAttribute("data-spacing-scale"), fixture.tokens.spacingScale);
      assert.equal(await page.locator("main.studio-template").getAttribute("data-typography-accent"), fixture.tokens.typographyAccent);
      assert.equal(await page.locator('[data-studio-field="hosts.0.name"]').innerText(), "Александра-Екатерина");
      assert.equal(await page.locator('[data-studio-field="headline"]').count(), 1);
      assert.equal(await page.locator(".directed-photo").count(), fixture.withPhotos ? 4 : 0, "Every pinned photo appears once");
      if (fixture.withPhotos) {
        const protectedMount = page.locator('.directed-photo[data-photo-id="protected"]').locator("..");
        const safeShape = ["sharp", "polaroid"].includes(fixture.tokens.photoShape) ? fixture.tokens.photoShape : "sharp";
        assert.equal(await protectedMount.getAttribute("data-photo-shape"), safeShape, "Full-frame protected pixels survive silhouette selection");
      }
      report.responsive.push({ fixture: fixture.index, hero: fixture.tokens.heroLayout, withPhotos: fixture.withPhotos, heritage: fixture.heritage, ...dimensions });
      if (width === 390) {
        await page.screenshot({ path: path.join(output, `${fixture.index}-${fixture.tokens.heroLayout}-opening.png`) });
        await page.screenshot({ path: path.join(output, `${fixture.index}-${fixture.tokens.heroLayout}-complete.png`), fullPage: true });
      }
    }
  }
  report.checks.push("Five Hero compositions with and without photos, six photo masks, five surfaces and all section variants at 320/390/430px; long editable text and pinned photos appear once");
  for (const width of [880, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const fixture of fixtures.filter(item => [1, 7, 8].includes(item.index))) {
      await visit(fixture.url);
      const dimensions = await fit();
      assert(dimensions.document <= width && dimensions.overflow.length === 0, `Desktop fixture ${fixture.index}@${width}: ${JSON.stringify(dimensions)}`);
      report.responsive.push({ fixture: fixture.index, hero: fixture.tokens.heroLayout, withPhotos: fixture.withPhotos, desktop: true, ...dimensions });
      if (width === 1440 && fixture.index === 7) await page.screenshot({ path: path.join(output, "desktop-framed-arch.png"), fullPage: true });
    }
  }
  report.checks.push("Split, framed and poster layouts preserve text/control bounds at 880/1440px");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const fixture of fixtures.slice(0, 5)) {
    await visit(`${fixture.url}&studio=1`);
    await page.evaluate(() => {
      window.__compositionEdits = [];
      window.addEventListener("message", event => {
        if (event.origin === location.origin && event.data?.channel === "invitation-studio" && event.data.type === "edit") window.__compositionEdits.push(event.data);
      });
    });
    const headline = page.locator('[data-studio-field="headline"]');
    await headline.click();
    await headline.fill("Отредактированный живой заголовок");
    await headline.press("Escape");
    assert.equal(await headline.textContent(), "Отредактированный живой заголовок");
    const edits = await page.evaluate(() => window.__compositionEdits);
    assert(edits.some(edit => edit.field === "headline" && edit.text === "Отредактированный живой заголовок"), JSON.stringify(edits));
    if (fixture.index === 0) {
      const greeting = page.locator('[data-studio-field="greeting"]');
      await greeting.click();
      await greeting.fill("Первая строка\n\nВторая строка");
      await greeting.press("Escape");
      const multiline = await page.evaluate(() => window.__compositionEdits);
      assert(multiline.some(edit => edit.field === "greeting" && edit.text === "Первая строка\n\nВторая строка"), JSON.stringify(multiline));
      assert.equal(await greeting.locator("p").count(), 2, "Editing keeps paragraph breaks in React content");
    }
  }
  report.checks.push("All five Hero variants support real contenteditable text changes and send the editor's existing edit message");
  for (const fixture of fixtures.filter(item => item.index >= 5 && item.index <= 7)) {
    await visit(fixture.url);
    await page.locator("#guest-name").fill("Алина и Тимур");
    await page.getByRole("button", { name: /Продолжить/ }).click();
    await page.locator("input[name=attendance]").check();
    await page.locator("#guest-count").fill("3");
    await page.getByRole("button", { name: "Назад", exact: true }).click();
    assert.equal(await page.locator("#guest-name").inputValue(), "Алина и Тимур");
    await page.getByRole("button", { name: /Продолжить/ }).click();
    assert.equal(await page.locator("#guest-count").inputValue(), "3");
    const controls = await page.locator(".rsvp-form button:visible, .rsvp-form input:visible:not([type=checkbox]), .invitation-calendar summary").evaluateAll(elements => elements.map(element => ({ tag: element.tagName, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
    assert(controls.every(control => control.height >= 44 && control.width >= 44), JSON.stringify(controls));
    const calendar = page.locator(".invitation-calendar").first();
    await calendar.locator("summary").click();
    assert.equal(await calendar.getAttribute("open"), "");
    assert.match(await calendar.getByRole("link", { name: /Apple/ }).getAttribute("href"), /^data:text\/calendar/);
  }
  let submitted;
  await page.route(`${base}/qa-composition-response`, async route => {
    submitted = { method: route.request().method(), fields: Object.fromEntries(new URLSearchParams(route.request().postData())) };
    await route.fulfill({ status: 200, contentType: "text/html", body: "<html lang=ru><body>Ответ принят</body></html>" });
  });
  await page.getByRole("button", { name: /Подтвердить присутствие/ }).click();
  await page.waitForURL(`${base}/qa-composition-response`);
  assert.deepEqual(submitted, { method: "POST", fields: { name: "Алина и Тимур", attendance: "yes", guests: "3" } });
  report.checks.push("All three RSVP variants preserve step/back values and 44px controls; calendar opens with downloadable ICS; native POST reaches an intercepted local receiver");
  const noJs = await browser.newContext({ viewport: { width: 320, height: 844 }, javaScriptEnabled: false });
  const staticPage = await noJs.newPage();
  for (const fixture of fixtures.filter(item => item.index <= 5 || item.heritage)) {
    await visit(fixture.index === 5 ? fixture.url.replace("embed=1&", "") : fixture.url, staticPage);
    for (const selector of ["h1", "#venue", "#guest-name", "input[name=attendance]", "#guest-count"]) assert.equal(await staticPage.locator(selector).isVisible(), true, selector);
    if (fixture.index === 5) assert.equal(await staticPage.locator(".invitation-cover").isVisible(), false);
    assert.equal(await staticPage.evaluate(() => document.documentElement.scrollWidth), 320);
  }
  await noJs.close();
  report.checks.push("Each Hero and parametric heritage retain complete live content and usable native RSVP without JavaScript at 320px");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const animatedFixture = fixtures[5];
  await visit(animatedFixture.url.replace("embed=1&", ""));
  const cover = page.locator(".invitation-cover");
  await cover.locator(".cover-open").click();
  await cover.waitFor({ state: "hidden" });
  const photoMount = page.locator(".studio-composition-hero-media > .studio-template-hero-photos");
  const photoOffset = () => photoMount.evaluate(element => element.getBoundingClientRect().top - element.parentElement.getBoundingClientRect().top);
  const photoGeometry = () => photoMount.locator(".directed-photo").evaluate(figure => {
    const image = figure.querySelector("img");
    const rect = figure.getBoundingClientRect();
    return { width: rect.width, height: rect.height, crop: figure.dataset.crop, imageTransform: getComputedStyle(image).transform };
  });
  const originalGeometry = await photoGeometry();
  const beforeScroll = await photoOffset();
  await photoMount.evaluate(element => window.scrollBy({ top: element.getBoundingClientRect().top + 80, behavior: "instant" }));
  await page.waitForFunction(before => {
    const photo = document.querySelector(".studio-composition-hero-media > .studio-template-hero-photos");
    return Math.abs(photo.getBoundingClientRect().top - photo.parentElement.getBoundingClientRect().top - before) > 2;
  }, beforeScroll);
  assert(Math.abs(await photoOffset()) <= 9, "Hero photo drift stays within the cover spacing");
  assert.deepEqual(await photoGeometry(), originalGeometry, "Parallax preserves the directed crop and its dimensions");
  report.checks.push("Unfold opens once and the hero photo moves with scroll without changing its crop or dimensions");
  await page.locator("#venue").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("#venue").closest("[data-reveal]").dataset.reveal === "shown");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await photoMount.evaluate(element => getComputedStyle(element).translate), "none");
  assert.equal(await page.locator("#venue").evaluate(element => getComputedStyle(element.closest("[data-reveal]")).transform), "none");
  await visit(animatedFixture.url.replace("embed=1&", ""));
  assert.equal(await cover.isVisible(), false);
  report.checks.push("Section reveal becomes visible on scroll and respects reduced motion");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.externalRequests, []);
  await rm(path.join(output, "failure.png"), { force: true });
  await rm(path.join(output, "failure.json"), { force: true });
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ fixtureCount: report.fixtureCount, responsive: report.responsive.length, checks: report.checks, errors: report.errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(path.join(output, "failure.json"), JSON.stringify({ ...report, failure: String(error), url: page.url() }, null, 2) + "\n").catch(() => {});
  throw error;
} finally {
  await browser.close();
  for (const directory of directories) await rm(directory, { recursive: true, force: true });
}
