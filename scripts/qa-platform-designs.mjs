import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Run against an isolated local data directory. The default fixture run never
// invokes a provider. Explicit LIVE mode makes one generation POST per brief;
// it never retries a POST, even after a timeout. Status recovery uses GET only.
// The local server needs PLATFORM_AI_DAILY_LIMIT >= 5 for a complete live run.
const base = new URL(process.env.PLATFORM_QA_BASE_URL || "http://127.0.0.1:4312");
assert.ok(
  ["http:", "https:"].includes(base.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) &&
    !base.username && !base.password,
  "Use an isolated loopback test server",
);
const liveAi = process.env.PLATFORM_QA_LIVE_AI === "1";
const recheckPath = process.env.PLATFORM_QA_RECHECK_REPORT ? path.resolve(process.env.PLATFORM_QA_RECHECK_REPORT) : undefined;
assert.ok(!(liveAi && recheckPath), "Rechecking existing pages must not enable live generation");
const output = path.resolve(process.env.PLATFORM_QA_OUTPUT_DIR || "docs/local-product-qa/designs-local");
assert.ok(!recheckPath || path.dirname(recheckPath) !== output, "Keep the original acceptance report as generation evidence");
const playwrightModule = process.env.QA_PLAYWRIGHT_MODULE || path.join(
  homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
);
const widths = [320, 390, 430, 1280];
const generationPosts = new Set();
const report = {
  generatedAt: new Date().toISOString(), base: base.origin,
  mode: recheckPath ? "existing-published-designs" : liveAi ? "live-ai" : "authored-fixtures", expectedScenarios: 5, expectedPages: 20,
  generationPosts: 0, generationsSucceeded: 0, blockedBrowserGenerationPosts: 0,
  ...(recheckPath ? { sourceReport: path.relative(output, recheckPath), reusedGenerations: 0 } : {}),
  apiChecks: [], pages: [], failures: [], designHistogram: {},
  limitations: [
    recheckPath
      ? "Read-only recheck of existing published snapshots. Original generation and history assertions are attributed to the source report; public snapshot equality and browser rendering are checked again. No generation or draft mutation is sent."
      : liveAi
      ? "One real generation endpoint request per fictional brief; provider billing and internal provider call counts are not inferred from HTTP success."
      : "Authored registry-compatible fixtures test integration and responsive rendering. They do not test AI selection, new artwork or real AI design quality.",
    "Schema validity, token diversity and passing browser assertions do not establish that a design is beautiful. Review the saved mobile pages visually.",
    "Chromium emulates mobile touch at 320, 390 and 430 pixels. Physical phones, Safari, normal-motion animation and production hosting are not tested.",
    "The editorial anniversary intentionally has no photograph; personal photo upload, cropping and photographic art direction are not exercised.",
    "Small controls and text clipping candidates are reported as observations for visual review.",
  ],
};

function composition(heroLayout, photoShape, surfaceStyle, spacingScale, typographyAccent, sectionVariants, placement = "dividers") {
  return { heroLayout, photoShape, surfaceStyle, spacingScale, typographyAccent, decorConfig: { placement, density: "subtle", opacity: 0.3 }, sectionVariants };
}

