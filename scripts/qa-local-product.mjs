import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Acceptance data must live in an isolated local server, never a customer store.
// Prefer an optimized local build (next build, then next start). Development
// debug serialization is part of the raw HTML assertion and is not exempted.
const base = new URL(process.env.PLATFORM_QA_BASE_URL || "http://127.0.0.1:4310");
assert.ok(["http:", "https:"].includes(base.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && !base.username && !base.password, "Use a loopback test server");
assert.ok(process.env.QA_PLAYWRIGHT_MODULE, "Set QA_PLAYWRIGHT_MODULE to the installed Playwright entrypoint");
const output = path.resolve(process.env.PLATFORM_QA_OUTPUT_DIR || "docs/local-product-qa/latest");
await mkdir(output, { recursive: true });
const report = { generatedAt: new Date().toISOString(), base: base.origin, paidCalls: 0, blockedGenerationPosts: 0, apiChecks: [], pages: [], failures: [], limitations: ["Uses authored local templates; paid AI generation and new generated artwork are not tested.", "Chromium with reduced motion; real phones, Safari, animation quality and subjective visual quality need review.", "Clipping candidates and small controls are observations that need manual review."] };
const generation = (url, method) => method === "POST" && /\/generate\/?$/.test(new URL(url, base).pathname);
async function request(endpoint, { method = "GET", body, cookie, expected = 200, headers = {} } = {}) {
  assert.ok(!generation(endpoint, method), "Node QA must never send a generation POST");
  const url = new URL(endpoint, base);
  assert.equal(url.origin, base.origin);
  const response = await fetch(url, { method, redirect: "manual", headers: { Origin: base.origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, `${method} ${endpoint}: ${await response.clone().text().then((text) => text.slice(0, 200))}`);
  return response;
}
const api = async (endpoint, options) => (await request(endpoint, options)).json();
let browser;
try {
  const tag = randomUUID();
  const registered = await request("/api/platform/auth/register", { method: "POST", body: { name: "Local Product QA", email: `product-${tag}@example.test`, password: randomUUID() + randomUUID() } });
  const cookie = registered.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Registration must establish an authenticated session");
  const scenarios = [
    { key: "wedding", templateId: "sculpted-garden", locale: "ru", names: ["София", "Александр"], greeting: "Дорогие родные и друзья! Приглашаем разделить наш счастливый день.", closing: "С любовью, София и Александр" },
    { key: "birthday", templateId: "botanical", locale: "ru", names: ["Александра-Екатерина Константиновна"], greeting: "Дорогие друзья! Буду рада отметить день рождения вместе с вами.", closing: "Пусть этот вечер станет тёплым воспоминанием" },
    { key: "anniversary", templateId: "classic", locale: "uz-latn", names: ["Dilnoza", "Jahongir"], greeting: "Aziz do‘stlar! Oilamizning yubiley oqshomiga sizni taklif etamiz.", closing: "Sizni kutamiz, aziz yaqinlar!" },
  ];
  for (const scenario of scenarios) {
    const hidden = scenario.key === "birthday";
    const draft = { title: `Local QA ${scenario.key}`, templateId: scenario.templateId, paletteId: hidden ? "sage" : "ivory", fontPairId: "classic", eventType: scenario.key, locale: scenario.locale, names: scenario.names, date: { day: "2028-06-19", time: "18:00", timezone: "Asia/Tashkent", showCountdown: true }, greeting: "Initial draft", story: hidden ? "QA HIDDEN STORY" : scenario.greeting, venue: { name: "QA Garden", address: scenario.locale === "ru" ? "Ташкент, вымышленный адрес для проверки" : "Toshkent, namuna manzil" }, timeline: [{ time: "18:00", title: scenario.locale === "ru" ? "Встреча гостей" : "Mehmonlarni kutib olish" }], dressCode: { title: hidden ? "QA HIDDEN DRESS" : "Garden palette", swatches: ["#ADB89E", "#E5DCCB"] }, closing: scenario.closing, enabledSections: ["opening", "greeting", "date", "venue", "timeline", "rsvp", "closing", ...(hidden ? [] : ["story", "dressCode"])], media: [] };
    let record = (await api("/api/platform/invitations", { method: "POST", body: { draft }, cookie, expected: 201 })).invitation;
    const endpoint = `/api/platform/invitations/${record.id}`;
    draft.greeting = scenario.greeting;
    record = (await api(endpoint, { method: "PATCH", body: { draft, expectedUpdatedAt: record.updatedAt }, cookie })).invitation;
    assert.equal((await api(endpoint, { cookie })).invitation.draft.greeting, scenario.greeting);
    record = (await api(`${endpoint}/publish`, { method: "POST", body: { expectedUpdatedAt: record.updatedAt }, cookie })).invitation;
    const publicPath = `/api/platform/public/${record.slug}`;
    const published = (await api(publicPath)).invitation;
    assert.equal(published.content.greeting, scenario.greeting);
    if (hidden) { assert.ok(!JSON.stringify(published).includes("QA HIDDEN")); assert.ok(!(await (await request(`/i/${record.slug}`)).text()).includes("QA HIDDEN")); }
    await api(endpoint, { method: "PATCH", body: { draft: { ...draft, greeting: "UNPUBLISHED QA CHANGE" }, expectedUpdatedAt: record.updatedAt }, cookie });
    assert.deepEqual((await api(publicPath)).invitation, published, "Draft edits changed the public snapshot");
    const guest = await api(`${publicPath}/rsvp`, { method: "POST", body: { name: "Fictional QA Guest", status: "yes", guestCount: 2 } });
    assert.match(guest.editToken, /^[a-f0-9]{64}$/);
    await api(`${publicPath}/rsvp`, { method: "POST", body: { name: "Fictional QA Guest", status: "maybe", guestCount: 1, editToken: guest.editToken } });
    const responses = (await api(`${endpoint}/rsvps`, { cookie })).responses;
    assert.equal(responses.length, 1); assert.equal(responses[0].status, "maybe"); assert.equal(responses[0].guestCount, 1);
    const rejected = await api(`${publicPath}/rsvp`, { method: "POST", body: { name: "Rejected Cross-site Guest", status: "yes", guestCount: 1 }, headers: { Origin: "https://foreign.example.test" }, expected: 403 });
    assert.equal(rejected.error.code, "INVALID_ORIGIN");
    Object.assign(scenario, { slug: record.slug, id: record.id, hidden });
    report.apiChecks.push({ scenario: scenario.key, invitationId: record.id, slug: record.slug, saveReload: true, publish: true, snapshotIsolated: true, rsvpPersistedAndEdited: true, foreignOriginRejected: true, disabledContentAbsent: hidden ? true : null });
  }
  const { chromium } = await import(pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href);
  browser = await chromium.launch({ executablePath: process.env.QA_CHROME_EXECUTABLE, headless: true, args: ["--no-sandbox"] });
  async function context(options = {}) {
    const result = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block", ...options });
    await result.route("**/*", async (route) => {
      if (generation(route.request().url(), route.request().method())) { report.blockedGenerationPosts++; await route.fulfill({ status: 409, json: { error: "Generation disabled during local QA" } }); }
      else await route.continue();
    });
    return result;
  }
  const mobile = await context({ isMobile: true, hasTouch: true });
  const desktop = await context({ isMobile: false, hasTouch: false });
  async function inspect(key, endpoint, width, hidden = false) {
    const page = await (width <= 430 ? mobile : desktop).newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const result = { key, width, endpoint, isMobile: width <= 430, hasTouch: width <= 430, pageErrors: errors };
    try {
      await page.setViewportSize({ width, height: 844 });
      result.httpStatus = (await page.goto(new URL(endpoint, base).href, { waitUntil: "networkidle" })).status();
      await page.evaluate(() => document.fonts.ready);
      const opener = page.locator("dialog[open] .cover-open");
      if (await opener.count()) { await opener.click(); await page.locator("dialog[open]").waitFor({ state: "hidden" }); }
      for (const image of await page.locator('img[loading="lazy"]').all()) if (await image.isVisible()) await image.scrollIntoViewIfNeeded();
      await page.evaluate(async () => { await Promise.all([...document.images].filter((image) => image.complete).map((image) => image.decode().catch(() => {}))); window.scrollTo(0, 0); });
      Object.assign(result, await page.evaluate(() => {
        const visible = (element) => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
        const ids = [...document.querySelectorAll("[id]")].filter(visible).map((element) => element.id);
        const label = (element) => (element.getAttribute("aria-label") || element.textContent || element.getAttribute("name") || element.tagName).trim().slice(0, 100);
        return {
          documentWidth: document.documentElement.scrollWidth,
          duplicateVisibleIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
          brokenLoadedImages: [...document.images].filter((image) => image.currentSrc && image.complete && !image.naturalWidth).map((image) => image.currentSrc),
          missingAnchorTargets: [...document.querySelectorAll("a[href]")].filter(visible).flatMap((anchor) => { const url = new URL(anchor.href, location.href); if (!url.hash || url.origin !== location.origin || url.pathname !== location.pathname) return []; try { return document.getElementById(decodeURIComponent(url.hash.slice(1))) ? [] : [anchor.getAttribute("href")]; } catch { return [anchor.getAttribute("href")]; } }),
          sections: [...document.querySelectorAll("[data-section]")].map((element) => element.dataset.section),
          observations: { shortControls: [...document.querySelectorAll("button,a,input,select,textarea")].filter(visible).filter((element) => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(label), textClippingCandidates: [...document.querySelectorAll("h1,h2,h3,p,label,button,a")].filter(visible).filter((element) => element.scrollWidth > element.clientWidth + 2 && element.clientWidth > 0).map(label) },
        };
      }));
      if (key === "published-birthday") {
        // Root overflow alone misses a long patronymic split in the middle.
        result.longNameUnbroken = await page.locator('[data-studio-field="hosts.0.name"]').first().evaluate((element) => {
          const text = element.firstChild;
          const word = "Константиновна";
          const start = text?.textContent?.indexOf(word) ?? -1;
          if (!text || start < 0) return false;
          const range = document.createRange();
          range.setStart(text, start);
          range.setEnd(text, start + word.length);
          return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size === 1;
        });
      }
      if (width === 390) {
        result.screenshots = [`${key}-390-full.png`, `${key}-390-hero.png`];
        await page.screenshot({ path: path.join(output, result.screenshots[0]), fullPage: true });
        await page.screenshot({ path: path.join(output, result.screenshots[1]) });
      }
      result.failures = [result.httpStatus !== 200 && `HTTP ${result.httpStatus}`, result.documentWidth > width + 1 && "Horizontal root overflow", result.duplicateVisibleIds.length && "Duplicate visible IDs", result.brokenLoadedImages.length && "Broken loaded images", result.missingAnchorTargets.length && "Missing internal anchor targets", errors.length && "Page errors", hidden && result.sections.includes("story") && "Disabled story rendered", hidden && result.sections.includes("dressCode") && "Disabled dress code rendered"].filter(Boolean);
      if (result.longNameUnbroken === false) result.failures.push("Long patronymic split inside a word");
    } catch (error) { result.failures = [error.message]; }
    finally { await page.close(); }
    report.pages.push(result);
    report.failures.push(...result.failures.map((message) => ({ key, width, message })));
    console.log(`${result.failures.length ? "FAIL" : "PASS"} ${key} ${width}`);
  }
  for (const template of ["classic", "botanical", "nocturne", "heritage", "sculpted-garden"]) for (const width of [320, 390, 430, 1280]) await inspect(`demo-${template}-ru`, `/dashboard/preview?template=${template}&locale=ru`, width);
  await inspect("demo-sculpted-garden-uz-latn", "/dashboard/preview?template=sculpted-garden&locale=uz-latn", 390);
  for (const scenario of scenarios) for (const width of [320, 390, 430]) await inspect(`published-${scenario.key}`, `/i/${scenario.slug}`, width, scenario.hidden);
  const noJsContext = await context({ javaScriptEnabled: false, isMobile: true, hasTouch: true });
  try {
    const scenario = scenarios[0];
    const page = await noJsContext.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    assert.equal((await page.goto(`${base.origin}/i/${scenario.slug}`, { waitUntil: "networkidle" })).status(), 200);
    assert.ok(await page.locator("h1").isVisible()); assert.match(await page.locator("h1").innerText(), /София/);
    const form = page.locator('form[action$="/rsvp"]');
    assert.equal(await form.count(), 1); assert.ok(await form.isVisible());
    await form.locator('[name="name"]').fill("Native Fictional QA Guest");
    await form.locator('label:has(input[name="status"][value="no"])').click();
    assert.ok(await form.locator('[name="status"][value="no"]').isChecked());
    const [submitted] = await Promise.all([page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/rsvp")), page.waitForURL(/rsvp=saved/), form.locator('button[type="submit"]').click()]);
    assert.equal(submitted.status(), 303);
    const submittedHeaders = await submitted.request().allHeaders();
    assert.equal(submittedHeaders.origin, base.origin, "Native form must preserve its same-origin CSRF proof");
    assert.ok((await api(`/api/platform/invitations/${scenario.id}/rsvps`, { cookie })).responses.some((guest) => guest.name === "Native Fictional QA Guest" && guest.status === "no"));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, "native-rsvp-no-js-390.png"), fullPage: true });
    report.nativeNoJavaScript = { readable: true, formSubmitted: true, origin: submittedHeaders.origin, httpStatus: 303, persisted: true, isMobile: true, hasTouch: true, pageErrors: errors, screenshot: "native-rsvp-no-js-390.png" };
  } catch (error) { report.failures.push({ key: "native-no-js", message: error.message }); }
  finally { await noJsContext.close(); }
  assert.equal(report.blockedGenerationPosts, 0, "Unexpected generation attempts were blocked");
} catch (error) { report.failures.push({ key: "harness", message: error.message }); }
finally {
  await browser?.close();
  report.success = report.failures.length === 0;
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ success: report.success, pages: report.pages.length, failures: report.failures.length, paidCalls: 0, report: path.join(output, "report.json") }));
  if (!report.success) process.exitCode = 1;
}
