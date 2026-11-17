import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Authored acceptance fixtures. This harness must never call an AI provider.
// Start an isolated loopback server, then run with the local Playwright runtime:
// node --env-file=.env.local scripts/qa-material-platform.mjs
const base = new URL(process.env.PLATFORM_QA_BASE_URL || "http://127.0.0.1:4314");
assert.ok(["http:", "https:"].includes(base.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && !base.username && !base.password, "Use an isolated loopback test server");
const output = path.resolve(process.env.PLATFORM_QA_OUTPUT_DIR || "docs/local-product-qa/material-platform");
const assetDirectory = process.env.MATERIAL_QA_ASSET_DIR ? path.resolve(process.env.MATERIAL_QA_ASSET_DIR) : undefined;
const recheckPath = process.env.MATERIAL_QA_RECHECK_REPORT ? path.resolve(process.env.MATERIAL_QA_RECHECK_REPORT) : undefined;
assert.ok(recheckPath || assetDirectory, "Set MATERIAL_QA_ASSET_DIR to the directory containing silk.webp, porcelain.webp and night-garden.webp");
assert.ok(!recheckPath || path.dirname(recheckPath) !== output, "Keep original API evidence separate from a read-only recheck");
const playwrightModule = process.env.QA_PLAYWRIGHT_MODULE || path.join(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs");
const widths = [320, 390, 430, 1280];
const designKeys = ["templateId", "paletteId", "fontPairId", "composition", "ornamentSetId", "artDirection", "artwork", "artworkWide"];
const designOf = (draft) => Object.fromEntries(designKeys.filter((key) => draft[key] !== undefined).map((key) => [key, structuredClone(draft[key])]));
const factsOf = (draft) => Object.fromEntries(Object.entries(draft).filter(([key]) => !designKeys.includes(key)));
const generationPost = (url, method) => method === "POST" && /\/generate\/?$/.test(new URL(url, base).pathname);
const invitationLanguage = /приглаш[а-яё]*|подтвердите\s+(?:присутствие|участие)|ответ\s+гостя|встреча\s+гостей|будем\s+ждать\s+вас/iu;
const scenarios = [
  { key: "silk-wedding", title: "Шёлк и винная каллиграфия", scene: "silk", layout: "editorial", eventType: "wedding", purpose: "invitation", names: ["София", "Александр"], templateId: "classic", paletteId: "ivory", fontPairId: "ceremony", greeting: "Дорогие родные и друзья! Разделите с нами радость нашего свадебного дня.", story: "Из случайной встречи выросла наша история. Впереди новая глава, которую мы рады разделить с близкими.", closing: "С любовью, София и Александр" },
  { key: "night-garden-birthday", title: "Ночной сад и свет", scene: "night-garden", layout: "immersive", eventType: "birthday", purpose: "invitation", names: ["Александра-Екатерина Константиновна"], templateId: "nocturne", paletteId: "ink", fontPairId: "poetic", greeting: "Дорогие друзья! Буду рада отпраздновать день рождения в вашей компании.", story: "Пусть этот вечер будет наполнен музыкой, тихими разговорами и дорогими сердцу людьми.", closing: "До встречи на празднике! Александра-Екатерина" },
  { key: "porcelain-greeting", title: "Фарфоровое поздравление", scene: "porcelain", layout: "keepsake", eventType: "birthday", purpose: "greeting", names: ["Амира"], headline: "С днём рождения, Амира!", templateId: "editorial", paletteId: "clay", fontPairId: "editorial", greeting: "Амира, с днём рождения! Пусть каждый день дарит вдохновение, радость и поводы улыбаться.", story: "Желаю смелости для новых замыслов, времени для себя и людей, с которыми можно быть собой.", closing: "С теплом и самыми добрыми пожеланиями" },
];
const report = { generatedAt: new Date().toISOString(), base: base.origin, mode: recheckPath ? "read-only-existing-material-scenes" : "authored-material-scenes", generationPosts: 0, blockedBrowserGenerationPosts: 0, externalRequests: [], expectedScenarios: 3, expectedPages: 14, apiChecks: [], pages: [], failures: [], ...(recheckPath ? { sourceReport: path.relative(output, recheckPath) } : {}), limitations: ["Authored fixtures with original supplied material artwork; no AI generation endpoint or provider is invoked.", "Chromium with reduced motion at 320, 390, 430 and 1280 pixels. A mobile invitation also checks keyboard navigation with motion allowed. Physical phones and Safari are not tested.", "The greeting is inspected with JavaScript disabled. Browser assertions establish integration and readability; visual quality requires reviewing the saved complete mobile pages.", "All names, event facts, accounts and drafts are fictional and remain in the isolated local test store."] };
let browser;

function draftFor(scenario) {
  const greeting = scenario.purpose === "greeting";
  return { title: `Material QA · ${scenario.title}`, purpose: scenario.purpose, ...(scenario.headline ? { headline: scenario.headline } : {}), templateId: scenario.templateId, paletteId: scenario.paletteId, fontPairId: scenario.fontPairId, artDirection: { title: scenario.title, scene: scenario.scene, layout: scenario.layout }, eventType: scenario.eventType, locale: "ru", names: scenario.names, date: { day: greeting ? "" : "2028-06-19", time: greeting ? "" : "18:00", timezone: "Asia/Tashkent", showCountdown: !greeting }, greeting: scenario.greeting, story: scenario.story, venue: greeting ? { name: "", address: "" } : { name: "Сад встреч", address: "Ташкент, вымышленный адрес для локальной проверки", note: "Вымышленные данные QA." }, timeline: greeting ? [] : [{ time: "18:00", title: "Встреча гостей" }, { time: "19:00", title: "Праздничный вечер" }], ...(!greeting ? { dressCode: { title: "Свободный праздничный стиль", note: "Выбирайте то, в чём вам комфортно.", swatches: ["#ADB89E", "#E5DCCB"] } } : {}), closing: scenario.closing, enabledSections: greeting ? ["opening", "greeting", "story", "closing"] : ["opening", "greeting", "story", "date", "venue", "timeline", "dressCode", "rsvp", "closing"], media: [] };
}
async function request(endpoint, { method = "GET", body, form, cookie, expected = [200] } = {}) {
  const url = new URL(endpoint, base);
  assert.equal(url.origin, base.origin, "QA API requests must stay on the guarded local origin");
  assert.ok(!generationPost(url, method), "This harness must never send a generation POST");
  const response = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(60_000), headers: { Origin: base.origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: form || (body ? JSON.stringify(body) : undefined) });
  assert.ok(expected.includes(response.status), `${method} ${url.pathname}: HTTP ${response.status}: ${(await response.clone().text()).slice(0, 400)}`);
  return response;
}
const api = async (endpoint, options) => (await request(endpoint, options)).json();

async function checkApi(scenario, cookie) {
  const fixture = draftFor(scenario);
  let record = (await api("/api/platform/invitations", { method: "POST", cookie, expected: [201], body: { draft: fixture } })).invitation;
  const endpoint = `/api/platform/invitations/${record.id}`;
  assert.deepEqual(factsOf(record.draft), factsOf(fixture), "Initial validation changed supplied facts");
  const form = new FormData();
  form.set("file", new Blob([await readFile(path.join(assetDirectory, `${scenario.scene}.webp`))], { type: "image/webp" }), `${scenario.scene}.webp`);
  const artwork = (await api(`${endpoint}/media`, { method: "POST", form, cookie, expected: [201] })).media;
  assert.ok(artwork.id && artwork.src === `/api/platform/media/${artwork.id}`, "Uploaded material must use an owned media reference");
  record = (await api(endpoint, { method: "PATCH", cookie, body: { draft: { ...record.draft, artwork }, expectedUpdatedAt: record.updatedAt } })).invitation;
  const chosenDesign = designOf(record.draft);
  assert.deepEqual(chosenDesign.artDirection, fixture.artDirection, "Material art direction was lost during upload/save");
  assert.deepEqual(chosenDesign.artwork, artwork);
  assert.deepEqual(designOf((await api(endpoint, { cookie })).invitation.draft), chosenDesign, "Saved material design must reload exactly");
  const label = `QA original ${scenario.scene}`;
  record = (await api(`${endpoint}/design-history`, { method: "POST", cookie, body: { action: "save", label, expectedUpdatedAt: record.updatedAt } })).invitation;
  const saved = (await api(`${endpoint}/design-history`, { cookie })).versions.find((version) => version.source === "saved" && version.label === label);
  assert.ok(saved, "Saved material appearance must appear in history");
  assert.deepEqual(saved.design, chosenDesign, "History must include both art direction and artwork");
  record = (await api(`${endpoint}/publish`, { method: "POST", cookie, body: { expectedUpdatedAt: record.updatedAt } })).invitation;
  const publicPath = `/api/platform/public/${record.slug}`;
  const published = (await api(publicPath)).invitation;
  assert.deepEqual(published.content.names, fixture.names);
  assert.deepEqual(published.content.date, fixture.date);
  assert.deepEqual(designOf(published.content), chosenDesign, "Published snapshot lost the material scene");
  // The management title belongs to the private dashboard. Publication uses
  // the supplied names as its title, while keeping enabled guest facts exact.
  assert.equal(published.content.title, fixture.names.join(" & "), "Public title must use supplied names instead of the private management title");
  const expectedPublicFacts = { ...factsOf(fixture), title: fixture.names.join(" & ") };
  assert.deepEqual(factsOf(published.content), expectedPublicFacts, "Publishing changed supplied guest-facing facts");
  assert.equal((await request(artwork.src)).status, 200, "Published artwork must be public");
  const changedDraft = structuredClone(record.draft);
  changedDraft.greeting += " Сохраняем тёплые воспоминания.";
  changedDraft.artDirection.title += " · изменено в черновике";
  delete changedDraft.artwork;
  record = (await api(endpoint, { method: "PATCH", cookie, body: { draft: changedDraft, expectedUpdatedAt: record.updatedAt } })).invitation;
  assert.deepEqual((await api(publicPath)).invitation, published, "Draft edits changed the frozen public snapshot");
  const latestFacts = factsOf(record.draft);
  record = (await api(`${endpoint}/design-history`, { method: "POST", cookie, body: { action: "restore", reference: saved.reference, expectedUpdatedAt: record.updatedAt } })).invitation;
  assert.deepEqual(factsOf(record.draft), latestFacts, "Restoring appearance replaced later copy or event facts");
  assert.deepEqual(designOf(record.draft), chosenDesign, "Appearance history did not restore material direction and artwork");
  assert.deepEqual((await api(publicPath)).invitation, published, "History restoration changed the published snapshot");
  if (scenario.purpose === "greeting") {
    assert.deepEqual(published.content.venue, { name: "", address: "" });
    assert.deepEqual(published.content.timeline, []);
    assert.ok(!published.content.enabledSections.some((section) => ["date", "venue", "timeline", "dressCode", "rsvp"].includes(section)));
  }
  const result = { scenario: scenario.key, title: scenario.title, purpose: scenario.purpose, names: scenario.names, ...(scenario.headline ? { headline: scenario.headline } : {}), invitationId: record.id, slug: record.slug, design: chosenDesign, assertions: { ownedMediaUploaded: true, saveReload: true, factsPreserved: true, privateManagementTitleSanitized: true, published: true, historyIncludesArtDirectionAndArtwork: true, restorePreservesLatestFacts: true, publishedSnapshotIsolated: true, greetingWithoutEventFacts: scenario.purpose === "greeting" ? true : null } };
  report.apiChecks.push(result);
  await writeFile(path.join(output, `${scenario.key}-draft.json`), JSON.stringify(published.content, null, 2) + "\n");
  console.log(`PASS API ${scenario.key}`);
  return { ...scenario, ...result };
}

async function visibleFontChecks() {
  const visible = (element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && element.getBoundingClientRect().width > 2 && element.getBoundingClientRect().height > 2;
  const results = [];
  for (const element of [...document.querySelectorAll("h1,h2,p")].filter(visible).filter((element) => element.textContent.trim()).slice(0, 25)) {
    const style = getComputedStyle(element);
    const family = style.fontFamily.match(/^("[^"]+"|'[^']+'|[^,]+)/)?.[0]?.trim();
    const descriptor = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${family}`;
    const text = element.textContent;
    try {
      const faces = await document.fonts.load(descriptor, text);
      results.push({ family, descriptor, text: text.trim().slice(0, 80), loaded: faces.length > 0 && faces.every((face) => face.status === "loaded") && document.fonts.check(descriptor, text) });
    } catch (error) { results.push({ family, descriptor, loaded: false, error: error.message }); }
  }
  await document.fonts.ready;
  return results;
}

// Browser-computed colors, composited over black and white to bound contrast
// without treating a particular crop of one artwork as a reliable backdrop.
function inspectCoverContrast() {
  const hero = document.querySelector(".material-site-hero");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const channels = (color) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data, (value) => value / 255);
  };
  const luminance = (rgb) => rgb
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const over = ([r, g, b, alpha], background) => [r, g, b]
    .map((value, i) => alpha * value + (1 - alpha) * background[i]);
  const selectors = ".material-site-eyebrow, .material-site-name, .material-site-recipient, .material-site-date strong, .material-site-date > span, .material-site-date small, summary, .material-site-next";
  return [...hero.querySelectorAll(selectors)].map((element) => {
    const readingArea = element.closest(".material-site-cover-reading");
    const surface = readingArea && getComputedStyle(readingArea, "::before");
    const style = getComputedStyle(element);
    const size = Number.parseFloat(style.fontSize);
    const threshold = size >= 24 || (size >= 18.67 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
    if (!surface || surface.content === "none") return { element: element.className || element.tagName, ratio: 0, threshold };
    const foreground = channels(style.color);
    const tint = channels(surface.backgroundColor);
    const ratio = Math.min(...[0, 1].map((value) => {
      const background = over(tint, [value, value, value]);
      const lumas = [luminance(over(foreground, background)), luminance(background)].sort((a, b) => b - a);
      return (lumas[0] + 0.05) / (lumas[1] + 0.05);
    }));
    return { element: element.className || element.tagName, ratio, threshold };
  });
}

async function inspectPage(scenario, width, context, mode = "reduced-motion") {
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  const result = { scenario: scenario.key, width, mode, endpoint: `/i/${scenario.slug}`, pageErrors, consoleErrors, failures: [] };
  try {
    await page.setViewportSize({ width, height: 844 });
    result.httpStatus = (await page.goto(new URL(result.endpoint, base).href, { waitUntil: "networkidle" })).status();
    await page.locator(".material-site").waitFor();
    for (const image of await page.locator("img").all()) if (await image.isVisible()) await image.scrollIntoViewIfNeeded();
    await page.evaluate(async () => { await Promise.all([...document.images].filter((image) => image.currentSrc).map(async (image) => { try { await image.decode(); } catch {} })); await document.fonts.ready; scrollTo({ top: 0, behavior: "instant" }); });
    result.visibleFontChecks = await page.evaluate(visibleFontChecks);
    Object.assign(result, await page.evaluate(() => {
      const visible = (element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && element.getBoundingClientRect().width > 2 && element.getBoundingClientRect().height > 2;
      const root = document.querySelector(".material-site");
      const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
      const brokenHeadingWords = [];
      for (const heading of [...document.querySelectorAll("h1,h2,h3")].filter(visible)) {
        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.parentElement || !visible(node.parentElement)) continue;
          for (const match of node.textContent.matchAll(/[\p{L}\p{M}]{4,}/gu)) {
            const range = document.createRange(); range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
            const lines = new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top)));
            if (lines.size > 1) brokenHeadingWords.push({ word: match[0], heading: heading.textContent.trim().slice(0, 100), lines: lines.size });
          }
        }
      }
      const materialSources = [...document.querySelectorAll(".material-site img")].map((image) => image.getAttribute("src"));
      const styles = [root, ...root.querySelectorAll("[class]")].map((element) => getComputedStyle(element).backgroundImage).filter((value) => value !== "none");
      const backgroundUrls = styles.flatMap((style) => [...style.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((match) => match[1]));
      return { renderedDesign: { scene: root.dataset.scene, layout: root.dataset.layout }, documentWidth: document.documentElement.scrollWidth, touchDevice: { maxTouchPoints: navigator.maxTouchPoints, coarsePointer: matchMedia("(pointer: coarse)").matches }, visibleText: document.body.innerText, liveHeadings: [...document.querySelectorAll("h1")].filter(visible).map((heading) => heading.textContent), dateTimes: [...document.querySelectorAll("time[datetime]")].filter(visible).map((element) => element.getAttribute("datetime")), nativeRsvpForms: document.querySelectorAll('form[action$="/rsvp"]').length, calendarLinks: [...document.querySelectorAll("a[href]")].filter(visible).filter((anchor) => /calendar|\.ics(?:\?|$)/i.test(anchor.href)).map((anchor) => anchor.href), duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))], brokenImages: [...document.images].filter((image) => image.currentSrc && (!image.complete || !image.naturalWidth)).map((image) => image.currentSrc), missingAnchorTargets: [...document.querySelectorAll("a[href]")].filter(visible).flatMap((anchor) => { const url = new URL(anchor.href, location.href); if (!url.hash || url.origin !== location.origin || url.pathname !== location.pathname) return []; try { return document.getElementById(decodeURIComponent(url.hash.slice(1))) ? [] : [anchor.getAttribute("href")]; } catch { return [anchor.getAttribute("href")]; } }), materialSources: [...new Set([...materialSources, ...backgroundUrls])], brokenHeadingWords, textClippingCandidates: [...document.querySelectorAll("h1,h2,h3,p,button,a")].filter(visible).filter((element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2).map((element) => element.textContent.trim().slice(0, 100)) };
    }));
    result.coverContrast = await page.evaluate(inspectCoverContrast);
    for (const sample of result.coverContrast) {
      if (sample.ratio < sample.threshold) result.failures.push(`Insufficient cover contrast for ${sample.element}: ${sample.ratio.toFixed(2)} < ${sample.threshold}`);
    }
    if (result.httpStatus !== 200) result.failures.push(`HTTP ${result.httpStatus}`);
    if (result.renderedDesign.scene !== scenario.scene || result.renderedDesign.layout !== scenario.layout) result.failures.push("Saved material scene/layout is not reflected by renderer");
    if (result.documentWidth > width + 1) result.failures.push("Horizontal root overflow");
    if (width <= 430 && (!result.touchDevice.maxTouchPoints || !result.touchDevice.coarsePointer)) result.failures.push("Missing mobile touch emulation");
    // Russian typography binds short prepositions with NBSP. Check the same
    // supplied characters while allowing that intentional whitespace change.
    const normaliseSpacing = (text) => text.replace(/[\s\u00a0\u202f]+/gu, " ").trim();
    const visibleCopy = normaliseSpacing(result.visibleText);
    for (const name of scenario.names) if (!visibleCopy.includes(normaliseSpacing(name))) result.failures.push(`Missing visible supplied name: ${name}`);
    if (!result.liveHeadings.length || !scenario.names.every((name) => normaliseSpacing(result.liveHeadings.join(" ")).includes(normaliseSpacing(name)))) result.failures.push("Names must remain live text in a visible H1");
    if (scenario.headline && !visibleCopy.includes(normaliseSpacing(scenario.headline))) result.failures.push("Missing supplied personal headline");
    if (scenario.purpose !== "greeting" && !result.dateTimes.some((value) => value.startsWith("2028-06-19"))) result.failures.push("Missing supplied live event date");
    if (result.brokenHeadingWords.length) result.failures.push("A display word is split across lines");
    if (result.visibleFontChecks.some((font) => !font.loaded)) result.failures.push("Visible primary web fonts did not load");
    if (result.brokenImages.length) result.failures.push("Broken or unfinished images");
    if (!result.materialSources.some((src) => src?.includes(scenario.design.artwork.id))) result.failures.push("Uploaded original artwork is not used by the material scene");
    // Browser image decoding does not cover CSS backgrounds, so request every
    // referenced same-origin background independently before claiming it loaded.
    for (const source of result.materialSources) {
      if (!source) continue;
      const url = new URL(source, base);
      assert.equal(url.origin, base.origin, "Material artwork must be local during QA");
      const response = await request(url);
      assert.ok(response.headers.get("content-type")?.startsWith("image/"), "Material source must return an image");
    }
    if (result.duplicateIds.length || result.missingAnchorTargets.length) result.failures.push("Duplicate IDs or missing internal anchor targets");
    if (pageErrors.length || consoleErrors.length) result.failures.push("Browser JavaScript/console errors");
    const continueLink = page.locator(".material-site-next");
    if (await continueLink.count()) {
      await continueLink.scrollIntoViewIfNeeded();
      const arrowIsReachable = await continueLink.evaluate((link) => {
        const arrow = link.lastElementChild.getBoundingClientRect();
        return [arrow.top + 3, arrow.bottom - 3].every((y) => link.contains(document.elementFromPoint(arrow.left + arrow.width / 2, y)));
      });
      if (!arrowIsReachable) result.failures.push("Cover navigation is obscured by another section");
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    }
    if (scenario.purpose === "invitation") {
      const headingSize = await page.locator("#timeline-title").boundingBox();
      if (!headingSize?.width || !headingSize?.height) result.failures.push("Programme heading is collapsed");
    }
    if (scenario.purpose === "greeting") {
      if (result.nativeRsvpForms || result.calendarLinks.length || result.dateTimes.length) result.failures.push("Personal greeting contains event actions or event dates");
      if (invitationLanguage.test(result.visibleText)) result.failures.push("Personal greeting contains guest-invitation language");
    }
    delete result.visibleText;
    if (mode === "normal-motion") {
      const nextLink = page.getByRole("link", { name: "Читать дальше" });
      const href = await nextLink.getAttribute("href");
      assert.ok(href?.startsWith("#"));
      await nextLink.focus();
      await nextLink.press("Enter");
      await page.waitForURL((url) => url.hash === href);
      assert.equal(await page.locator(href).evaluate((element) => getComputedStyle(element).opacity), "1");
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    }
    const suffix = mode === "reduced-motion" ? "" : mode === "no-javascript" ? "-no-js" : "-motion";
    if (width === 390 || width === 1280) {
      result.screenshots = [`${scenario.key}-${width}${suffix}-hero.png`];
      if (width === 390) {
        result.screenshots.unshift(`${scenario.key}-390${suffix}-full.png`);
        await page.screenshot({ path: path.join(output, result.screenshots[0]), fullPage: true });
      }
      await page.screenshot({ path: path.join(output, `${scenario.key}-${width}${suffix}-hero.png`) });
    }
  } catch (error) { result.failures.push(error.message); }
  finally { await page.close(); }
  report.pages.push(result);
  report.failures.push(...result.failures.map((message) => ({ scenario: scenario.key, width, mode: result.mode, message })));
  console.log(`${result.failures.length ? "FAIL" : "PASS"} PAGE ${scenario.key} ${width} ${mode}`);
}

function markdown() {
  return ["# Проверка материальных сайтов", "", `Результат: **${report.success ? "PASS" : "FAIL"}**. API-сценарии: ${report.apiChecks.length}/${report.expectedScenarios}. Браузерные страницы: ${report.pages.length}/${report.expectedPages}. Вызовы генерации: ${report.generationPosts}.`, "", ...(report.sourceReport ? [`API и публикация проверены в [исходном отчёте](${report.sourceReport}); текущий запуск повторно проверяет неизменность опубликованных данных и браузер.`, ""] : []), "| Сцена | Композиция | Мобильная страница | Десктоп | Локальная ссылка |", "| --- | --- | --- | --- | --- |", ...report.apiChecks.map((item) => `| ${item.title} | ${item.design.artDirection.layout} | [390px полностью](${item.scenario}-390-full.png) | [1280px](${item.scenario}-1280-hero.png) | [Открыть](${base.origin}/i/${item.slug}) |`), "", "## Ограничения", "", ...report.limitations.map((item) => `- ${item}`), "", "## Ошибки", "", ...(report.failures.length ? report.failures.map((item) => `- ${item.scenario || "harness"}${item.width ? ` (${item.width}px, ${item.mode})` : ""}: ${item.message}`) : ["Автоматических ошибок не обнаружено. Визуальное одобрение пользователя остаётся отдельной оценкой."]), "", "Детали: [report.json](report.json).", ""].join("\n");
}

await mkdir(output, { recursive: true });
try {
  const ready = [];
  if (recheckPath) {
    const original = JSON.parse(await readFile(recheckPath, "utf8"));
    assert.equal(original.apiChecks.length, 3, "Read-only recheck needs all three original API cases");
    for (const scenario of scenarios) {
      const saved = original.apiChecks.find((item) => item.scenario === scenario.key);
      assert.ok(saved && /^[a-z0-9-]+$/.test(saved.slug));
      const snapshot = JSON.parse(await readFile(path.join(path.dirname(recheckPath), `${scenario.key}-draft.json`), "utf8"));
      const current = (await api(`/api/platform/public/${saved.slug}`)).invitation.content;
      assert.deepEqual(current, snapshot, "Published material snapshot changed since the source report");
      const result = { ...saved, assertionsSource: report.sourceReport, currentAssertions: { publicSnapshotUnchanged: true } };
      report.apiChecks.push(result); ready.push({ ...scenario, ...result });
      await writeFile(path.join(output, `${scenario.key}-draft.json`), JSON.stringify(current, null, 2) + "\n");
      console.log(`PASS READ-ONLY SNAPSHOT ${scenario.key}`);
    }
  } else {
    const tag = randomUUID();
    const registration = await request("/api/platform/auth/register", { method: "POST", body: { name: "Fictional Material QA", email: `material-${tag}@example.test`, password: randomUUID() + randomUUID() } });
    // Node fetch sends this cookie explicitly only to the guarded origin. This
    // avoids Playwright APIRequestContext omitting a Secure loopback HTTP cookie.
    const cookie = registration.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie, "Registration must establish a local authenticated session");
    for (const scenario of scenarios) {
      try { ready.push(await checkApi(scenario, cookie)); }
      catch (error) { report.failures.push({ scenario: scenario.key, message: error.message }); console.log(`FAIL API ${scenario.key}: ${error.message}`); }
    }
  }
  const { chromium } = await import(pathToFileURL(playwrightModule).href);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.QA_CHROME_EXECUTABLE ? { executablePath: process.env.QA_CHROME_EXECUTABLE } : {}) });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", serviceWorkers: "block" });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 844 }, isMobile: false, hasTouch: false, reducedMotion: "reduce", serviceWorkers: "block" });
  const noJs = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, javaScriptEnabled: false, reducedMotion: "reduce", serviceWorkers: "block" });
  const normalMotion = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "no-preference", serviceWorkers: "block" });
  for (const context of [mobile, desktop, noJs, normalMotion]) await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (generationPost(url, route.request().method())) { report.blockedBrowserGenerationPosts++; await route.fulfill({ status: 409, json: { error: "AI generation is disabled during material QA" } }); }
    else if (url.origin !== base.origin) { report.externalRequests.push({ url: url.href, method: route.request().method() }); await route.abort("blockedbyclient"); }
    else await route.continue();
  });
  for (const scenario of ready) for (const width of widths) await inspectPage(scenario, width, width <= 430 ? mobile : desktop);
  const personal = ready.find((scenario) => scenario.purpose === "greeting");
  if (personal) await inspectPage(personal, 390, noJs, "no-javascript");
  const invitation = ready.find((scenario) => scenario.purpose === "invitation");
  if (invitation) await inspectPage(invitation, 390, normalMotion, "normal-motion");
  assert.equal(report.generationPosts, 0);
  assert.equal(report.blockedBrowserGenerationPosts, 0, "Unexpected browser generation attempt");
  assert.deepEqual(report.externalRequests, [], "Unexpected external browser request");
  assert.equal(report.apiChecks.length, 3, "Not all API scenarios completed");
  assert.equal(report.pages.length, report.expectedPages, "Not all browser checks completed");
} catch (error) { report.failures.push({ scenario: "harness", message: error.message }); }
finally {
  await browser?.close();
  report.success = report.failures.length === 0;
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(path.join(output, "README.md"), markdown());
  console.log(JSON.stringify({ success: report.success, apiScenarios: report.apiChecks.length, pages: report.pages.length, generationPosts: report.generationPosts, failures: report.failures }, null, 2));
  if (!report.success) process.exitCode = 1;
}