// These explicit fixtures follow studioCompositionPresets in the registry.
// Keeping them in the harness makes fixture mode independent of TS path aliases;
// the application API validates every fixture before it is used or published.
const scenarios = [
  {
    key: "botanical-wedding", name: "Тёплая ботаническая свадьба", eventType: "wedding", names: ["София", "Александр"],
    templateId: "botanical", paletteId: "sage", fontPairId: "ceremony", ornamentSetId: "botanical-engraving",
    composition: composition("framed-arch", "arch", "soft-gradient", "airy-gallery", "classic-centered", { countdown: "tiles", program: "timeline", venue: "stacked", gallery: "grid", rsvp: "card" }, "corners"),
    brief: "Тёплая ботаническая свадьба Софии и Александра. Матовая шалфейная бумага, тонкая гравюра растений, арочная композиция, спокойная антиква и воздушный ритм всей страницы. Сохраните все имена, дату, место и тексты. Нужен готовый мобильный свадебный сайт.",
    greeting: "Дорогие родные и друзья! Разделите с нами радость нашего свадебного дня.",
    story: "Мы встретились весной и с тех пор бережно собираем общие воспоминания. Теперь начинается новая глава нашей истории.",
    closing: "С любовью и предвкушением встречи, София и Александр",
  },
  {
    key: "deco-wedding", name: "Вечерняя свадьба ар-деко", eventType: "wedding", names: ["Малика", "Тимур"],
    templateId: "nocturne", paletteId: "ink", fontPairId: "poetic", ornamentSetId: "deco-lines",
    composition: composition("fullscreen-cover", "pill", "glassmorphism", "balanced", "oversized-display", { countdown: "tiles", program: "cards", venue: "split", gallery: "filmstrip", rsvp: "minimal" }, "frame"),
    brief: "Вечерняя свадьба Малики и Тимура в эстетике сдержанного ар-деко. Глубокая тёмная поверхность, тёплый металлический акцент, монументальная типографика и строгая геометрия. Открытие во весь экран и выразительный вечерний ритм. Сохраните исходные факты и тексты, не повторяйте светлый ботанический дизайн.",
    greeting: "Дорогие близкие! В этот вечер мы хотим быть рядом с теми, кто дорог нашему сердцу.",
    story: "Из случайного знакомства выросли дружба, доверие и любовь. Мы рады начать наш семейный путь вместе с вами.",
    closing: "До встречи в нашем особенном вечере! Малика и Тимур",
  },
  {
    key: "poster-birthday", name: "Яркий типографический день рождения", eventType: "birthday", names: ["Александра-Екатерина Константиновна"],
    templateId: "modern", paletteId: "terracotta", fontPairId: "modernist", ornamentSetId: "graphic-ribbon",
    composition: composition("typographic-poster", "sharp", "flat", "compact-poster", "oversized-display", { countdown: "inline", program: "cards", venue: "split", gallery: "filmstrip", rsvp: "minimal" }, "background-pattern"),
    brief: "Яркий день рождения одного человека: Александра-Екатерина Константиновна. Современный типографический плакат, терракота и выразительная графическая лента, плотный энергичный ритм, широкие гротескные буквы. Это приглашение на праздник; сохраните дату, место, имя, расписание и тексты. Мобильная версия должна полностью показывать длинное имя.",
    greeting: "Дорогие друзья! Буду рада отпраздновать день рождения в вашей компании.",
    story: "Ещё один год подарил много открытий. Давайте встретим новый вместе — с музыкой, разговорами и любимыми людьми.",
    closing: "До встречи на празднике! Александра-Екатерина",
  },
  {
    key: "editorial-anniversary", name: "Редакционная история годовщины", eventType: "anniversary", names: ["Дильноза", "Джахонгир"],
    templateId: "editorial", paletteId: "ivory", fontPairId: "editorial", ornamentSetId: "editorial-rules",
    composition: composition("split-editorial", "sharp", "flat", "airy-gallery", "italic-serif-accent", { countdown: "date-led", program: "editorial-list", venue: "split", gallery: "editorial", rsvp: "split" }),
    brief: "Годовщина Дильнозы и Джахонгира как редакционная фотоистория: журнальные поля, асимметричное разделённое открытие, тонкие линии, выразительная антиква и широкие паузы. Фотографий пока нет: не придумывайте и не вставляйте изображения людей, сделайте законченную типографическую историю без пустых фотозаглушек. Сохраните исходные факты и тексты.",
    greeting: "Дорогие близкие! Приглашаем вас на тёплый вечер в честь годовщины нашей семьи.",
    story: "Каждый совместный год складывается из маленьких забот, больших мечтаний и родных голосов. Спасибо, что вы рядом с нашей семьёй.",
    closing: "С благодарностью за общие воспоминания, Дильноза и Джахонгир",
  },
  {
    key: "personal-greeting", name: "Личное поздравление без мероприятия", eventType: "birthday", purpose: "greeting", names: ["Амира"], headline: "С днём рождения, Амира!",
    templateId: "corporate", paletteId: "clay", fontPairId: "gallery", ornamentSetId: "editorial-rules",
    composition: composition("minimal-card", "rounded", "elevated-card", "balanced", "uppercase-wide-tracking", { countdown: "inline", program: "editorial-list", venue: "card", gallery: "grid", rsvp: "split" }),
    brief: "Личное минималистичное поздравление Амире с днём рождения. Это готовая поздравительная веб-открытка для одного человека, без мероприятия, даты, места, программы, календаря и RSVP. Тихая галерейная типографика, тёплая светлая поверхность, минимум декора. Сохраните персональное обращение и написанные пожелания; не добавляйте приглашения гостям.",
    greeting: "Амира, с днём рождения! Пусть каждый день приносит тебе спокойствие, вдохновение и поводы улыбаться.",
    story: "Желаю смелости для новых замыслов, времени для себя и людей, с которыми можно быть собой. Пусть впереди будет много счастливых открытий.",
    closing: "С теплом и самыми добрыми пожеланиями",
  },
];

