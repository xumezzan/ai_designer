import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.env.STUDIO_PLAYWRIGHT_MODULE).href);
const base = process.env.STUDIO_QA_URL ?? "http://127.0.0.1:3149";
const destination = path.join(process.cwd(), "docs/organic-paper");
const slug = `qa-paper-${randomUUID().slice(0, 8)}`;
const fixture = path.join(process.cwd(), "projects", slug);
const browser = await chromium.launch({ headless: true, executablePath: process.env.STUDIO_CHROME });
const report = { checks: [], widths: [], errors: [], externalRequests: [] };
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("request", (request) => { if (!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)) report.externalRequests.push(request.url()); });
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const preview = (project, concept = "letter", version = 1, query = "embed=1") => `${base}/preview/${project}/${concept}/${version}?${query}`;
const fit = async () => page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("h1, h2, input, button, address, .timeline-list")].filter((element) => element.checkVisibility() && (element.getBoundingClientRect().right > innerWidth + 1 || element.getBoundingClientRect().left < -1)).map((element) => element.tagName + "." + element.className) }));

try {
  await mkdir(destination, { recursive: true });
  const content = await json("projects/demo/content.json");
  const theme = await json("projects/demo/concepts/letter/v2.json");
  const plan = await json("projects/demo/asset-plan.json");
  await mkdir(path.join(fixture, "concepts/letter"), { recursive: true });
  await writeFile(path.join(fixture, "content.json"), JSON.stringify({ ...content, slug, rsvp: { enabled: true, mode: "form", target: `${base}/qa-rsvp`, askGuestCount: true, deadline: "2027-04-01" } }));
  await writeFile(path.join(fixture, "asset-plan.json"), JSON.stringify(plan));
  await writeFile(path.join(fixture, "concepts/letter/v1.json"), JSON.stringify({ ...theme, motion: { preset: "unfold", ambient: "none" } }));

  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [concept, version] of [["letter", 2], ["letter", 1], ["poster", 1], ["folio", 1], ["arch", 1], ["botanical", 1]]) {
      await page.goto(preview("demo", concept, version), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const result = await fit();
      assert(result.document <= width, `${concept}: document overflow at ${width}`);
      assert.deepEqual(result.overflow, [], `${concept}: content overflow at ${width}`);
      const organic = await page.locator("main.invitation").evaluate((element) => element.classList.contains("organic-paper"));
      assert.equal(organic, concept === "letter" && version === 2, "Organic Paper must not restyle unrelated designs");
      report.widths.push({ width, concept, version, document: result.document });
      if (width === 390) {
        await page.screenshot({ path: path.join(destination, `${concept}-${version}-opening.png`) });
        await page.screenshot({ path: path.join(destination, `${concept}-${version}-complete.png`), fullPage: true });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  report.checks.push("Organic Paper remains one explicit design; five other compositions retain their own rendering");
  await page.goto(preview("demo", "letter", 2), { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(destination, "mobile-opening.png") });
  await page.screenshot({ path: path.join(destination, "mobile-complete.png"), fullPage: true });
  const styles = await page.evaluate(() => ({ heading: getComputedStyle(document.querySelector("h1")).fontFamily, body: getComputedStyle(document.querySelector(".greeting-copy p")).fontFamily, texture: getComputedStyle(document.querySelector(".surface-frame"), "::before").opacity }));
  assert(styles.heading.includes("Cormorant Garamond"));
  assert(styles.body.includes("Montserrat"));
  assert.equal(styles.texture, "0.05");
  report.checks.push("Local display/body fonts and 5% non-interactive paper texture");

  await page.locator(".dress-fabric").nth(2).click();
  assert.equal(await page.locator(".dress-fabric").nth(2).getAttribute("aria-pressed"), "true");
  assert((await page.locator(".dress-preview").textContent()).includes("Какао"));
  await page.locator(".invitation-calendar summary").click();
  assert.equal(await page.locator(".invitation-calendar").getAttribute("open"), "");
  assert((await page.locator('.calendar-options a[download]').getAttribute("href")).startsWith("data:text/calendar"));
  report.checks.push("Swatch selection, live outfit preview and native calendar download");

  await page.goto(preview(slug, "letter", 1, "embed=1&guest=Алина"), { waitUntil: "networkidle" });
  const name = page.locator("#guest-name");
  const attendance = page.locator('input[name="attendance"]');
  assert.equal(await name.inputValue(), "Алина");
  await name.fill("");
  await page.getByRole("button", { name: /Продолжить/ }).click();
  assert.equal(await name.isVisible(), true);
  await name.fill("Алина и Тимур");
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await attendance.waitFor({ state: "visible" });
  assert.equal(await attendance.evaluate((element) => element === document.activeElement), true);
  await attendance.check();
  await page.locator("#guest-count").fill("3");
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  assert.equal(await name.inputValue(), "Алина и Тимур");
  await page.getByRole("button", { name: /Продолжить/ }).click();
  assert.equal(await attendance.isChecked(), true);
  assert.equal(await page.locator("#guest-count").inputValue(), "3");
  await page.locator("#rsvp").screenshot({ path: path.join(destination, "mobile-rsvp.png") });
  let submitted;
  await page.route(`${base}/qa-rsvp`, async (route) => {
    submitted = { method: route.request().method(), data: Object.fromEntries(new URLSearchParams(route.request().postData())) };
    await route.fulfill({ status: 200, contentType: "text/html", body: "<html lang=ru><body>Ответ принят</body></html>" });
  });
  await page.getByRole("button", { name: /Подтвердить присутствие/ }).click();
  await page.waitForURL(`${base}/qa-rsvp`);
  assert.deepEqual(submitted, { method: "POST", data: { name: "Алина и Тимур", attendance: "yes", guests: "3" } });
  report.checks.push("RSVP required name, focus, back navigation, retained values and native POST payload (intercepted locally)");

  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  const staticPage = await noJs.newPage();
  await staticPage.goto(preview(slug));
  assert.equal(await staticPage.locator("#guest-name").isVisible(), true);
  assert.equal(await staticPage.locator('input[name="attendance"]').isVisible(), true);
  assert.equal(await staticPage.locator("#guest-count").isVisible(), true);
  assert.equal(await staticPage.locator("#greeting").isVisible(), true);
  await noJs.close();
  report.checks.push("Complete readable content and native RSVP without JavaScript");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(preview(slug, "letter", 1, "guest=Алина"), { waitUntil: "networkidle" });
  await page.locator(".invitation-cover").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /Открыть приглашение/ }).click();
  await page.locator(".invitation-cover").waitFor({ state: "hidden" });
  await page.locator("#timeline").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("#timeline").closest("[data-reveal]").dataset.reveal === "shown");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator("#timeline").evaluate((element) => getComputedStyle(element.closest("[data-reveal]")).transform), "none");
  report.checks.push("Envelope opening, one-time scroll reveal and reduced-motion fallback");

  await page.goto(preview("demo", "letter", 2), { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.deepEqual((await fit()).overflow, []);
  await page.screenshot({ path: path.join(destination, "desktop-complete.png"), fullPage: true });
  report.checks.push("Desktop layout at 1440px");
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.errors, []);
  await writeFile(path.join(destination, "qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ checks: report.checks, responsiveCases: report.widths.length, errors: report.errors }, null, 2));
} finally {
  await browser.close();
  await rm(fixture, { recursive: true, force: true });
}
