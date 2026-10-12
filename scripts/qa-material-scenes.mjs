import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { snapshot } from "../qa/snapshot.mjs";
import { overflow } from "../qa/checks/overflow.mjs";
import { clipping } from "../qa/checks/clipping.mjs";
import { collision } from "../qa/checks/collision.mjs";
import { fonts } from "../qa/checks/fonts.mjs";
import { perform } from "../qa/run.mjs";

// Explicit authored fixtures. No provider calls, client projects or invented AI output.
const { chromium } = await import(pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href);
const base = process.env.STUDIO_QA_URL || "http://127.0.0.1:3156";
const output = path.resolve(process.env.MATERIAL_QA_OUTPUT || "docs/material-scenes");
const slug = `qa-material-${randomUUID().slice(0, 8)}`;
const directory = path.resolve("projects", slug);
const demo = JSON.parse(await readFile("projects/demo/content.json", "utf8"));
const baseline = JSON.parse(await readFile("projects/demo/concepts/letter/v1.json", "utf8"));
const fixtures = [
  { id: "silk-suite", typeSet: "ceremony", materialSet: "paper", texture: "raw-silk", finish: "none", ambient: "none", palette: { bg: "#F0E8D9", surface: "#F7F0E4", ink: "#512C35", muted: "#5A4247", accent: "#743D4C", accentAlt: "#73495E" } },
  { id: "pressed-flower", typeSet: "poetic", materialSet: "paper", texture: "cotton-paper", finish: "blind-emboss", ambient: "petals", palette: { bg: "#F2EDE2", surface: "#EAE3D6", ink: "#293B2D", muted: "#3F5746", accent: "#536B4F", accentAlt: "#806F58" } },
  { id: "glass-garden", typeSet: "gallery", materialSet: "glass", texture: "smooth", finish: "none", ambient: "dust", palette: { bg: "#1D322C", surface: "#253F35", ink: "#F4F2E6", muted: "#BCCABA", accent: "#D7DCBE", accentAlt: "#8FA993" } },
];
const assets = Array.from({ length: 3 }, (_, i) => ({ id: randomUUID(), role: "gallery", subject: "landscape", focal: [.5, .5], safeArea: { x: 0, y: 0, w: 1, h: 1 }, allowedRatios: ["3:4"], treatment: "none", quality: i === 2 ? "low" : "usable", maxViewportShare: i === 2 ? .35 : .6, placement: { section: "greeting", index: i } }));
const report = { providerCalls: false, fixtures: "Original botanical material used as a bounded photo test fixture, not a customer portrait", samples: [], checks: {}, failures: [], errors: [], pixelQa: [] };
let browser;
async function saveContent(hosts = demo.hosts, locale = "ru") {
  await writeFile(path.join(directory, "content.json"), JSON.stringify({ ...demo, slug, locale, hosts, media: assets.map((asset) => ({ id: asset.id, src: `/api/projects/${slug}/media/${asset.id}.webp` })) }));
}
async function ready(page, fixture, width, embedded = true) {
  await page.setViewportSize({ width, height: 900 });
  const response = await page.goto(`${base}/preview/${slug}/${fixture.id}/1${embedded ? "?embed=1" : ""}`, { waitUntil: "networkidle" });
  assert(response?.ok(), `Preview failed: ${response?.status()}`);
  await page.locator("main.invitation").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const height = await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; return document.documentElement.scrollHeight; });
  // Driver-side waits also work with script execution disabled. A page RAF
  // callback cannot be used to await painting in the no-JavaScript scenario.
  for (let y = 0; y < height; y += 700) { await page.evaluate(y => scrollTo({ top: y, behavior: "instant" }), y); await page.waitForTimeout(35); }
  await page.waitForTimeout(200);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
}
async function check(page, fixture, width, mode) {
  console.log(`${mode}: ${fixture.id} at ${width}px`);
  await ready(page, fixture, width);
  const data = await snapshot(page, assets);
  const checks = [overflow(data), clipping(data), collision(data), fonts(data)];
  const failed = checks.filter(check => ["error", "fail"].includes(check.status));
  if (data.scrollWidth > width + 1 || data.photos.length !== 3 || data.photos.some(photo => !photo.protected)) failed.push({ id: "photo/width", width: data.scrollWidth, photos: data.photos });
  assert.equal(await page.locator("#hero-title").count(), 1);
  assert.equal(await page.locator("[data-photo-id]").count(), 3);
  report.samples.push({ scene: fixture.id, width, mode, checks: checks.map(({ id, status }) => ({ id, status })) });
  if (failed.length) report.failures.push({ scene: fixture.id, width, mode, failed });
  if (mode === "standard" && [390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${fixture.id}-${width}.jpg`), type: "jpeg", quality: 85, fullPage: true });
}
try {
  await mkdir(output, { recursive: true }); await mkdir(path.join(directory, "media"), { recursive: true });
  await saveContent();
  await writeFile(path.join(directory, "asset-plan.json"), JSON.stringify({ assets, unifiedTreatment: "none" }));
  for (let i = 0; i < assets.length; i++) await sharp("public/artwork/material-scenes/garden-v1.webp").resize(i === 2 ? 300 : 960).webp().toFile(path.join(directory, "media", `${assets[i].id}.webp`));
  for (const fixture of fixtures) {
    await mkdir(path.join(directory, "concepts", fixture.id), { recursive: true });
    await writeFile(path.join(directory, "concepts", fixture.id, "v1.json"), JSON.stringify({ ...baseline, meta: { name: fixture.id, mood: ["материал"], rationale: "Авторский проверочный образец, не AI-генерация." }, artwork: "none", palette: fixture.palette, typeSet: fixture.typeSet, materialSet: fixture.materialSet, surface: { texture: fixture.texture, borderStyle: "blind-deboss" }, atmosphere: { grainIntensity: .025, vignetteStrength: 0 }, finishing: { type: fixture.finish, sheenAngle: 135 }, typographyScale: { displayScale: "editorial", headlineTracking: "-.025em", metaTracking: ".12em" }, foil: { enabled: false, color: fixture.palette.accent }, ornament: { pack: fixture.id === "pressed-flower" ? "botanical-engraving" : "none", density: "light", color: "accent", placement: fixture.id === "pressed-flower" ? ["watermark"] : [] }, layout: { ...baseline.layout, preset: "card-stack", composition: fixture.id, hero: "typographic", sectionOrder: ["hero", "greeting", "venue", "timeline", "dressCode", "countdown", "rsvp", "footer"] }, motion: { preset: fixture.id === "silk-suite" ? "unfold" : "drift", ambient: fixture.ambient }, photos: assets.map(asset => ({ id: asset.id, section: "greeting", index: asset.placement.index, position: "after" })) }));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROME_EXECUTABLE });
  const page = await browser.newPage({ reducedMotion: "reduce" }); page.on("pageerror", error => report.errors.push(error.message));
  for (const fixture of fixtures) for (const width of [320, 390, 1024, 1440]) await check(page, fixture, width, "standard");
  await saveContent([{ name: "Екатерина-Александра" }, { name: "Константин-Владислав" }]);
  for (const fixture of fixtures) for (const width of [320, 390, 1024, 1440]) await check(page, fixture, width, "long-names");
  await saveContent();
  const noJs = await browser.newPage({ javaScriptEnabled: false, reducedMotion: "reduce" });
  for (const fixture of fixtures) await check(noJs, fixture, 390, "no-js");
  report.checks.noJsReadable = true;
  const animated = await browser.newPage({ reducedMotion: "no-preference" }); animated.on("pageerror", error => report.errors.push(error.message));
  await ready(animated, fixtures[0], 390, false);
  await animated.locator("dialog[open]").waitFor();
  await animated.getByRole("button", { name: "Открыть приглашение" }).click();
  await animated.waitForFunction(() => !document.querySelector("dialog").open);
  await animated.locator(".deck-controls").scrollIntoViewIfNeeded();
  assert.match(await animated.locator(".deck-controls").innerText(), /1 \/ 3/);
  await animated.getByRole("button", { name: "Следующее фото" }).click();
  assert.match(await animated.locator(".deck-controls").innerText(), /2 \/ 3/);
  await animated.getByRole("button", { name: "Предыдущее фото" }).click();
  assert.match(await animated.locator(".deck-controls").innerText(), /1 \/ 3/);
  assert.equal(await animated.locator(".deck-card[inert]").count(), 2);
  assert.equal(await animated.locator("[data-photo-id]").count(), 3);
  report.checks.photoDeckPerspective = await animated.locator(".deck-card").nth(1).evaluate(e => getComputedStyle(e).transform.includes("matrix3d"));
  report.checks.envelopeOpening = report.checks.albumButtons = report.checks.noDuplicatePhotos = true;
  await animated.emulateMedia({ reducedMotion: "reduce" });
  await animated.waitForFunction(() => !document.querySelector(".deck-track").dataset.enhanced);
  assert.equal(await animated.evaluate(() => document.getAnimations().filter(a=>a.playState === "running").length), 0);
  report.checks.dynamicReducedMotion = true;
  await ready(animated, fixtures[2], 1440);
  await animated.emulateMedia({ reducedMotion: "no-preference" });
  await animated.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  assert.equal(await animated.locator(".material-atmosphere").getAttribute("data-paused"), "true");
  report.checks.hiddenDocumentPausesAmbient = true;
  await animated.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  if (process.env.MATERIAL_QA_PIXELS === "1") for (const fixture of fixtures) {
    const result = await perform({ url: `${base}/preview/${slug}/${fixture.id}/1?embed=1`, assets, output: path.join(output, `pixels-${fixture.id}`) });
    report.pixelQa.push({ scene: fixture.id, checks: result.checks });
    const failures = result.checks.filter(check => ["error", "fail"].includes(check.status));
    if (failures.length) report.failures.push({ scene: fixture.id, mode: "pixels", failures });
  }
  console.log(JSON.stringify({ samples: report.samples.length, checks: report.checks, failures: report.failures.map(f => ({ scene: f.scene, width: f.width, mode: f.mode, checks: (f.failed ?? f.failures).map(c => c.id) })), errors: report.errors }, null, 2));
  assert.equal(report.failures.length, 0, "Material QA failed; see docs/material-scenes/report.json"); assert.deepEqual(report.errors, []);
} finally {
  await mkdir(output, { recursive: true }); await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser?.close(); await rm(directory, { recursive: true, force: true });
}