function draftFor(scenario) {
  const greeting = scenario.purpose === "greeting";
  const needsGeneratedCopy = liveAi && greeting;
  return {
    title: `Local design QA · ${scenario.name}`, purpose: scenario.purpose || "invitation",
    ...(scenario.headline && !needsGeneratedCopy ? { headline: scenario.headline } : {}),
    templateId: scenario.templateId, paletteId: scenario.paletteId, fontPairId: scenario.fontPairId,
    ornamentSetId: scenario.ornamentSetId, composition: structuredClone(scenario.composition),
    eventType: scenario.eventType, locale: "ru", names: scenario.names,
    date: { day: greeting ? "" : "2028-06-19", time: greeting ? "" : "18:00", timezone: "Asia/Tashkent", showCountdown: !greeting },
    greeting: needsGeneratedCopy ? "" : scenario.greeting, story: scenario.story,
    venue: greeting ? { name: "", address: "" } : { name: "Сад встреч", address: "Ташкент, вымышленный адрес для локальной проверки", note: "Это вымышленные данные QA." },
    timeline: greeting ? [] : [{ time: "18:00", title: "Встреча гостей" }, { time: "19:00", title: "Праздничный вечер" }],
    ...(!greeting ? { dressCode: { title: "Свободный праздничный стиль", note: "Выбирайте то, в чём вам комфортно.", swatches: ["#ADB89E", "#E5DCCB"] } } : {}),
    closing: needsGeneratedCopy ? "" : scenario.closing,
    enabledSections: greeting ? ["opening", "greeting", "story", "closing"] : ["opening", "greeting", "story", "date", "venue", "timeline", "dressCode", "rsvp", "closing"],
    media: [],
  };
}

const designKeys = ["templateId", "paletteId", "fontPairId", "ornamentSetId", "composition", "artDirection", "artwork", "artworkWide"];
const designOf = (draft) => Object.fromEntries(designKeys.filter((key) => draft[key] !== undefined).map((key) => [key, structuredClone(draft[key])]));
const factsOf = (draft) => Object.fromEntries(Object.entries(draft).filter(([key]) => !designKeys.includes(key)));
const invitationLanguage = /приглаш[а-яё]*|подтвердите\s+(?:присутствие|участие)|ответ\s+гостя|встреча\s+гостей|будем\s+ждать\s+вас/iu;

