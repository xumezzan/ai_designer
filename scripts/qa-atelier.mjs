import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { snapshot } from "../qa/snapshot.mjs";
import { overflow } from "../qa/checks/overflow.mjs";
import { clipping } from "../qa/checks/clipping.mjs";
import { collision } from "../qa/checks/collision.mjs";
import { fonts } from "../qa/checks/fonts.mjs";

// Preview-only browser QA. Fixture files and existing demonstration artwork
// exercise the real renderer without generating designs or charging providers.
const { chromium } = process.env.QA_PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href) : await import("playwright");
const base = process.env.STUDIO_QA_URL || "http://127.0.0.1:3152";
const output = path.resolve(process.env.ATELIER_QA_OUTPUT || "docs/atelier");
const slug = `qa-atelier-${randomUUID().slice(0, 8)}`;
const directory = path.join(process.cwd(), "projects", slug);
const photoId = randomUUID();
const demo = JSON.parse(await readFile("projects/demo/content.json", "utf8"));
const legacy = JSON.parse(await readFile("projects/demo/concepts/letter/v1.json", "utf8"));
const light = { bg: "#EDF0E6", surface: "#E0E5D6", ink: "#294035", muted: "#526753", accent: "#667653", accentAlt: "#786855" };
const fixtures = [
  { id: "herbarium", composition: "botanical", name: "Гербарий на хлопковой бумаге", palette: light, texture: "cotton-paper", border: "blind-deboss", finish: "blind-emboss", scale: "editorial", pack: "botanical-engraving", placement: ["watermark", "divider"], motion: "drift" },
  { id: "silk-folio", composition: "folio", name: "Ботаническое фолио на шёлке", palette: light, texture: "raw-silk", border: "none", finish: "none", scale: "monumental", pack: "botanical-engraving", placement: ["corners", "divider"], motion: "unfold" },
  { id: "botanical-arch", composition: "arch", name: "Ботаническая арка", palette: light, texture: "cotton-paper", border: "none", finish: "blind-emboss", scale: "editorial", pack: "botanical-engraving", placement: ["hero-frame", "divider"], motion: "drift" },
  { id: "velvet-poster", composition: "poster", name: "Винный бархат и бронза", palette: { bg: "#2C1728", surface: "#48263F", ink: "#F7EDE3", muted: "#C7B6C1", accent: "#D3BB98", accentAlt: "#9B8699" }, texture: "deep-velvet", border: "frame-inset", finish: "bronze-patina", scale: "monumental", pack: "art-deco", placement: ["watermark", "divider"], motion: "drift" },
  { id: "night-folio", composition: "folio", name: "Ночной фолиант и серебро", palette: { bg: "#131C2B", surface: "#263345", ink: "#EAF0F5", muted: "#B0BED0", accent: "#B9CADC", accentAlt: "#8D9FAF" }, texture: "matte-stone", border: "hairline", finish: "silver-chrome", scale: "monumental", pack: "art-deco", placement: ["corners", "divider"], motion: "unfold" },
];
const asset = {
  id: photoId, role: "story", subject: "detail", focal: [.5, .5],
  safeArea: { x: 0, y: 0, w: 1, h: 1 }, allowedRatios: ["3:4", "4:5", "1:1", "3:2", "16:9"],
  treatment: "none", quality: "usable", issues: [], maxViewportShare: .45,
  placement: { section: "greeting", index: 0 },
};
const report = { fixture: "temporary demo data; no client project edited", providers: "no paid calls", samples: [], failures: [], errors: [], checks: {}, heroGeometry: [], screenshots: [], approvedFontFallbacks: [] };
let browser;

