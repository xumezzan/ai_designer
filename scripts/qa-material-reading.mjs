import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Read-only reading regression for existing owned, published material sites.
// This program sends GET requests only and blocks all browser mutations.
const base = new URL(process.env.PLATFORM_QA_BASE_URL || "http://127.0.0.1:4315");
assert.ok(["http:", "https:"].includes(base.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && !base.username && !base.password, "Use an isolated loopback server");
const sourceDirectory = path.resolve(process.env.MATERIAL_READING_SOURCE_DIR || "docs/material-studio");
const output = path.resolve(process.env.PLATFORM_QA_OUTPUT_DIR || "docs/material-studio/reading");
const allScenes = process.env.MATERIAL_READING_ALL === "1";
const widths = [320, 390, 430, 768, 1280, 1664];
const playwrightModule = process.env.QA_PLAYWRIGHT_MODULE || path.join(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs");
const report = { generatedAt: new Date().toISOString(), base: base.origin, mode: "read-only-material-reading", scenarios: [], expectedPages: (allScenes ? 4 : 2) * widths.length + 1, pages: [], mutationsBlocked: [], externalRequests: [], failures: [], generationPosts: 0, limitations: ["Existing published snapshots only. No registration, draft edit, upload, publication or AI generation request is sent.", "Default scope: the real burgundy silk greeting and authored porcelain greeting. MATERIAL_READING_ALL=1 includes the other two authored material scenes.", "Chromium with reduced motion at 320/390/430/768/1280/1664px and the live greeting without JavaScript at390px; physical phones, Safari and normal animation are not tested.", "Contrast uses computed CSS text colours and a near-opaque local footer plate, with conservative black/white backdrop bounds. Image pixels, shadows, texture and decorative pseudo-elements are not sampled."] };
let browser;

function parseColor(value) {
  const match = value.trim().match(/^(rgba?|color)\((.*)\)$/i);
  if (!match) throw new Error(`Unsupported computed colour: ${value}`);
  const space = match[1] === "color";
  const content = match[2].replace(/^srgb\s+/, "");
  const parts = content.split(/\s*[,/]\s*|\s+/).filter(Boolean);
  assert.ok(parts.length === 3 || parts.length === 4, `Invalid computed colour: ${value}`);
  const rgb = parts.slice(0, 3).map((part) => part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part) / (space ? 1 : 255));
  const alpha = parts.length === 4 ? (parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
  assert.ok([...rgb, alpha].every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1), `Colour channel outside sRGB: ${value}`);
  return { rgb, alpha };
}
const over = (foreground, background) => foreground.rgb.map((channel, index) => channel * foreground.alpha + background[index] * (1 - foreground.alpha));
const luminance = (rgb) => rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + 0.05) / (values[1] + 0.05); }
// Known WCAG reference endpoints keep the contrast calculation independently
// checkable without introducing a browser-image sampling dependency.
assert.equal(contrast([0, 0, 0], [1, 1, 1]), 21);
assert.equal(contrast([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), 1);
assert.ok(Math.abs(luminance([0.5, 0.5, 0.5]) - 0.21404114048223255) < 1e-12);
assert.deepEqual(over(parseColor("rgba(255, 255, 255, 0.5)"), [0, 0, 0]), [0.5, 0.5, 0.5]);

async function readJson(endpoint) {
  const url = new URL(endpoint, base);
  assert.equal(url.origin, base.origin, "Read-only QA must remain on the local origin");
  const response = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `${url.pathname}: HTTP${response.status}`);
  return response.json();
}
// Serialised into the page by Playwright; keep dependencies inside this function.
function inspectReading() {
  const rect = (value) => ({ left: value.left, right: value.right, top: value.top + scrollY, bottom: value.bottom + scrollY, width: value.width, height: value.height });
  const visible = (element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && element.getBoundingClientRect().width > 2 && element.getBoundingClientRect().height > 2;
  const label = (element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList].map((name) => `.${name}`).join("")}`;
  const texts = [...document.querySelectorAll(".material-site-narrative p,.material-site-narrative h2")].filter(visible).filter((element) => element.textContent.trim()).map((element) => {
    const range = document.createRange(); range.selectNodeContents(element);
    const ranges = [...range.getClientRects()].filter((value) => value.width > 0 && value.height > 0).map(rect);
    const parent = element.parentElement;
    return { element: label(element), text: element.textContent.trim().slice(0, 160), tag: element.tagName, box: rect(element.getBoundingClientRect()), parent: { element: label(parent), box: rect(parent.getBoundingClientRect()) }, ranges, lineCount: new Set(ranges.map((value) => Math.round(value.top))).size, fontSize: getComputedStyle(element).fontSize };
  });
  const greeting = document.querySelector(".material-greeting,.greeting-section");
  const heading = greeting?.querySelector("h2");
  const copy = greeting?.querySelector(".material-greeting-prose,.greeting-copy");
  const style = greeting && getComputedStyle(greeting);
  const parts = greeting ? [...greeting.querySelectorAll("[data-greeting-part]")].filter(visible) : [];
  const paragraphGaps = parts.slice(1).map((element, index) => ({ from: parts[index].dataset.greetingPart, to: element.dataset.greetingPart, gap: element.getBoundingClientRect().top - parts[index].getBoundingClientRect().bottom }));
  const plate = document.querySelector(".material-site-farewell-copy");
  const footer = [...document.querySelectorAll(".material-site-farewell-copy p,.material-site-signature,.material-site-top")].filter(visible).map((element) => {
    const computed = getComputedStyle(element);
    const backgrounds = [];
    for (let ancestor = element; ancestor && ancestor.closest(".material-site-farewell-copy"); ancestor = ancestor.parentElement) {
      const ancestorStyle = getComputedStyle(ancestor);
      backgrounds.push({ element: label(ancestor), color: ancestorStyle.backgroundColor, opacity: Number(ancestorStyle.opacity), box: rect(ancestor.getBoundingClientRect()) });
      if (ancestor === plate) break;
    }
    return { element: label(element), text: element.textContent.trim().slice(0, 160), color: computed.color, fontSize: parseFloat(computed.fontSize), fontWeight: parseFloat(computed.fontWeight), opacity: Number(computed.opacity), box: rect(element.getBoundingClientRect()), backgrounds };
  });
  return { documentWidth: document.documentElement.scrollWidth, bodyHeight: document.documentElement.scrollHeight, textBoxes: texts, greeting: greeting ? { display: style.display, gridTemplateColumns: style.gridTemplateColumns, columnCount: style.columnCount, paragraphGaps, box: rect(greeting.getBoundingClientRect()), ...(heading ? { heading: rect(heading.getBoundingClientRect()) } : {}), ...(copy ? { copy: rect(copy.getBoundingClientRect()) } : {}) } : null, footer, visibleText: document.body.innerText, renderedDesign: { scene: document.querySelector(".material-site")?.dataset.scene, layout: document.querySelector(".material-site")?.dataset.layout, tone: document.querySelector(".material-site")?.dataset.tone } };
}

function inspectGeometry(result, width, personal) {
  const tolerance = 3;
  for (const item of result.textBoxes) {
    const viewportBounds = item.ranges.filter((value) => value.left < -tolerance || value.right > width + tolerance);
    const parentBounds = item.ranges.filter((value) => value.left < item.parent.box.left - tolerance || value.right > item.parent.box.right + tolerance || value.top < item.parent.box.top - tolerance || value.bottom > item.parent.box.bottom + tolerance);
    if (viewportBounds.length) result.failures.push(`${item.element}: text glyph bounds escape viewport`);
    if (parentBounds.length) result.failures.push(`${item.element}: text glyph bounds escape parent ${item.parent.element}`);
    if (width >= 768 && item.tag === "P" && item.box.width > 720 + tolerance) result.failures.push(`${item.element}: desktop paragraph wider than720px (${Math.round(item.box.width)}px)`);
  }
  if (personal && !result.greeting) result.failures.push("Personal greeting chapter is missing");
  if (personal && result.greeting) {
    const greeting = result.greeting;
    if (!greeting.heading || !greeting.copy) result.failures.push("Personal greeting must render both heading and live copy");
    const tracks = greeting.gridTemplateColumns.match(/(?:\d*\.)?\d+px/g) || [];
    if (greeting.display.includes("grid") && tracks.length > 1) result.failures.push(`Personal greeting uses ${tracks.length} grid columns (${greeting.gridTemplateColumns})`);
    if (Number(greeting.columnCount) > 1) result.failures.push("Personal greeting uses CSS multi-column text");
    if (greeting.heading && greeting.copy && greeting.copy.top < greeting.heading.bottom - tolerance) result.failures.push("Personal greeting copy does not follow its heading vertically");
    for (const gap of greeting.paragraphGaps) if (gap.gap < 24) result.failures.push(`Personal greeting ${gap.from}→${gap.to} gap is below24px (${gap.gap.toFixed(2)}px)`);
  }
  result.footerContrast = result.footer.map((text) => {
    const foreground = parseColor(text.color);
    const plate = text.backgrounds.find((background) => parseColor(background.color).alpha >= 0.94 && background.opacity >= 0.99);
    const threshold = text.fontSize >= 24 || (text.fontWeight >= 700 && text.fontSize >= 18.6666667) ? 3 : 4.5;
    const item = { element: text.element, text: text.text, foreground: text.color, fontSize: text.fontSize, fontWeight: text.fontWeight, threshold, plate: plate ? { element: plate.element, color: plate.color } : null };
    if (!plate) { item.passed = false; item.reason = "No near-opaque local footer plate; contrast over artwork is not established"; }
    else {
      const background = parseColor(plate.color);
      const ratios = [[0, 0, 0], [1, 1, 1]].map((backdrop) => { const backgroundRgb = over(background, backdrop); return contrast(over({ rgb: foreground.rgb, alpha: foreground.alpha * text.opacity }, backgroundRgb), backgroundRgb); });
      item.contrastRatio = Math.min(...ratios);
      item.passed = item.contrastRatio >= threshold;
      if (!item.passed) item.reason = `Contrast${item.contrastRatio.toFixed(2)} below${threshold}`;
    }
    if (!item.passed) result.failures.push(`${text.element}: ${item.reason}`);
    return item;
  });
  if (!result.footerContrast.length) result.failures.push("No visible footer copy was checked");
}

async function inspectPage(scenario, width, context, noJs = false) {
  const page = await context.newPage();
  const result = { scenario: scenario.key, width, mode: noJs ? "no-javascript" : "standard", endpoint: `/i/${scenario.slug}`, pageErrors: [], failures: [] };
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  try {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(new URL(result.endpoint, base).href, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.locator(".material-site").waitFor();
    // Long event pages place lazy artwork beyond Chromium's preload distance.
    // Trigger its normal read/scroll loading before awaiting image decoding.
    for (const image of await page.locator('img[loading="lazy"]').all()) if (await image.isVisible()) await image.scrollIntoViewIfNeeded();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(async (image) => { try { await image.decode(); } catch {} })); scrollTo({ top: 0, behavior: "instant" }); });
    Object.assign(result, await page.evaluate(inspectReading));
    if (result.documentWidth > width + 1) result.failures.push("Horizontal document overflow");
    inspectGeometry(result, width, scenario.personal);
    const normalise = (value) => value.replace(/[\s\u00a0\u202f]+/gu, " ").trim();
    for (const name of scenario.names) if (!normalise(result.visibleText).includes(normalise(name))) result.failures.push(`Missing supplied visible name:${name}`);
    if (scenario.personal && await page.locator('form[action$="/rsvp"]').count()) result.failures.push("Personal greeting contains an RSVP form");
    if (result.pageErrors.length) result.failures.push("Browser JavaScript errors");
    delete result.visibleText;
    if (scenario.key === "live-burgundy-silk" && [390, 1280, 1664].includes(width)) {
      const suffix = noJs ? "-no-js" : "";
      result.screenshots = [`${scenario.key}-${width}${suffix}-greeting.png`, `${scenario.key}-${width}${suffix}-footer.png`];
      await page.locator('.material-site-letter[data-role="greeting"]').screenshot({ path: path.join(output, result.screenshots[0]) });
      await page.locator(".material-site-farewell").screenshot({ path: path.join(output, result.screenshots[1]) });
      if (width === 390) { const file = `${scenario.key}-390${suffix}-full.png`; result.screenshots.push(file); await page.screenshot({ path: path.join(output, file), fullPage: true }); }
    }
  } catch (error) { result.failures.push(error.message); }
  finally { await page.close(); }
  report.pages.push(result);
  report.failures.push(...result.failures.map((message) => ({ scenario: scenario.key, width, mode: result.mode, message })));
  console.log(`${result.failures.length ? "FAIL" : "PASS"} ${scenario.key} ${width}${noJs ? " no-JS" : ""}`);
}

await mkdir(output, { recursive: true });
try {
  const authored = JSON.parse(await readFile(path.join(sourceDirectory, "final/report.json"), "utf8"));
  const live = JSON.parse(await readFile(path.join(sourceDirectory, "live/report.json"), "utf8"));
  const scenarios = authored.apiChecks.filter((item) => allScenes || item.purpose === "greeting").map((item) => ({ key: item.scenario, slug: item.slug, names: item.names, personal: item.purpose === "greeting", source: "final/report.json", snapshot: path.join(sourceDirectory, "final", `${item.scenario}-draft.json`) }));
  scenarios.push({ key: "live-burgundy-silk", slug: live.slug, names: [], personal: true, source: "live/report.json", snapshot: path.join(sourceDirectory, "live/published.json") });
  for (const scenario of scenarios) {
    assert.match(scenario.slug, /^[a-z0-9-]+$/);
    const saved = JSON.parse(await readFile(scenario.snapshot, "utf8"));
    const current = (await readJson(`/api/platform/public/${scenario.slug}`)).invitation.content;
    assert.deepEqual(current, saved, `${scenario.key}: published snapshot changed`);
    scenario.names = current.names;
    report.scenarios.push({ key: scenario.key, slug: scenario.slug, source: scenario.source, publicSnapshotUnchanged: true });
  }
  const { chromium } = await import(pathToFileURL(playwrightModule).href);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.QA_CHROME_EXECUTABLE ? { executablePath: process.env.QA_CHROME_EXECUTABLE } : {}) });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", serviceWorkers: "block" });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
  const noJs = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, javaScriptEnabled: false, reducedMotion: "reduce", serviceWorkers: "block" });
  for (const context of [mobile, desktop, noJs]) await context.route("**/*", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method())) { report.mutationsBlocked.push({ url: url.pathname, method: request.method() }); await route.fulfill({ status: 409, json: { error: "Mutations disabled during read-only QA" } }); }
    else if (url.origin !== base.origin) { report.externalRequests.push({ url: url.href, method: request.method() }); await route.abort("blockedbyclient"); }
    else await route.continue();
  });
  for (const scenario of scenarios) for (const width of widths) await inspectPage(scenario, width, width <= 430 ? mobile : desktop);
  await inspectPage(scenarios.find((scenario) => scenario.key === "live-burgundy-silk"), 390, noJs, true);
  assert.equal(report.pages.length, report.expectedPages);
  assert.deepEqual(report.mutationsBlocked, [], "Unexpected attempted browser mutation");
  assert.deepEqual(report.externalRequests, [], "Unexpected external browser request");
} catch (error) { report.failures.push({ scenario: "harness", message: error.message }); }
finally {
  await browser?.close();
  report.success = report.failures.length === 0;
  const contrasts = report.pages.flatMap((page) => page.footerContrast || []);
  report.summary = { textBoxesChecked: report.pages.reduce((sum, page) => sum + (page.textBoxes?.length || 0), 0), footerTextSamples: contrasts.length, passingFooterTextSamples: contrasts.filter((sample) => sample.passed).length, minimumFooterContrast: contrasts.length && contrasts.every((sample) => Number.isFinite(sample.contrastRatio)) ? Math.min(...contrasts.map((sample) => sample.contrastRatio)) : null };
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  const uniqueFailures = [...new Set(report.failures.map((failure) => failure.message))];
  await writeFile(path.join(output, "README.md"), ["# Проверка читаемости материальных сайтов", "", `Результат:**${report.success ? "PASS" : "FAIL"}**. Страниц:${report.pages.length}/${report.expectedPages}. POST/генерация:0.`, "", "Проверены границы живого текста относительно viewport и родителей, ширина абзацев, последовательное личное поздравление и контраст финала по стандартной sRGB формуле WCAG. Порог:4.5 для обычного текста,3 для крупного. Фон изображения не считается надёжной подложкой текста.", "", ...report.limitations.map((value) => `- ${value}`), "", "## Ошибки", "", ...(uniqueFailures.length ? uniqueFailures.map((value) => `- ${value}`) : ["Автоматических ошибок не обнаружено."]), "", "Все размеры, CSS-цвета, контрастные коэффициенты, bounding boxes и файлы снимков:[report.json](report.json).", ""].join("\n"));
  console.log(JSON.stringify({ success: report.success, pages: report.pages.length, failures: report.failures.length, uniqueFailures }, null, 2));
  if (!report.success) process.exitCode = 1;
}