function assertSuppliedFacts(actual, supplied, scenario) {
  const actualFacts = factsOf(actual);
  const suppliedFacts = factsOf(supplied);
  const needsGeneratedCopy = liveAi && scenario.purpose === "greeting";
  if (needsGeneratedCopy) {
    // Only these three empty copy fields may be filled. Event facts, existing
    // story and optional dress code stay under the exact preservation check.
    for (const key of ["headline", "greeting", "closing"]) {
      assert.ok(!supplied[key]?.trim(), `${scenario.key}: live copy fixture must start with empty ${key}`);
      assert.ok(actual[key]?.trim(), `${scenario.key}: generation did not fill ${key}`);
      delete actualFacts[key];
      delete suppliedFacts[key];
    }
    assert.ok(!invitationLanguage.test([actual.headline, actual.greeting, actual.closing].join("\n")), "Generated personal copy contains guest-invitation language");
  }
  assert.deepEqual(actualFacts, suppliedFacts, `${scenario.key}: generation or initial validation changed supplied event facts`);
}
const isGenerationPost = (url, method) => method === "POST" && /\/generate\/?$/.test(new URL(url, base).pathname);
async function request(endpoint, { method = "GET", body, cookie, expected = [200], scenarioKey, timeoutMs = 60_000 } = {}) {
  const url = new URL(endpoint, base);
  assert.equal(url.origin, base.origin, "QA requests must stay on the local test origin");
  if (isGenerationPost(url, method)) {
    assert.ok(liveAi, "Generation POST requires PLATFORM_QA_LIVE_AI=1");
    assert.ok(scenarioKey && !generationPosts.has(scenarioKey), "Only one generation POST per scenario is allowed");
    generationPosts.add(scenarioKey);
    report.generationPosts++;
  }
  const response = await fetch(url, {
    method, redirect: "manual", signal: AbortSignal.timeout(timeoutMs),
    headers: { Origin: base.origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(expected.includes(response.status), `${method} ${url.pathname}: HTTP ${response.status}: ${(await response.clone().text()).slice(0, 400)}`);
  return response;
}
const api = async (endpoint, options) => (await request(endpoint, options)).json();

async function generateOnce(endpoint, record, scenario, cookie) {
  const requestId = randomUUID();
  const brief = scenario.purpose === "greeting"
    ? `${scenario.brief} Заголовок, основное поздравление и заключительные слова пока пустые: напишите все три по этому брифу, обращаясь к Амире. Существующие пожелания в истории сохраните.`
    : scenario.brief;
  let result;
  let postError;
  const startedAt = Date.now();
  try {
    result = await api(`${endpoint}/generate`, {
      method: "POST", cookie, scenarioKey: scenario.key, timeoutMs: 180_000, expected: [200, 202],
      body: { requestId, expectedUpdatedAt: record.updatedAt, brief, referenceIds: [] },
    });
  } catch (error) {
    // A timed-out HTTP request may already have completed at the server. Never
    // repeat it; recover the same request's status through the read-only route.
    postError = error.message;
  }
  const recoveryDeadline = startedAt + 6 * 60_000 + 5_000;
  while (!result || result.job.status === "running") {
    assert.ok(Date.now() < recoveryDeadline, `${scenario.key}: generation status did not settle; no POST retry was attempted${postError ? ` (${postError})` : ""}`);
    try {
      result = await api(`${endpoint}/generate?requestId=${requestId}`, { cookie, timeoutMs: 180_000 });
    } catch (error) {
      throw new Error(`${scenario.key}: generation POST/status recovery failed; no retry: ${postError || error.message}`);
    }
    if (result.job.status === "running") await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  assert.equal(result.job.requestId, requestId);
  assert.equal(result.job.status, "succeeded", `${scenario.key}: ${result.job.error?.code || "generation failed"}`);
  assert.ok(result.invitation, `${scenario.key}: completed generation must return the invitation`);
  report.generationsSucceeded++;
  return { record: result.invitation, generation: { requestId, status: result.job.status, summary: result.job.summary, ...(postError ? { recoveredAfterPostError: postError } : {}) } };
}

async function checkScenario(scenario, cookie) {
  const fixture = draftFor(scenario);
  let record = (await api("/api/platform/invitations", { method: "POST", cookie, expected: [201], body: { draft: fixture } })).invitation;
  const endpoint = `/api/platform/invitations/${record.id}`;
  let generation;
  if (liveAi) ({ record, generation } = await generateOnce(endpoint, record, scenario, cookie));
  assertSuppliedFacts(record.draft, fixture, scenario);
  assert.ok(record.draft.composition || record.draft.artDirection, `${scenario.key}: expected explicit bounded composition or material direction`);
  const chosenDesign = designOf(record.draft);
  record = (await api(endpoint, { method: "PATCH", cookie, body: { draft: record.draft, expectedUpdatedAt: record.updatedAt } })).invitation;
  assert.deepEqual(designOf((await api(endpoint, { cookie })).invitation.draft), chosenDesign, "Design decisions must survive save/reload");
  const label = `QA original ${scenario.key}`;
  record = (await api(`${endpoint}/design-history`, { method: "POST", cookie, body: { action: "save", label, expectedUpdatedAt: record.updatedAt } })).invitation;
  const versions = (await api(`${endpoint}/design-history`, { cookie })).versions;
  const saved = versions.find((version) => version.source === "saved" && version.label === label);
  assert.ok(saved, "Saved appearance must appear in history");
  assert.deepEqual(saved.design, chosenDesign, "History must include every bounded design decision");
  record = (await api(`${endpoint}/publish`, { method: "POST", cookie, body: { expectedUpdatedAt: record.updatedAt } })).invitation;
  const publicPath = `/api/platform/public/${record.slug}`;
  const published = (await api(publicPath)).invitation;
  assert.deepEqual(published.content.names, fixture.names);
  assert.deepEqual(published.content.date, fixture.date);
  assert.deepEqual(designOf(published.content), chosenDesign, "Published snapshot lost design decisions");
  if (scenario.purpose === "greeting") {
    assert.equal(published.content.purpose, "greeting");
    assert.equal(published.content.date.day, "");
    assert.equal(published.content.date.time, "");
    assert.deepEqual(published.content.venue, { name: "", address: "" });
    assert.deepEqual(published.content.timeline, []);
    assert.ok(!published.content.enabledSections.some((section) => ["date", "venue", "timeline", "dressCode", "rsvp"].includes(section)));
  }
  const changedDraft = structuredClone(record.draft);
  changedDraft.greeting += " Сохраняем тёплые воспоминания.";
  changedDraft.composition.spacingScale = changedDraft.composition.spacingScale === "balanced" ? "airy-gallery" : "balanced";
  record = (await api(endpoint, { method: "PATCH", cookie, body: { draft: changedDraft, expectedUpdatedAt: record.updatedAt } })).invitation;
  assert.deepEqual((await api(publicPath)).invitation, published, "Draft appearance/text edits changed the published snapshot");
  const currentFacts = factsOf(record.draft);
  record = (await api(`${endpoint}/design-history`, { method: "POST", cookie, body: { action: "restore", reference: saved.reference, expectedUpdatedAt: record.updatedAt } })).invitation;
  assert.deepEqual(factsOf(record.draft), currentFacts, "Restoring appearance must preserve the latest event facts and text");
  assert.deepEqual(designOf(record.draft), chosenDesign, "Restoring appearance lost bounded design decisions");
  assert.deepEqual((await api(publicPath)).invitation, published, "Restoring appearance changed the frozen published snapshot");
  const result = { scenario: scenario.key, name: scenario.name, purpose: fixture.purpose, invitationId: record.id, slug: record.slug, design: chosenDesign, ...(generation ? { generation } : {}), assertions: { factsPreserved: true, saveReload: true, published: true, appearanceHistoryRoundTrip: true, restoreKeepsLatestFacts: true, publishedSnapshotIsolated: true, greetingWithoutEventFacts: scenario.purpose === "greeting" ? true : null, personalCopyGeneratedFromEmptyFields: liveAi && scenario.purpose === "greeting" ? true : null } };
  report.apiChecks.push(result);
  await writeFile(path.join(output, `${scenario.key}-draft.json`), JSON.stringify(published.content, null, 2) + "\n");
  console.log(`PASS API ${scenario.key} (${report.mode})`);
  return { ...scenario, ...result };
}

let browser;

async function checkVisibleFonts() {
  const visible = (element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
  const elements = [...document.querySelectorAll("h1,h2,p")].filter(visible).filter((element) => element.textContent.trim()).slice(0, 25);
  const results = [];
  for (const element of elements) {
    const style = getComputedStyle(element);
    // FontFaceSet.check with a whole fallback stack also checks registered,
    // unused fallback faces. An unloaded Cormorant fallback can falsely fail a
    // page actually rendered in loaded Golos/Prata. Check the first authored
    // family with the computed style/weight and the element's real glyphs.
    const primaryFamily = style.fontFamily.match(/^("[^"]+"|'[^']+'|[^,]+)/)?.[0]?.trim();
    const descriptor = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${primaryFamily}`;
    const text = element.textContent;
    const result = { tag: element.tagName, text: text.trim().slice(0, 80), family: primaryFamily, descriptor, initiallyLoaded: document.fonts.check(descriptor, text) };
    try {
      const faces = await document.fonts.load(descriptor, text);
      result.faces = faces.map((face) => ({ family: face.family, style: face.style, weight: face.weight, status: face.status }));
      // A missing family can make check() return true via a system fallback.
      // Requiring actual returned FontFaces keeps that failure detectable.
      result.loaded = faces.length > 0 && faces.every((face) => face.status === "loaded") && document.fonts.check(descriptor, text);
    } catch (error) { result.loaded = false; result.error = error.message; }
    results.push(result);
  }
  await document.fonts.ready;
  return results;
}

async function inspectPage(scenario, width, context) {
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  const result = { scenario: scenario.key, width, endpoint: `/i/${scenario.slug}`, isMobile: width <= 430, hasTouch: width <= 430, pageErrors, consoleErrors, failures: [] };
  try {
    await page.setViewportSize({ width, height: 844 });
    result.httpStatus = (await page.goto(new URL(result.endpoint, base).href, { waitUntil: "networkidle" })).status();
    await page.evaluate(() => document.fonts.ready);
    const opener = page.locator("dialog[open] .cover-open");
    if (await opener.count()) {
      await opener.click();
      await page.locator("dialog[open]").waitFor({ state: "hidden" });
    }
    for (const image of await page.locator('img[loading="lazy"]').all()) {
      if (await image.isVisible()) await image.scrollIntoViewIfNeeded();
    }
    await page.evaluate(async () => {
      await Promise.all([...document.images].filter((image) => image.currentSrc).map(async (image) => { try { await image.decode(); } catch {} }));
      await document.fonts.ready;
      window.scrollTo(0, 0);
    });
    result.visibleFontChecks = await page.evaluate(checkVisibleFonts);
    result.unloadedVisibleFonts = result.visibleFontChecks.filter((check) => !check.loaded).map((check) => check.descriptor);
    Object.assign(result, await page.evaluate(() => {
      const visible = (element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
      const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
      const label = (element) => (element.getAttribute("aria-label") || element.textContent || element.getAttribute("name") || element.tagName).trim().slice(0, 120);
      const faceList = [...document.fonts].map((face) => ({ family: face.family, status: face.status }));
      const brokenHeadingWords = [];
      for (const heading of [...document.querySelectorAll("h1,h2")].filter(visible).filter((element) => element.getBoundingClientRect().width > 2)) {
        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.parentElement || !visible(node.parentElement) || node.parentElement.getBoundingClientRect().width <= 2) continue;
          for (const match of node.textContent.matchAll(/[\p{L}\p{M}]{4,}/gu)) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const lines = new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top)));
            if (lines.size > 1) brokenHeadingWords.push({ heading: heading.textContent.trim().slice(0, 100), word: match[0], lines: lines.size });
          }
        }
      }
      return {
        brokenHeadingWords,
        documentWidth: document.documentElement.scrollWidth, fontStatus: document.fonts.status,
        touchDevice: { maxTouchPoints: navigator.maxTouchPoints, coarsePointer: matchMedia("(pointer: coarse)").matches },
        loadedFontFamilies: [...new Set(faceList.filter((face) => face.status === "loaded").map((face) => face.family))],
        failedFontFamilies: [...new Set(faceList.filter((face) => face.status === "error").map((face) => face.family))],
        duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
        brokenImages: [...document.images].filter((image) => image.currentSrc && (!image.complete || !image.naturalWidth)).map((image) => image.currentSrc),
        missingAnchorTargets: [...document.querySelectorAll("a[href]")].filter(visible).flatMap((anchor) => { const url = new URL(anchor.href, location.href); if (!url.hash || url.origin !== location.origin || url.pathname !== location.pathname) return []; try { return document.getElementById(decodeURIComponent(url.hash.slice(1))) ? [] : [anchor.getAttribute("href")]; } catch { return [anchor.getAttribute("href")]; } }),
        renderedDesign: { materialScene: document.querySelector(".material-site")?.getAttribute("data-scene"), materialLayout: document.querySelector(".material-site")?.getAttribute("data-layout"), template: document.querySelector("[data-studio-template]")?.getAttribute("data-studio-template"), composition: document.querySelector("[data-studio-composition]")?.getAttribute("data-studio-composition"), hero: document.querySelector("[data-hero-layout]")?.getAttribute("data-hero-layout"), surface: document.querySelector("[data-surface-style]")?.getAttribute("data-surface-style") },
        visibleText: document.body.innerText,
        dateTimes: [...document.querySelectorAll("time[datetime]")].filter(visible).map((element) => element.getAttribute("datetime")),
        nativeRsvpForms: document.querySelectorAll('form[action$="/rsvp"]').length,
        eventSections: [...document.querySelectorAll('[data-section], [data-template-role], [data-studio-section]')].filter(visible).map((element) => element.getAttribute("data-section") || element.getAttribute("data-template-role") || element.getAttribute("data-studio-section")),
        calendarLinks: [...document.querySelectorAll("a[href]")].filter(visible).filter((anchor) => /calendar|\.ics(?:\?|$)/i.test(anchor.href)).map((anchor) => anchor.href),
        observations: {
          shortControls: [...document.querySelectorAll("button,a,input,select,textarea")].filter(visible).filter((element) => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(label),
          textClippingCandidates: [...document.querySelectorAll("h1,h2,h3,p,label,button,a")].filter(visible).filter((element) => element.scrollWidth > element.clientWidth + 2 && element.clientWidth > 0).map(label),
        },
      };
    }));
    for (const name of scenario.names) {
      if (!result.visibleText.includes(name)) result.failures.push(`Missing visible name: ${name}`);
    }
    if (result.httpStatus !== 200) result.failures.push(`HTTP ${result.httpStatus}`);
    if (width <= 430 && (!result.touchDevice.maxTouchPoints || !result.touchDevice.coarsePointer)) result.failures.push("Mobile context is missing touch emulation");
    if (scenario.purpose !== "greeting" && !result.dateTimes.some((date) => date?.startsWith("2028-06-19"))) result.failures.push("Supplied event date is not visible");
    if (result.documentWidth > width + 1) result.failures.push("Horizontal root overflow");
    if (result.brokenHeadingWords.length) result.failures.push("A display word was split across lines");
    if (result.fontStatus !== "loaded" || result.failedFontFamilies.length || result.unloadedVisibleFonts.length) result.failures.push("Visible fonts did not load");
    if (!result.loadedFontFamilies.length) result.failures.push("No registered web font loaded");
    if (result.duplicateIds.length) result.failures.push("Duplicate IDs");
    if (result.brokenImages.length) result.failures.push("Broken or unfinished images");
    if (result.missingAnchorTargets.length) result.failures.push("Missing internal anchor targets");
    if (pageErrors.length || consoleErrors.length) result.failures.push("Browser JavaScript/console errors");
    if (scenario.design.artDirection) {
      if (result.renderedDesign.materialScene !== scenario.design.artDirection.scene || result.renderedDesign.materialLayout !== scenario.design.artDirection.layout) result.failures.push("Saved material direction not reflected by renderer");
    } else if (result.renderedDesign.template !== scenario.design.templateId || result.renderedDesign.hero !== scenario.design.composition.heroLayout || result.renderedDesign.surface !== scenario.design.composition.surfaceStyle || result.renderedDesign.composition !== "parametric") result.failures.push("Saved bounded design not reflected by renderer");
    if (scenario.purpose === "greeting") {
      if (result.nativeRsvpForms) result.failures.push("Personal greeting rendered a native RSVP form");
      if (result.calendarLinks.length) result.failures.push("Personal greeting rendered calendar actions");
      if (result.eventSections.some((section) => ["date", "countdown", "venue", "timeline", "dressCode", "rsvp"].includes(section))) result.failures.push("Personal greeting rendered an event section");
      if (invitationLanguage.test(result.visibleText)) result.failures.push("Personal greeting contains guest-invitation language");
    }
    delete result.visibleText;
    if (width === 390 || width === 1280) {
      result.screenshots = [`${scenario.key}-${width}-hero.png`];
      if (width === 390) {
        result.screenshots.unshift(`${scenario.key}-390-full.png`);
        await page.screenshot({ path: path.join(output, result.screenshots[0]), fullPage: true });
      }
      await page.screenshot({ path: path.join(output, `${scenario.key}-${width}-hero.png`) });
    }
  } catch (error) { result.failures.push(error.message); }
  finally { await page.close(); }
  report.pages.push(result);
  report.failures.push(...result.failures.map((message) => ({ scenario: scenario.key, width, message })));
  console.log(`${result.failures.length ? "FAIL" : "PASS"} PAGE ${scenario.key} ${width}`);
}

function histogram(key, values) {
  return [key, values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] || 0) + 1 }), {})];
}

function markdownReport() {
  const lines = [
    "# Local platform design acceptance", "", `- Mode: **${report.mode}**`,
    `- Result: **${report.success ? "PASS" : "FAIL"}**`,
    `- Generation POSTs: ${report.generationPosts}; successful generations in this run: ${report.generationsSucceeded}; existing generations reused: ${report.reusedGenerations || 0}; browser generation attempts blocked: ${report.blockedBrowserGenerationPosts}.`,
    ...(report.sourceReport ? [`- Original API/generation evidence: [source report](${report.sourceReport}).`] : []),
    `- API scenarios: ${report.apiChecks.length}/${report.expectedScenarios}; browser pages: ${report.pages.length}/${report.expectedPages}.`,
    "- Mobile pages use Chromium touch emulation, reduced motion and widths 320, 390 and 430. Desktop width is 1280.", "",
    "| Scenario | Template | Hero | Font | Surface | Mobile evidence | Desktop opening |", "| --- | --- | --- | --- | --- | --- | --- |",
    ...report.apiChecks.map((item) => `| ${item.name} | ${item.design.templateId} | ${(item.design.artDirection?.layout ?? item.design.composition?.heroLayout)} | ${item.design.fontPairId} | ${(item.design.artDirection?.scene ?? item.design.composition?.surfaceStyle)} | [Full page](${item.scenario}-390-full.png) | [Opening](${item.scenario}-1280-hero.png) |`),
    "", "## Scope and limits", "", ...report.limitations.map((text) => `- ${text}`),
    "", "## Token distribution", "", "```json", JSON.stringify(report.designHistogram, null, 2), "```", "",
    "## Failures", "", ...(report.failures.length ? report.failures.map((failure) => `- ${failure.scenario || "harness"}${failure.width ? ` (${failure.width}px)` : ""}: ${failure.message}`) : ["No automated failures. Subjective visual approval remains separate."]),
    "", "Raw browser observations and API assertions are in [report.json](report.json). All event data is fictional. QA accounts and drafts remain only in the isolated local data directory.", "",
  ];
  return lines.join("\n");
}

await mkdir(output, { recursive: true });
try {
  const ready = [];
  if (recheckPath) {
    const source = JSON.parse(await readFile(recheckPath, "utf8"));
    assert.ok(["live-ai", "authored-fixtures"].includes(source.mode), "Recheck requires an original generation/fixture report");
    assert.equal(source.apiChecks.length, scenarios.length, "Source report must contain all completed API scenarios");
    for (const scenario of scenarios) {
      const original = source.apiChecks.find((item) => item.scenario === scenario.key);
      assert.ok(original && /^[a-z0-9-]+$/.test(original.slug), "Source scenario must have a safe published slug");
      const savedContent = JSON.parse(await readFile(path.join(path.dirname(recheckPath), `${scenario.key}-draft.json`), "utf8"));
      const current = (await api(`/api/platform/public/${original.slug}`)).invitation;
      assert.deepEqual(current.content, savedContent, `${scenario.key}: published snapshot differs from original evidence`);
      const checked = { ...original, assertionsSource: report.sourceReport, currentAssertions: { publishedSnapshotUnchanged: true } };
      report.apiChecks.push(checked);
      if (original.generation?.status === "succeeded") report.reusedGenerations++;
      ready.push({ ...scenario, ...checked });
      await writeFile(path.join(output, `${scenario.key}-draft.json`), JSON.stringify(current.content, null, 2) + "\n");
      console.log(`PASS READ-ONLY SNAPSHOT ${scenario.key}`);
    }
  } else {
    const tag = randomUUID();
    const registration = await request("/api/platform/auth/register", {
      method: "POST", body: { name: "Fictional Design QA", email: `design-${tag}@example.test`, password: randomUUID() + randomUUID() },
    });
    const cookie = registration.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie, "Registration must establish an authenticated local session");
    // Intentional sequential loop: live AI concurrency is exactly one.
    for (const scenario of scenarios) {
      try { ready.push(await checkScenario(scenario, cookie)); }
      catch (error) { report.failures.push({ scenario: scenario.key, message: error.message }); console.log(`FAIL API ${scenario.key}: ${error.message}`); }
    }
  }
  report.designHistogram = Object.fromEntries([
    histogram("template", report.apiChecks.map((item) => item.design.templateId)),
    histogram("hero", report.apiChecks.map((item) => (item.design.artDirection?.layout ?? item.design.composition?.heroLayout))),
    histogram("font", report.apiChecks.map((item) => item.design.fontPairId)),
    histogram("surface", report.apiChecks.map((item) => (item.design.artDirection?.scene ?? item.design.composition?.surfaceStyle))),
  ]);
  const { chromium } = await import(pathToFileURL(playwrightModule).href);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.QA_CHROME_EXECUTABLE ? { executablePath: process.env.QA_CHROME_EXECUTABLE } : {}) });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", serviceWorkers: "block" });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 844 }, isMobile: false, hasTouch: false, reducedMotion: "reduce", serviceWorkers: "block" });
  for (const context of [mobile, desktop]) {
    await context.route("**/*", async (route) => {
      if (isGenerationPost(route.request().url(), route.request().method())) {
        report.blockedBrowserGenerationPosts++;
        await route.fulfill({ status: 409, json: { error: "Browser generation is disabled during local design QA" } });
      } else await route.continue();
    });
  }
  for (const scenario of ready) for (const width of widths) await inspectPage(scenario, width, width <= 430 ? mobile : desktop);
  assert.equal(report.generationPosts, liveAi ? scenarios.length : 0, "Unexpected generation POST count");
  assert.equal(report.blockedBrowserGenerationPosts, 0, "Unexpected browser generation attempt");
  assert.equal(report.apiChecks.length, scenarios.length, "Not all API scenarios completed");
  assert.equal(report.pages.length, report.expectedPages, "Not all browser checks completed");
} catch (error) { report.failures.push({ scenario: "harness", message: error.message }); }
finally {
  await browser?.close();
  report.success = report.failures.length === 0;
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(path.join(output, "README.md"), markdownReport());
  console.log(JSON.stringify({ success: report.success, mode: report.mode, generationPosts: report.generationPosts, generationsSucceeded: report.generationsSucceeded, pages: report.pages.length, failures: report.failures.length, report: path.join(output, "report.json") }));
  if (!report.success) process.exitCode = 1;
}