async function content(hosts = demo.hosts, locale = "ru") {
  await writeFile(path.join(directory, "content.json"), JSON.stringify({
    ...demo, slug, locale, hosts,
    media: [{ id: photoId, src: `/api/projects/${slug}/media/${photoId}.webp` }], refs: [],
  }));
}
async function ready(page, fixture, width) {
  await page.setViewportSize({ width, height: 900 });
  const response = await page.goto(`${base}/preview/${slug}/${fixture.id}/1?embed=1`, { waitUntil: "networkidle" });
  assert(response?.ok(), `${fixture.id}: HTTP ${response?.status()}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Force lazy photographs to load for crop and source-resolution checks.
    document.querySelectorAll("img").forEach((image) => { image.loading = "eager"; });
    await Promise.all([...document.images].map((image) => image.decode()));
  });
}
async function geometry(page) {
  return page.evaluate(() => {
    const hero = document.querySelector(".hero-wrapper");
    const bounds = hero.getBoundingClientRect();
    const box = (selector) => {
      const element = hero.querySelector(selector);
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x - bounds.x), y: Math.round(rect.y - bounds.y), w: Math.round(rect.width), h: Math.round(rect.height) };
    };
    const marks = [...hero.querySelectorAll("svg.ornament")].map((element) => {
      const rect = element.getBoundingClientRect();
      let opacity = 1;
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) opacity *= Number(getComputedStyle(ancestor).opacity);
      return {
        pack: element.dataset.pack, placement: [...element.classList].find((name) => name.startsWith("ornament-")),
        x: Math.round(rect.x - bounds.x), y: Math.round(rect.y - bounds.y), w: Math.round(rect.width), h: Math.round(rect.height),
        opacity: Number(opacity.toFixed(3)), visible: element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        strokes: element.querySelectorAll("path, ellipse, polygon, circle, rect, line").length,
        intersectsHero: rect.right > bounds.left && rect.left < bounds.right && rect.bottom > bounds.top && rect.top < bounds.bottom,
        pointerEvents: getComputedStyle(element).pointerEvents,
      };
    });
    return { title: box("#hero-title"), date: box(".hero-date"), place: box(".hero-place"), marks, hero: { w: Math.round(bounds.width), h: Math.round(bounds.height) } };
  });
}
async function registeredApostropheFallbacks(page, measuredFonts) {
  return page.evaluate((entries) => {
    // Editorial intentionally uses its registered display family for the two
    // Uzbek apostrophe glyphs missing from the body source. Verify that precise
    // case rather than treating every multi-family width difference as valid.
    if (document.querySelector("main.invitation").lang !== "uz-Latn") return [];
    const loaded = (family) => [...document.fonts].some((face) => face.family.replaceAll('"', "") === family && face.status === "loaded");
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    return entries.filter((entry) => entry.difference > .5).flatMap((entry) => {
      const element = document.querySelector(entry.selector), css = getComputedStyle(element);
      const probe = element.textContent.trim().slice(0, 200);
      const stack = css.fontFamily.split(",").map((family) => family.replaceAll('"', "").trim());
      const primary = stack[0], fallback = "Cormorant Garamond";
      if (!/[\u02BB\u02BC]/.test(probe) || primary !== "Golos Text" || !stack.includes(fallback) || !loaded(primary) || !loaded(fallback)) return [];
      const font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize}`;
      const stripped = probe.replace(/[\u02BB\u02BC]/g, "");
      ctx.font = `${font} ${css.fontFamily}`;
      const actual = ctx.measureText(probe).width, actualWithoutApostrophes = ctx.measureText(stripped).width;
      ctx.font = `${font} "${primary}"`;
      const primaryWithoutApostrophes = ctx.measureText(stripped).width;
      // The managed metric fallback appears between the body and glyph face.
      ctx.font = `${font} "${primary}", "${primary} Fallback", "${fallback}"`;
      const registeredPair = ctx.measureText(probe).width;
      const remainingDifference = Math.abs(actualWithoutApostrophes - primaryWithoutApostrophes);
      if (remainingDifference > .5 || Math.abs(actual - registeredPair) > .5) return [];
      return [{ selector: entry.selector, primary, fallback, originalDifference: entry.difference, remainingDifference, actual, registeredPair }];
    });
  }, measuredFonts);
}
async function verify(page, fixture, width, mode) {
  await ready(page, fixture, width);
  const data = await snapshot(page, [asset]);
  const measured = await geometry(page);
  const approvedFallbacks = await registeredApostropheFallbacks(page, data.fonts);
  report.approvedFontFallbacks.push(...approvedFallbacks.map((entry) => ({ fixture: fixture.id, width, mode, ...entry })));
  const fontData = { ...data, fonts: data.fonts.map((entry) => approvedFallbacks.some((approved) => approved.selector === entry.selector) ? { ...entry, difference: 0 } : entry) };
  const checks = [overflow(data), clipping(data), collision(data), fonts(fontData)];
  const failures = checks.filter((check) => ["error", "fail"].includes(check.status));
  if (data.scrollWidth > width + 1 || data.animations) failures.push({ id: "width/reduced-motion", scrollWidth: data.scrollWidth, animations: data.animations });
  if (data.photos.length !== 1 || data.photos.some((photo) => !photo.protected)) failures.push({ id: "whole-photo", photos: data.photos });
  const photoPlacement = await page.locator(".directed-photo").evaluate((element) => ({
    quality: element.dataset.quality, inHero: Boolean(element.closest(".slot-hero")), section: element.closest("[data-photo-section]")?.dataset.photoSection,
  }));
  if (photoPlacement.quality !== "usable" || photoPlacement.inHero || photoPlacement.section !== "greeting") failures.push({ id: "photo-quality-placement", ...photoPlacement });
  const heroMark = measured.marks.find((mark) => mark.pack === fixture.pack && mark.visible && mark.intersectsHero && mark.w >= 50 && mark.h >= 50 && mark.opacity >= .08 && mark.strokes >= 1);
  if (!heroMark || measured.marks.some((mark) => mark.pointerEvents !== "none")) failures.push({ id: "visible-procedural-motif", marks: measured.marks });
  report.samples.push({ fixture: fixture.id, composition: fixture.composition, width, mode, checks: checks.map(({ id, status }) => ({ id, status })), photoPlacement, motif: heroMark || null });
  if (failures.length) report.failures.push({ fixture: fixture.id, width, mode, checks: failures, geometry: measured, fonts: data.fonts.filter((entry) => !entry.loaded || entry.difference > .5), fragments: data.fragments });
  if (mode === "standard") report.heroGeometry.push({ fixture: fixture.id, width, ...measured });
  if (mode === "standard" && [390, 1440].includes(width)) {
    const filename = `${fixture.id}-${width}.jpg`;
    const height = Math.ceil(await page.locator(".hero-wrapper").evaluate((element) => element.getBoundingClientRect().bottom + 24));
    const bytes = await page.screenshot({ path: path.join(output, filename), type: "jpeg", quality: 88, fullPage: true, clip: { x: 0, y: 0, width, height } });
    report.screenshots.push({ file: filename, fixture: fixture.id, width, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
}

try {
  await mkdir(output, { recursive: true });
  await mkdir(path.join(directory, "media"), { recursive: true });
  await content();
  // A 480×640 usable fixture deliberately fails the hero source-size gate.
  await sharp("public/artwork/suzani-atelier/hero-v1.webp").resize(480, 640, { fit: "contain" }).webp().toFile(path.join(directory, "media", `${photoId}.webp`));
  await writeFile(path.join(directory, "asset-plan.json"), JSON.stringify({ assets: [asset], unifiedTreatment: "none" }));
  for (const fixture of fixtures) {
    await mkdir(path.join(directory, "concepts", fixture.id), { recursive: true });
    const theme = {
      ...legacy, meta: { name: fixture.name, mood: ["editorial"], rationale: "Локальная проверка художественного оформления; не результат генерации и не запасной дизайн." },
      palette: fixture.palette, typeSet: "editorial", artwork: "none", materialSet: "paper",
      ornament: { pack: fixture.pack, density: "light", placement: fixture.placement, color: "accent" },
      foil: { enabled: !["none", "blind-emboss"].includes(fixture.finish), color: fixture.palette.accent },
      surface: { texture: fixture.texture, borderStyle: fixture.border }, finishing: { type: fixture.finish, sheenAngle: 135 },
      atmosphere: { grainIntensity: .055, vignetteStrength: .18, ambientGlow: "radial-gradient(ellipse at 20% 10%, hsla(75, 25%, 70%, 0.1), transparent 65%)" },
      typographyScale: { displayScale: fixture.scale, headlineTracking: "-0.035em", metaTracking: "0.16em" },
      motion: { preset: fixture.motion, ambient: "none" },
      layout: { ...legacy.layout, composition: fixture.composition, hero: "typographic", photoArrangement: "offset", visualPlacement: "band", nameFlow: "natural" },
      photos: [{ id: photoId, section: "greeting", index: 0, position: "after" }],
    };
    await writeFile(path.join(directory, "concepts", fixture.id, "v1.json"), JSON.stringify(theme));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROME_EXECUTABLE });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  for (const fixture of fixtures) for (const width of [320, 390, 1024, 1440]) await verify(page, fixture, width, "standard");

  // Same content and palette: botanical, folio and arch must have genuinely
  // different name/date/place geometry, independently of texture or color.
  for (const width of [320, 390, 1024, 1440]) {
    const signatures = report.heroGeometry.filter((entry) => entry.width === width && fixtures.slice(0, 3).some((fixture) => fixture.id === entry.fixture))
      .map(({ title, date, place }) => JSON.stringify({ title, date, place }));
    assert.equal(new Set(signatures).size, 3, `${width}px: botanical, folio and arch have identical hero geometry`);
  }
  for (const width of [390, 1440]) assert.equal(new Set(report.screenshots.filter((entry) => entry.width === width).map((entry) => entry.sha256)).size, fixtures.length);
  report.checks.distinctHeroGeometry = report.checks.distinctScreenshots = report.checks.visibleBotanicalMotif = report.checks.usablePhotoOutsideHero = true;

  await content([{ name: "Екатерина-Александра" }, { name: "Константин-Владислав" }]);
  for (const fixture of fixtures) for (const width of [320, 390, 1024, 1440]) await verify(page, fixture, width, "long-cyrillic");
  report.checks.longCyrillicNames = true;
  await content();

  const noJs = await browser.newPage({ javaScriptEnabled: false, reducedMotion: "reduce", viewport: { width: 390, height: 900 } });
  for (const fixture of fixtures) {
    await verify(noJs, fixture, 390, "no-js");
    assert(await noJs.locator("#hero-title").isVisible());
    assert.equal(await noJs.locator(".text-reveal-inner").evaluate((element) => getComputedStyle(element).transform), "none");
  }
  report.checks.noJsReadable = true;

  const animated = await browser.newPage({ reducedMotion: "no-preference", viewport: { width: 390, height: 900 } });
  animated.on("pageerror", (error) => report.errors.push(error.message));
  await animated.goto(`${base}/preview/${slug}/silk-folio/1`, { waitUntil: "networkidle" });
  await animated.locator("dialog[open]").waitFor();
  await animated.getByRole("button", { name: "Открыть приглашение" }).click();
  await animated.waitForFunction(() => !document.querySelector("dialog").open);
  await animated.waitForFunction(() => ["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(getComputedStyle(document.querySelector(".text-reveal-inner")).transform));
  assert(await animated.locator("#hero-title").isVisible());
  report.checks.envelopeTextReveal = true;
  await animated.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await animated.locator(".text-reveal-inner").evaluate((element) => getComputedStyle(element).transform), "none");
  assert.equal(await animated.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length), 0);
  report.checks.dynamicReducedMotion = true;

  await content([{ name: "Gʻulom" }, { name: "Maʼmura" }], "uz-latn");
  await verify(page, fixtures[1], 390, "uzbek-apostrophes");
  assert.equal(await page.locator("main.invitation").getAttribute("lang"), "uz-Latn");
  assert.match(await page.locator("#hero-title").textContent(), /Gʻulom.*Maʼmura/);
  report.checks.uzbekApostrophes = true;
  console.log(JSON.stringify({ samples: report.samples.length, failures: report.failures.map(({ fixture, width, mode, checks }) => ({ fixture, width, mode, checks })), errors: report.errors, checks: report.checks }, null, 2));
  assert.equal(report.failures.length, 0, "Atelier browser QA failed; see docs/atelier/report.json");
  assert.deepEqual(report.errors, [], "Browser errors");
} catch (error) {
  report.errors.push(error.message);
  throw error;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser?.close();
  await rm(directory, { recursive: true, force: true });
}
