import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// UI integration acceptance only. Every browser generation POST is fulfilled
// locally; the harness API client refuses generation POSTs altogether.
const base = new URL(process.env.PLATFORM_QA_BASE_URL || "http://127.0.0.1:4312");
assert.ok(["http:", "https:"].includes(base.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && !base.username && !base.password, "Use an isolated loopback QA server");
const output = path.resolve(process.env.PLATFORM_QA_OUTPUT_DIR || "docs/local-product-qa/wizard-local");
const playwrightModule = process.env.QA_PLAYWRIGHT_MODULE || path.join(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs");
const report = {
  generatedAt: new Date().toISOString(), base: base.origin, mode: "browser-ui-with-mocked-generation",
  providerGenerationPostsForwarded: 0, interceptedGenerationPosts: 0, scenarios: [], failures: [], pageErrors: [],
  limitations: [
    "Generation responses are mocked at the browser route. No provider or real AI design quality is tested, and no paid generation POST reaches the server.",
    "Registration, wizard draft persistence, editor rendering, appearance autosave and reload use the actual isolated local platform API.",
    "Mobile Chromium touch emulation at 390 pixels; physical phones, Safari and production hosting are outside this check.",
  ],
};
const variants = {
  birthday: { key: "birthday-invitation", name: "Алина", purpose: "invitation", templateId: "modern", paletteId: "terracotta", fontPairId: "modernist", ornamentSetId: "graphic-ribbon", composition: { heroLayout: "typographic-poster", photoShape: "sharp", surfaceStyle: "flat", spacingScale: "compact-poster", typographyAccent: "oversized-display", decorConfig: { placement: "background-pattern", density: "subtle", opacity: 0.3 }, sectionVariants: { countdown: "inline", program: "cards", venue: "split", gallery: "filmstrip", rsvp: "minimal" } } },
  greeting: { key: "personal-greeting", name: "Амира", purpose: "greeting", templateId: "editorial", paletteId: "ivory", fontPairId: "editorial", ornamentSetId: "editorial-rules", composition: { heroLayout: "split-editorial", photoShape: "sharp", surfaceStyle: "flat", spacingScale: "airy-gallery", typographyAccent: "italic-serif-accent", decorConfig: { placement: "dividers", density: "subtle", opacity: 0.3 }, sectionVariants: { countdown: "date-led", program: "editorial-list", venue: "split", gallery: "editorial", rsvp: "split" } } },
};
let browser;
let active;
let context;
const generationPost = (url, method) => method === "POST" && /\/generate\/?$/.test(new URL(url).pathname);

async function api(endpoint, { method = "GET", body, expected = 200 } = {}) {
  const url = new URL(endpoint, base);
  assert.equal(url.origin, base.origin);
  assert.ok(!generationPost(url, method), "The QA API client must never send a generation POST");
  // Chromium accepts Secure cookies on loopback HTTP, while its API request
  // client can omit them. Reuse only this context's same-origin local cookies;
  // never log their values or forward them outside the guarded QA origin.
  // cookies(httpOrigin) also excludes Secure loopback cookies, so filter the
  // isolated context's cookie jar by this already-guarded host and request path.
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const cookie = (await context.cookies()).filter((item) => {
    const domain = item.domain.replace(/^\./, "").replace(/^\[|\]$/g, "").toLowerCase();
    return domain === host && (url.pathname === item.path || url.pathname.startsWith(item.path.endsWith("/") ? item.path : `${item.path}/`));
  }).map((item) => `${item.name}=${item.value}`).join("; ");
  const response = await context.request.fetch(url.href, { method, headers: { Origin: base.origin, ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { data: body } : {}), failOnStatusCode: false, timeout: 60_000 });
  assert.equal(response.status(), expected, `${method} ${url.pathname}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function eventually(check, message, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { const result = await check(); if (result) return result; } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

async function fulfillGeneration(route) {
  report.interceptedGenerationPosts++;
  try {
    assert.ok(active, "Unexpected generation POST outside the wizard scenario");
    active.posts++;
    assert.equal(active.posts, 1, "Rapid clicks emitted more than one generation POST");
    const input = route.request().postDataJSON();
    assert.match(input.requestId, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i);
    assert.ok(input.brief.length >= 20 && input.brief.length <= 2000);
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    const endpoint = `/api/platform/invitations/${id}`;
    const before = (await api(endpoint)).invitation;
    assert.equal(input.expectedUpdatedAt, before.updatedAt);
    assert.equal(before.draft.eventType, "birthday");
    assert.equal(before.draft.purpose, active.purpose);
    assert.deepEqual(before.draft.names, [active.name], "A birthday/greeting needs one recipient rather than a forced couple");
    if (active.purpose === "greeting") {
      assert.equal(before.draft.date.day, "");
      assert.equal(before.draft.venue.name, "");
      assert.ok(!before.draft.enabledSections.some((section) => ["date", "venue", "timeline", "rsvp"].includes(section)));
    } else {
      assert.equal(before.draft.date.day, "2028-06-19");
      assert.equal(before.draft.date.time, "18:30");
      assert.equal(before.draft.venue.name, "Сад встреч");
    }
    const { templateId, paletteId, fontPairId, ornamentSetId, composition } = active;
    const draft = { ...before.draft, templateId, paletteId, fontPairId, ornamentSetId, composition, greeting: active.purpose === "greeting" ? "Амира, с днём рождения! Пусть каждый день приносит радость и вдохновение." : "Друзья, буду рада отпраздновать день рождения вместе с вами!", closing: "С теплом и самыми добрыми пожеланиями" };
    const after = (await api(endpoint, { method: "PATCH", body: { draft, expectedUpdatedAt: before.updatedAt } })).invitation;
    active.endpoint = endpoint;
    active.record = after;
    active.requestId = input.requestId;
    active.requestFacts = { eventType: before.draft.eventType, purpose: before.draft.purpose, names: before.draft.names, date: before.draft.date, venue: before.draft.venue };
    await route.fulfill({ status: 200, json: { job: { requestId: input.requestId, status: "succeeded", createdAt: before.updatedAt, updatedAt: after.updatedAt, summary: "Mocked browser UI fixture" }, invitation: after, previousDraft: before.draft } });
  } catch (error) {
    report.failures.push({ scenario: active?.key || "unexpected-generation", message: error.message });
    // Never continue a failed interception to the real provider endpoint.
    await route.fulfill({ status: 500, json: { error: { code: "QA_MOCK_FAILED", message: "Local QA generation mock failed" } } });
  }
}

async function assertPreview(page, scenario) {
  const frame = page.frameLocator("dialog.pf-editor iframe");
  await frame.locator(`[data-studio-template="${scenario.templateId}"]`).waitFor();
  await eventually(async () => (await frame.locator("[data-hero-layout]").first().getAttribute("data-hero-layout")) === scenario.composition.heroLayout, "Editor iframe did not show the chosen composition");
  const text = await frame.locator("body").innerText();
  assert.ok(text.includes(scenario.name));
  if (scenario.purpose === "greeting") {
    assert.equal(await frame.locator('form[action$="/rsvp"]').count(), 0);
    assert.equal(await frame.locator('[data-section="venue"], [data-section="countdown"]').count(), 0);
  } else {
    assert.ok(await frame.locator('time[datetime^="2028-06-19"]').count());
  }
  return frame;
}

async function runScenario(page, fixture) {
  active = { ...structuredClone(fixture), posts: 0 };
  await page.goto(new URL("/dashboard", base).href, { waitUntil: "networkidle" });
  const create = page.getByRole("button", { name: "Создать с ИИ", exact: true });
  await create.click();
  const wizard = page.getByRole("dialog", { name: "Ваш сайт с ИИ", exact: true });
  await wizard.waitFor();
  await wizard.getByLabel(/^Повод/).selectOption("birthday");
  await wizard.getByLabel(/^Что создаём/).selectOption(fixture.purpose);
  const recipient = wizard.getByLabel(/^Имя или название/);
  const next = wizard.getByRole("button", { name: "К оформлению", exact: true });
  assert.ok(await recipient.evaluate((element) => element.required));
  assert.ok(await next.isDisabled(), "An empty recipient must block moving forward");
  assert.equal(await wizard.getByLabel(/^Второе имя/).evaluate((element) => element.required), false);
  if (fixture.purpose === "greeting") {
    for (const label of [/^Дата(?:\s|$)/, /^Время(?:\s|$)/, /^Часовой пояс/, /^Место проведения/, /^Адрес/]) assert.equal(await wizard.getByLabel(label).count(), 0, `Greeting retained ${label}`);
    assert.ok(await wizard.getByText("Поздравление можно отправить по ссылке без даты, места и ответов гостей.", { exact: true }).isVisible());
  } else {
    await wizard.getByLabel(/^Дата(?:\s|$)/).fill("2028-06-19");
    await wizard.getByLabel(/^Время(?:\s|$)/).fill("18:30");
    await wizard.getByLabel(/^Место проведения/).fill("Сад встреч");
    await wizard.getByLabel(/^Адрес/).fill("Ташкент, вымышленный адрес QA");
  }
  await recipient.fill(fixture.name);
  assert.ok(await next.isEnabled(), "One recipient must be sufficient");
  await page.screenshot({ path: path.join(output, `${fixture.key}-390-wizard-facts.png`), fullPage: true });
  await next.click();
  await wizard.getByLabel("Каким вы видите ваш сайт?", { exact: true }).fill(fixture.purpose === "greeting" ? "Личное тёплое поздравление Амире с днём рождения, воздушная редакционная композиция без мероприятия и RSVP." : "Яркое приглашение на день рождения Алины, выразительная типографика и терракотовая графика. Сохраните имя, дату и место.");
  await page.screenshot({ path: path.join(output, `${fixture.key}-390-wizard-design.png`), fullPage: true });
  const generate = wizard.getByRole("button", { name: "Создать оформление", exact: true });
  await generate.evaluate((button) => { button.click(); button.click(); button.click(); });
  const editor = page.getByRole("dialog", { name: "Редактировать", exact: true });
  await editor.waitFor({ timeout: 30_000 });
  await assertPreview(page, active);
  assert.equal(active.posts, 1);
  assert.ok(active.record && active.requestId, "Intercepted generation must return a persisted fictional record");
  const originalFacts = { names: active.record.draft.names, date: active.record.draft.date, venue: active.record.draft.venue, purpose: active.record.draft.purpose, eventType: active.record.draft.eventType };
  const originalComposition = structuredClone(active.record.draft.composition);
  await editor.getByRole("tab", { name: /Оформление/ }).click();
  await editor.getByRole("button", { name: "Пыльная роза", exact: true }).click();
  // A serif replacement preserves even the editorial italic-serif accent.
  await editor.getByLabel(/^Типографика/).selectOption("ceremony");
  const persisted = await eventually(async () => {
    const record = (await api(active.endpoint)).invitation;
    return record.draft.paletteId === "rose" && record.draft.fontPairId === "ceremony" ? record : false;
  }, "Palette/font autosave did not persist");
  assert.deepEqual(persisted.draft.composition, originalComposition, "Appearance editing dropped the generated composition");
  assert.deepEqual({ names: persisted.draft.names, date: persisted.draft.date, venue: persisted.draft.venue, purpose: persisted.draft.purpose, eventType: persisted.draft.eventType }, originalFacts, "Appearance editing changed event facts");
  await editor.getByRole("button", { name: "Закрыть", exact: true }).click();
  await editor.waitFor({ state: "hidden" });
  await page.reload({ waitUntil: "networkidle" });
  const row = page.locator(".pf-invitation-row").filter({ hasText: fixture.name });
  await row.getByRole("button", { name: "Редактировать", exact: true }).click();
  await editor.waitFor();
  await assertPreview(page, active);
  await editor.getByRole("tab", { name: /Оформление/ }).click();
  assert.equal(await editor.getByRole("button", { name: "Пыльная роза", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await editor.getByLabel(/^Типографика/).inputValue(), "ceremony");
  const reloaded = (await api(active.endpoint)).invitation;
  assert.deepEqual(reloaded.draft.composition, originalComposition);
  await editor.locator(".pf-editor-preview").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, `${fixture.key}-390-editor.png`) });
  await editor.locator("iframe").screenshot({ path: path.join(output, `${fixture.key}-390-editor-iframe.png`) });
  report.scenarios.push({ key: fixture.key, invitationId: active.record.id, requestId: active.requestId, interceptedPosts: active.posts, requestFacts: active.requestFacts, assertions: { oneNameAccepted: true, emptyNameBlocked: true, greetingEventInputsHidden: fixture.purpose === "greeting" ? true : null, generatedEditorOpened: true, actualIframeRendered: true, rapidClicksUseSingleRequest: true, factsPreserved: true, paletteFontAutosaved: true, compositionSurvivesAppearanceAndReload: true }, screenshots: [`${fixture.key}-390-wizard-facts.png`, `${fixture.key}-390-wizard-design.png`, `${fixture.key}-390-editor.png`, `${fixture.key}-390-editor-iframe.png`] });
  await editor.getByRole("button", { name: "Закрыть", exact: true }).click();
  active = null;
  console.log(`PASS ${fixture.key}: mocked generation, real wizard/editor/autosave`);
}

await mkdir(output, { recursive: true });
try {
  const { chromium } = await import(pathToFileURL(playwrightModule).href);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.QA_CHROME_EXECUTABLE ? { executablePath: process.env.QA_CHROME_EXECUTABLE } : {}) });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", serviceWorkers: "block" });
  await context.route("**/*", async (route) => generationPost(route.request().url(), route.request().method()) ? fulfillGeneration(route) : route.continue());
  await api("/api/platform/auth/register", { method: "POST", body: { name: "Fictional Wizard QA", email: `wizard-${randomUUID()}@example.test`, password: randomUUID() + randomUUID() } });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  for (const fixture of Object.values(variants)) {
    try { await runScenario(page, fixture); }
    catch (error) { report.failures.push({ scenario: fixture.key, message: error.message }); break; }
  }
  if (report.scenarios.length === 2) {
    await page.getByLabel("Язык интерфейса / Interfeys tili", { exact: true }).selectOption("uz-latn");
    await page.getByRole("button", { name: "AI bilan yaratish", exact: true }).click();
    const uz = page.getByRole("dialog", { name: "AI bilan saytingiz", exact: true });
    await uz.getByLabel(/^Nima yaratamiz/).selectOption("greeting");
    await uz.getByLabel(/^Sabab/).selectOption("birthday");
    assert.ok(await uz.getByLabel(/^Ism yoki nom/).isVisible());
    assert.equal(await uz.getByLabel(/^Sana(?:\s|$)/).count(), 0);
    report.uzbekGreetingLabels = true;
    await page.screenshot({ path: path.join(output, "uzbek-greeting-390-wizard.png"), fullPage: true });
  }
  assert.equal(report.scenarios.length, 2, "Both wizard scenarios must complete");
  assert.equal(report.interceptedGenerationPosts, 2, "Exactly one mocked generation POST per scenario is expected");
  assert.deepEqual(report.pageErrors, [], "Browser JavaScript errors");
} catch (error) { report.failures.push({ scenario: "harness", message: error.message }); }
finally {
  await browser?.close();
  report.success = report.failures.length === 0;
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(path.join(output, "README.md"), ["# Local wizard UI acceptance", "", `Result: **${report.success ? "PASS" : "FAIL"}**. Mode: **mocked generation**.`, "", `Completed scenarios: ${report.scenarios.length}/2. Intercepted generation POSTs: ${report.interceptedGenerationPosts}. Provider POSTs forwarded: 0.`, "", ...report.limitations.map((text) => `- ${text}`), "", ...report.scenarios.flatMap((scenario) => [`## ${scenario.key}`, "", "Wizard → persisted draft → mocked generation → actual preview iframe → palette/font autosave → reload.", "", ...scenario.screenshots.map((file) => `- [${file}](${file})`), ""]), "## Failures", "", ...(report.failures.length ? report.failures.map((failure) => `- ${failure.scenario}: ${failure.message}`) : ["No automated failures."]), "", "Full assertions and fictional request facts: [report.json](report.json).", ""].join("\n"));
  console.log(JSON.stringify({ success: report.success, mode: report.mode, scenarios: report.scenarios.length, interceptedGenerationPosts: report.interceptedGenerationPosts, providerGenerationPostsForwarded: 0, failures: report.failures.length, report: path.join(output, "report.json") }));
  if (!report.success) process.exitCode = 1;
}
