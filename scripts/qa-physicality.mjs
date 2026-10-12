import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { snapshot } from "../qa/snapshot.mjs";
import { overflow } from "../qa/checks/overflow.mjs";
import { clipping } from "../qa/checks/clipping.mjs";
import { collision } from "../qa/checks/collision.mjs";
import { fonts } from "../qa/checks/fonts.mjs";

const { chromium } = process.env.QA_PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href) : await import("playwright");
const base = process.env.STUDIO_QA_URL || "http://127.0.0.1:3151";
const output = path.join(process.cwd(), "docs/physicality");
const slug = `qa-physicality-${randomUUID().slice(0, 8)}`;
const directory = path.join(process.cwd(), "projects", slug);
const report = { samples: [], failures: [], errors: [], checks: {} };
const demo = JSON.parse(await readFile("projects/demo/content.json", "utf8"));
const legacy = JSON.parse(await readFile("projects/demo/concepts/letter/v1.json", "utf8"));
const directions = [
  { id: "letter", name: "Desert Stone & Raw Silk", palette: { bg: "#E9EDE9", surface: "#DDE3DD", ink: "#242E2C", muted: "#53655F", accent: "#54665F", accentAlt: "#6E6F59" }, texture: "raw-silk", border: "blind-deboss", finish: "blind-emboss", scale: "editorial", motion: "drift" },
  { id: "poster", name: "Imperial Heritage", palette: { bg: "#111C34", surface: "#1C2A46", ink: "#E8E9EE", muted: "#ACB8CD", accent: "#C5B79A", accentAlt: "#849CAF" }, texture: "deep-velvet", border: "double-hairline", finish: "gold-foil", scale: "monumental", motion: "drift" },
  { id: "folio", name: "Nocturne Gala", palette: { bg: "#10131B", surface: "#1C202B", ink: "#E2E5ED", muted: "#ACB4C5", accent: "#BDC8DA", accentAlt: "#788BA9" }, texture: "smooth", border: "hairline", finish: "silver-chrome", scale: "monumental", motion: "unfold" },
  { id: "arch", name: "Desert Stone", palette: { bg: "#E4E9E9", surface: "#D5DEDE", ink: "#243237", muted: "#53636A", accent: "#50626A", accentAlt: "#7E656A" }, texture: "matte-stone", border: "frame-inset", finish: "none", scale: "understated", motion: "drift" },
  { id: "botanical", name: "Botanical Atelier", palette: { bg: "#E9ECE4", surface: "#DCE2D5", ink: "#28382F", muted: "#536858", accent: "#53663F", accentAlt: "#715747" }, texture: "cotton-paper", border: "none", finish: "bronze-patina", scale: "editorial", motion: "drift" },
];
await mkdir(output, { recursive: true });
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, "content.json"), JSON.stringify({ ...demo, slug }));
await writeFile(path.join(directory, "asset-plan.json"), JSON.stringify({ assets: [], unifiedTreatment: "none" }));
for (const direction of directions) {
  await mkdir(path.join(directory, "concepts", direction.id), { recursive: true });
  const theme = { ...legacy, meta: { name: direction.name, mood: ["editorial"], rationale: "Deterministic physicality QA fixture, never an AI generation fallback." },
    palette: direction.palette, typeSet: "editorial", artwork: "none", ornament: { pack: "none", density: "light", placement: [], color: "accent" },
    foil: { enabled: !["none", "blind-emboss"].includes(direction.finish), color: direction.palette.accent },
    surface: { texture: direction.texture, borderStyle: direction.border }, finishing: { type: direction.finish, sheenAngle: 135 },
    atmosphere: { grainIntensity: .045, vignetteStrength: .15, ambientGlow: "radial-gradient(ellipse at 20% 10%, hsla(210, 30%, 70%, 0.07), transparent 65%)" },
    typographyScale: { displayScale: direction.scale, headlineTracking: "-0.03em", metaTracking: "0.2em" },
    motion: { preset: direction.motion, ambient: "none" }, layout: { ...legacy.layout, composition: direction.id },
  };
  await writeFile(path.join(directory, "concepts", direction.id, "v1.json"), JSON.stringify(theme));
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROME_EXECUTABLE });
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (error) => report.errors.push(error.message));
  const routes = [...["letter", "poster", "folio", "arch", "botanical"].map((id) => `demo/${id}/1`), "demo/arch/2", ...directions.map(({ id }) => `${slug}/${id}/1`)];
  for (const route of routes) for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(`${base}/preview/${route}?embed=1`, { waitUntil: "networkidle" });
    assert(response.ok(), `${route}: HTTP ${response.status()}`);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())); });
    const data = await snapshot(page, []);
    const checks = [overflow(data), clipping(data), collision(data), fonts(data)];
    const failures = checks.filter((check) => ["error", "fail"].includes(check.status));
    if (data.scrollWidth > width || data.animations) failures.push({ id: "width/reduced-motion", scrollWidth: data.scrollWidth, animations: data.animations });
    report.samples.push({ route: route.replace(slug, "physicality-fixture"), width, checks: checks.map(({ id, status }) => ({ id, status })) });
    if (failures.length) report.failures.push({ route, width, checks: failures });
    if (route.startsWith(slug) && [390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${route.split("/")[1]}-${width}.jpg`), type: "jpeg", quality: 85 });
  }
  const animated = await browser.newPage({ reducedMotion: "no-preference", viewport: { width: 390, height: 844 } });
  animated.on("pageerror", (error) => report.errors.push(error.message));
  await animated.goto(`${base}/preview/${slug}/folio/1`, { waitUntil: "networkidle" });
  await animated.locator("dialog[open]").waitFor();
  await animated.getByRole("button", { name: "Открыть приглашение" }).click();
  await animated.waitForFunction(() => !document.querySelector("dialog").open);
  await animated.waitForFunction(() => getComputedStyle(document.querySelector(".text-reveal-inner")).transform === "none" || getComputedStyle(document.querySelector(".text-reveal-inner")).transform === "matrix(1, 0, 0, 1, 0, 0)");
  assert(await animated.locator("#hero-title").isVisible());
  report.checks.envelopeTextReveal = true;
  await animated.goto(`${base}/preview/${slug}/poster/1?embed=1`, { waitUntil: "networkidle" });
  await animated.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await animated.locator(".text-reveal-inner").evaluate((el) => getComputedStyle(el).transform), "none");
  report.checks.dynamicReducedMotion = true;
  const noJs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await noJs.goto(`${base}/preview/${slug}/folio/1?embed=1`, { waitUntil: "networkidle" });
  assert(await noJs.locator("#hero-title").isVisible());
  assert.equal(await noJs.locator(".text-reveal-inner").evaluate((el) => getComputedStyle(el).transform), "none");
  report.checks.noJsHeadline = true;

  await writeFile(path.join(directory, "content.json"), JSON.stringify({ ...demo, slug, locale: "uz-latn", hosts: [{ name: "Gʻulom" }, { name: "Maʼmura" }] }));
  await page.goto(`${base}/preview/${slug}/folio/1?embed=1`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("main.invitation").getAttribute("lang"), "uz-Latn");
  assert.match(await page.locator("#hero-title").textContent(), /Gʻulom.*Maʼmura/);
  await page.evaluate(() => document.fonts.ready);
  assert((await snapshot(page, [])).scrollWidth <= 1440);
  report.checks.uzbekApostrophes = true;
  console.log(JSON.stringify({ samples: report.samples.length, failures: report.failures, errors: report.errors, checks: report.checks }, null, 2));
  assert.equal(report.failures.length, 0, "Physicality visual QA failed");
  assert.equal(report.errors.length, 0, "Browser errors");
} finally {
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
  await rm(directory, { recursive: true, force: true });
}
