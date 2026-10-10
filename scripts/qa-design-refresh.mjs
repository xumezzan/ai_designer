import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { snapshot } from "../qa/snapshot.mjs";
import { collision } from "../qa/checks/collision.mjs";
import { clipping } from "../qa/checks/clipping.mjs";
import { fonts } from "../qa/checks/fonts.mjs";
import { tap } from "../qa/checks/tap.mjs";
import { contrast } from "../qa/checks/contrast.mjs";

const { chromium } = await import(pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href);
const base = process.env.STUDIO_QA_URL || "http://127.0.0.1:3147";
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROME_EXECUTABLE });
const output = path.join(process.cwd(), "docs/design-refresh");
const interactionsOnly = process.env.STUDIO_QA_INTERACTIONS_ONLY === "1";
const slug = `qa-design-${randomUUID().slice(0, 8)}`;
const fixture = path.join(process.cwd(), "projects", slug);
const report = { samples: [], checks: {}, errors: [], failures: [] };
const demo = JSON.parse(await readFile("projects/demo/content.json", "utf8"));
const theme = JSON.parse(await readFile("projects/demo/concepts/folio/v1.json", "utf8"));
await mkdir(output, { recursive: true });
await mkdir(path.join(fixture, "concepts/folio"), { recursive: true });
await writeFile(path.join(fixture, "content.json"), JSON.stringify({ ...demo, slug, rsvp: { mode: "form", target: `${base}/qa-receiver`, askGuestCount: true } }));
await writeFile(path.join(fixture, "asset-plan.json"), JSON.stringify({ assets: [], unifiedTreatment: "none" }));
await writeFile(path.join(fixture, "concepts/folio/v1.json"), JSON.stringify(theme));
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.clock.setFixedTime(Date.now());
  page.on("pageerror", (error) => report.errors.push({ url: page.url(), message: error.message }));
  const demos = ["letter/1", "poster/1", "folio/1", "arch/2", "botanical/1"].map((concept) => ({ route: `demo/${concept}`, name: concept.split("/")[0], widths: [320, 390, 768, 1024, 1440] }));
  const generated = [];
  if (process.env.STUDIO_QA_ART_SLUG) {
    assert.match(process.env.STUDIO_QA_ART_SLUG, /^qa-fidelity-[a-f0-9]{8}$/);
    for (const concept of await readdir(`projects/${process.env.STUDIO_QA_ART_SLUG}/concepts`)) {
      const versions = (await readdir(`projects/${process.env.STUDIO_QA_ART_SLUG}/concepts/${concept}`)).flatMap((file) => /^v(\d+)\.json$/.exec(file)?.[1] || []);
      const version = Math.max(...versions.map(Number));
      generated.push({ route: `${process.env.STUDIO_QA_ART_SLUG}/${concept}/${version}`, name: concept, widths: [390, 1024, 1440] });
    }
  }
  for (const item of interactionsOnly ? [] : [...demos, ...generated]) for (const width of item.widths) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(`${base}/preview/${item.route}?embed=1`, { waitUntil: "networkidle" });
    assert(response.ok(), `${item.route}: HTTP ${response.status()}`);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())); });
    const data = await snapshot(page, []);
    const results = [collision(data), clipping(data), fonts(data), tap(data)];
    if (demos.includes(item) && [390, 1440].includes(width)) {
      const png = await page.screenshot({ fullPage: true });
      const maskStyle = await page.addStyleTag({ content: [...new Set(data.fragments.map((box) => box.selector))].map((selector) => `main.invitation ${selector} { color: #ff00ff !important; -webkit-text-fill-color: #ff00ff !important; background-image: none !important; }`).join("\n") });
      const mask = await page.screenshot({ fullPage: true });
      await maskStyle.evaluate((element) => element.remove());
      results.push(await contrast(data, png, mask));
      if (["letter", "folio", "arch"].includes(item.name)) await page.screenshot({ path: path.join(output, `after-${item.name}-${width}.jpg`), type: "jpeg", quality: 85, fullPage: true });
    }
    if (generated[0] === item && [390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `generated-${width}.jpg`), type: "jpeg", quality: 85, fullPage: true });
    const failures = results.filter((check) => ["error", "fail"].includes(check.status));
    if (data.scrollWidth > width || data.animations) failures.push({ id: "geometry/motion", findings: [{ scrollWidth: data.scrollWidth, animations: data.animations }] });
    report.samples.push({ route: item.route, width, checks: results.map(({ id, status }) => ({ id, status })) });
    if (failures.length) report.failures.push({ route: item.route, width, checks: failures });
  }

  await page.goto(`${base}/preview/demo/letter/1?embed=1&to=${encodeURIComponent("Александр")}`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("#greeting-title").textContent(), "Александр");
  await page.locator('.dress-fabric').nth(2).click();
  assert.equal(await page.locator('.dress-fabric').nth(2).getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator('.dress-fabric[aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('.dress-preview').evaluate((element) => element.style.getPropertyValue('--swatch')), demo.dressCode.swatches[2]);
  await page.locator('.invitation-calendar summary').click();
  assert(await page.locator('.calendar-options a').first().isVisible());
  const google = new URL(await page.locator('.calendar-options a').first().getAttribute('href'));
  assert.equal(google.searchParams.get('dates'), '20270424T120000Z/20270424T120000Z');
  report.checks.personalization = report.checks.palette = report.checks.calendar = true;
  await page.goto(`${base}/preview/demo/folio/1`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('dialog').evaluate((dialog) => dialog.open), false);
  assert.equal(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length), 0);
  report.checks.reducedMotion = true;

  let submitted;
  await page.route('**/qa-receiver', async (route) => { submitted = route.request().postData(); await route.fulfill({ contentType: 'text/html', body: '<p>Test receiver</p>' }); });
  await page.goto(`${base}/preview/${slug}/folio/1?embed=1&guest=${encodeURIComponent("Алина")}`, { waitUntil: 'networkidle' });
  const form = page.locator('.rsvp-form');
  const formData = await snapshot(page, []);
  for (const result of [tap(formData), clipping(formData), collision(formData)]) if (["error", "fail"].includes(result.status)) report.failures.push({ route: `${slug}/folio/1`, width: 1440, checks: [result] });
  await form.getByRole('button', { name: 'Продолжить' }).click();
  assert(await form.getByRole('checkbox', { name: 'Я приду' }).isVisible());
  await form.getByRole('button', { name: 'Назад', exact: true }).click();
  await form.locator('#guest-name').fill('');
  await form.getByRole('button', { name: 'Продолжить' }).click();
  assert(await form.locator('#guest-name').isVisible());
  await form.locator('#guest-name').fill('Алина');
  await form.getByRole('button', { name: 'Продолжить' }).click();
  await form.getByRole('checkbox', { name: 'Я приду' }).check();
  await form.locator('#guest-count').fill('2');
  await Promise.all([page.waitForURL('**/qa-receiver'), form.getByRole('button', { name: 'Подтвердить присутствие' }).click()]);
  const params = new URLSearchParams(submitted);
  assert.equal(params.get('name'), 'Алина'); assert.equal(params.get('attendance'), 'yes'); assert.equal(params.get('guests'), '2');
  report.checks.nativeFormPost = true;

  const animated = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', isMobile: true, hasTouch: true });
  animated.on('pageerror', (error) => report.errors.push({ url: animated.url(), message: error.message }));
  await animated.goto(`${base}/preview/demo/folio/1?to=${encodeURIComponent('Александр')}`, { waitUntil: 'networkidle' });
  await animated.locator('dialog[open]').waitFor();
  assert(await animated.getByRole('button', { name: 'Открыть приглашение' }).evaluate((element) => element === document.activeElement));
  await animated.screenshot({ path: path.join(output, 'envelope-390.jpg'), type: 'jpeg', quality: 85 });
  await animated.getByRole('button', { name: 'Открыть приглашение' }).click();
  await animated.waitForFunction(() => !document.querySelector('dialog').open);
  assert.notEqual(await animated.evaluate(() => document.body.style.overflow), 'hidden');
  for (const section of await animated.locator('.section-reveal').all()) {
    await section.scrollIntoViewIfNeeded();
    await section.evaluate((element) => new Promise((resolve) => { const check = () => element.dataset.reveal === 'shown' ? resolve() : requestAnimationFrame(check); check(); }));
  }
  report.checks.envelope = report.checks.scrollReveals = true;
  await animated.goto(`${base}/preview/demo/folio/1`, { waitUntil: 'networkidle' });
  await animated.locator('dialog[open]').waitFor();
  const touch = await animated.context().newCDPSession(animated);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 540 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 460 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await animated.waitForFunction(() => !document.querySelector('dialog').open);
  report.checks.swipe = true;
  await animated.goto(`${base}/preview/demo/folio/1`, { waitUntil: 'networkidle' });
  await animated.locator('dialog[open]').waitFor();
  await animated.keyboard.press('Escape');
  await animated.waitForFunction(() => !document.querySelector('dialog').open);
  await animated.goto(`${base}/preview/demo/folio/1?embed=1`, { waitUntil: 'networkidle' });
  assert.equal(await animated.locator('dialog').evaluate((dialog) => dialog.open), false);
  report.checks.escape = report.checks.embedBypass = true;
  await animated.setViewportSize({ width: 844, height: 390 });
  await animated.goto(`${base}/preview/demo/folio/1`, { waitUntil: 'networkidle' });
  await animated.locator('dialog[open]').waitFor();
  await animated.getByRole('button', { name: 'Открыть приглашение' }).click();
  await animated.waitForFunction(() => !document.querySelector('dialog').open);
  report.checks.landscapeEnvelope = true;

  const noJs = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  await noJs.goto(`${base}/preview/${slug}/folio/1`, { waitUntil: 'networkidle' });
  assert(await noJs.locator('#hero-title').isVisible());
  assert(await noJs.locator('#guest-name').isVisible());
  assert(await noJs.getByRole('checkbox', { name: 'Я приду' }).isVisible());
  assert(await noJs.locator('#guest-count').isVisible());
  report.checks.noJsFallback = true;
  console.log(JSON.stringify({ samples: report.samples.length, failures: report.failures, errors: report.errors, checks: report.checks }, null, 2));
  assert.equal(report.failures.length, 0, 'Mechanical visual QA failed');
  assert.equal(report.errors.length, 0, 'Browser errors');
} finally {
  await writeFile(path.join(output, interactionsOnly ? 'report-interactions.json' : 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  await rm(fixture, { recursive: true, force: true });
}
