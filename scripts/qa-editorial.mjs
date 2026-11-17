import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.STUDIO_PLAYWRIGHT_MODULE).href);
const base = process.env.STUDIO_QA_URL ?? "http://127.0.0.1:3149";
const directory = path.join(process.cwd(), "docs/editorial-spec");
const slug = `qa-editorial-${randomUUID().slice(0, 8)}`;
const fixture = path.join(process.cwd(), "projects", slug);
const browser = await chromium.launch({ headless: true, executablePath: process.env.STUDIO_CHROME });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", isMobile: true, hasTouch: true });
const page = await context.newPage();
const report = { responsive: [], checks: [], errors: [], externalRequests: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("request", (request) => { if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(request.url()).hostname)) report.externalRequests.push(request.url()); });
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const preview = (component, extra = "") => `${base}/preview/${slug}/${component}/1?embed=1${extra}`;
const fit = () => page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("h1,h2,input,button,address")].filter((element) => element.checkVisibility() && !element.closest(".timeline-list") && (element.getBoundingClientRect().right > innerWidth + 1 || element.getBoundingClientRect().left < -1)).map((element) => element.tagName + "." + element.className) }));

try {
  await mkdir(directory, { recursive: true });
  const content = await json("projects/demo/content.json");
  const oldTheme = await json("projects/demo/concepts/letter/v2.json");
  const examples = await json("lib/design/fixtures.json");
  const plan = await json("projects/demo/asset-plan.json");
  await mkdir(fixture, { recursive: true });
  await writeFile(path.join(fixture, "content.json"), JSON.stringify({ ...content, slug, rsvp: { enabled: true, mode: "form", target: `${base}/qa-editorial-response`, askGuestCount: true, deadline: "2027-04-01" } }));
  await writeFile(path.join(fixture, "asset-plan.json"), JSON.stringify(plan));
  for (const [component, spec] of Object.entries(examples)) {
    const canvas = spec.canvas;
    const theme = { ...oldTheme, designSpec: spec, meta: { ...oldTheme.meta, name: spec.design_title }, typeSet: "editorial", layout: { ...oldTheme.layout, composition: component },
      palette: { bg: canvas.background_color, surface: canvas.background_color, ink: canvas.text_color_primary, muted: canvas.text_color_muted, accent: canvas.accent_color, accentAlt: canvas.accent_color } };
    await mkdir(path.join(fixture, "concepts", component), { recursive: true });
    await writeFile(path.join(fixture, "concepts", component, "v1.json"), JSON.stringify(theme));
  }

  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [component, spec] of Object.entries(examples)) {
      await page.goto(`${base}/editorial/${component}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const result = await fit();
      assert(result.scroll <= width, `${component}: page overflow at ${width}: ${JSON.stringify(result)}`);
      assert.deepEqual(result.overflow, [], `${component}: controls/text overflow at ${width}`);
      const actual = await page.locator("main").evaluate((element) => ({ archetype: element.dataset.designArchetype, font: getComputedStyle(element.querySelector("h1")).fontFamily, grain: getComputedStyle(element.querySelector(".editorial-paper-grain")).opacity, pointer: getComputedStyle(element.querySelector(".editorial-paper-grain")).pointerEvents, italic: element.querySelectorAll(".editorial-italic-accent").length }));
      assert.equal(actual.archetype, spec.archetype);
      assert(actual.font.includes(spec.typography.heading_font));
      assert.equal(Number(actual.grain), spec.canvas.noise_opacity);
      assert.equal(actual.pointer, "none");
      assert(actual.italic > 0);
      report.responsive.push({ component, width, document: result.scroll });
      if (width === 390) {
        await page.screenshot({ path: path.join(directory, `${component}-opening.png`) });
        await page.screenshot({ path: path.join(directory, `${component}-complete.png`), fullPage: true });
      }
    }
  }
  report.checks.push("Five independent native editorial compositions at 320, 390 and 430px; local fonts, declared grain and italic accents");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const component of Object.keys(examples)) {
    await page.goto(preview(component, "&guest=Алина"), { waitUntil: "networkidle" });
    await page.locator(".dress-fabric").nth(2).click();
    assert.equal(await page.locator(".dress-fabric").nth(2).getAttribute("aria-pressed"), "true");
    await page.locator(".invitation-calendar summary").click();
    assert((await page.locator('.calendar-options a[download]').getAttribute("href")).startsWith("data:text/calendar"));
    const name = page.locator("#guest-name");
    assert.equal(await name.inputValue(), "Алина");
    await name.fill("Алина и Тимур");
    await page.getByRole("button", { name: /Продолжить/ }).click();
    await page.locator('input[name="attendance"]').check();
    await page.locator("#guest-count").fill("3");
    await page.getByRole("button", { name: "Назад", exact: true }).click();
    assert.equal(await name.inputValue(), "Алина и Тимур");
    await page.getByRole("button", { name: /Продолжить/ }).click();
    assert.equal(await page.locator("#guest-count").inputValue(), "3");
    await page.locator("#rsvp").screenshot({ path: path.join(directory, `${component}-rsvp.png`) });
    let submitted;
    await page.route(`${base}/qa-editorial-response`, async (route) => {
      submitted = { method: route.request().method(), data: Object.fromEntries(new URLSearchParams(route.request().postData())) };
      await route.fulfill({ status: 200, contentType: "text/html", body: "<html lang=ru><body>Ответ принят</body></html>" });
    });
    await page.getByRole("button", { name: /Подтвердить присутствие/ }).click();
    await page.waitForURL(`${base}/qa-editorial-response`);
    assert.deepEqual(submitted, { method: "POST", data: { name: "Алина и Тимур", attendance: "yes", guests: "3" } });
    await page.unroute(`${base}/qa-editorial-response`);
  }
  report.checks.push("All five keep swatches, calendar downloads, personalized name, RSVP steps/back values and unchanged native POST (locally intercepted)");
  const staticContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  const staticPage = await staticContext.newPage();
  for (const component of Object.keys(examples)) {
    await staticPage.goto(preview(component));
    for (const selector of ["h1", "#greeting", "#timeline", "#guest-name", 'input[name="attendance"]', "#guest-count"]) assert.equal(await staticPage.locator(selector).isVisible(), true, `${component}: no-JS ${selector}`);
  }
  await staticContext.close();
  report.checks.push("Complete content and native form remain visible without JavaScript");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(preview("arch"), { waitUntil: "networkidle" });
  await page.locator("#timeline").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("#timeline").closest("[data-reveal]").dataset.reveal === "shown");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator("#timeline").evaluate((element) => getComputedStyle(element.closest("[data-reveal]")).transform), "none");
  report.checks.push("Soft reveal and reduced-motion fallback");
  for (const component of Object.keys(examples)) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/editorial/${component}`, { waitUntil: "networkidle" });
    assert.deepEqual((await fit()).overflow, []);
    await page.screenshot({ path: path.join(directory, `${component}-desktop.png`), fullPage: true });
  }
  report.checks.push("Desktop enhancement at 1440px");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.externalRequests, []);
  await writeFile(path.join(directory, "qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); await rm(fixture, { recursive: true, force: true }); }
