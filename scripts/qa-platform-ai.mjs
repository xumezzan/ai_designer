import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Read-only browser QA against an already generated, fictional local invitation.
// This script never calls the generation endpoint or creates a paid request.
const base = process.env.PLATFORM_QA_BASE_URL;
const slug = process.env.PLATFORM_QA_SLUG;
assert.ok(base && ["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Use an isolated local server");
assert.match(slug || "", /^invite-[a-f0-9]{24}$/);
assert.ok(process.env.QA_PLAYWRIGHT_MODULE, "Set QA_PLAYWRIGHT_MODULE to the installed Playwright entrypoint");
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME_EXECUTABLE, headless: true, args: ["--no-sandbox"] });
const directory = path.resolve("docs/platform-qa/atelier-local");
await mkdir(directory, { recursive: true });
const errors = [];
const checks = [];
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 430, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const response = await page.goto(`${base}/i/${slug}`, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    const state = await page.evaluate(() => {
      const hero = document.querySelector(".sg-hero");
      const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        artworkInsideHero: Boolean(hero.querySelector(".sg-hero-art img")),
        artworkUrls: [...hero.querySelectorAll("img")].map((image) => new URL(image.currentSrc).pathname),
        transform: getComputedStyle(hero).transform,
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
        sections: [...document.querySelectorAll("[data-section]")].map((section) => section.dataset.section),
        headings: [...document.querySelectorAll("h1,h2")].map((heading) => heading.textContent),
      };
    });
    assert.equal(state.scrollWidth, width, "Horizontal overflow");
    assert.equal(state.artworkInsideHero, true);
    assert.equal(state.transform, "none", "Invitation must be a website viewport");
    assert.deepEqual(state.duplicateIds, []);
    assert.ok(state.artworkUrls.every((url) => url.startsWith("/api/platform/media/")), "Generated artwork must remain in the invitation on all widths");
    assert.ok(state.sections.includes("venue") && state.sections.includes("rsvp"));
    checks.push(state);
    if (width === 390 || width === 1280) await page.screenshot({ path: path.join(directory, `generated-${width}.png`), fullPage: width === 390 });
  }
  const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJs = await noJsContext.newPage();
  assert.equal((await noJs.goto(`${base}/i/${slug}`, { waitUntil: "networkidle" })).status(), 200);
  assert.match(await noJs.locator("h1").innerText(), /София/);
  assert.equal(await noJs.locator('form[action$="/rsvp"]').count(), 1);
  assert.equal(errors.length, 0);
  const report = { generatedAt: new Date().toISOString(), base, slug, paidCalls: 0, checks, noJavaScriptReadable: true, pageErrors: errors };
  await writeFile(path.join(directory, "browser-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ widths: checks.map((check) => check.width), noJavaScriptReadable: true, pageErrors: errors, paidCalls: 0 }));
} finally {
  await browser.close();
}
