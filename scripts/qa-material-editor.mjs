import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// A real owner/editor/autosave round trip. All provider requests are blocked.
const base = new URL(process.env.PLATFORM_QA_BASE_URL || "http://127.0.0.1:4315");
assert.ok(["http:", "https:"].includes(base.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && !base.username && !base.password, "Use an isolated loopback test server");
const output = path.resolve(process.env.PLATFORM_QA_OUTPUT_DIR || "docs/material-studio/editor-acceptance");
const assets = path.resolve(process.env.MATERIAL_QA_ASSET_DIR || "public/artwork/material-studio");
const playwrightModule = process.env.QA_PLAYWRIGHT_MODULE || path.join(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs");
const generationPost = (url, method) => method === "POST" && /\/generate\/?$/.test(new URL(url, base).pathname);
const report = { generatedAt: new Date().toISOString(), base: base.origin, mode: "real-material-editor-autosave", providerGenerationPosts: 0, blockedBrowserGenerationPosts: 0, externalRequests: [], pageErrors: [], assertions: {}, failures: [], limitations: ["One fictional owner and authored silk greeting fixture; no AI provider is invoked.", "Chromium desktop editor at 1280px with reduced motion. Physical phones and Safari are not tested."] };
let browser;
let context;
async function api(endpoint, { method = "GET", body, multipart, expected = 200 } = {}) {
  const url = new URL(endpoint, base);
  assert.equal(url.origin, base.origin);
  assert.ok(!generationPost(url, method), "The QA API client must never send a generation POST");
  // Chromium stores Secure cookies on loopback HTTP; APIRequestContext can
  // omit them. Forward only this isolated context's same-origin local cookies.
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const cookie = (await context.cookies()).filter((item) => {
    const domain = item.domain.replace(/^\./, "").replace(/^\[|\]$/g, "").toLowerCase();
    return domain === host && (url.pathname === item.path || url.pathname.startsWith(item.path.endsWith("/") ? item.path : `${item.path}/`));
  }).map((item) => `${item.name}=${item.value}`).join("; ");
  const response = await context.request.fetch(url.href, { method, headers: { Origin: base.origin, ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { data: body } : {}), ...(multipart ? { multipart } : {}), failOnStatusCode: false, timeout: 60_000 });
  assert.equal(response.status(), expected, `${method} ${url.pathname}: ${(await response.text()).slice(0, 400)}`);
  return response.json();
}
async function eventually(check, message, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { const result = await check(); if (result) return result; } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}
await mkdir(output, { recursive: true });
try {
  const { chromium } = await import(pathToFileURL(playwrightModule).href);
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.QA_CHROME_EXECUTABLE ? { executablePath: process.env.QA_CHROME_EXECUTABLE } : {}) });
  context = await browser.newContext({ viewport: { width: 1280, height: 960 }, reducedMotion: "reduce", serviceWorkers: "block" });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (generationPost(url, route.request().method())) { report.blockedBrowserGenerationPosts++; await route.fulfill({ status: 409, json: { error: "AI generation is disabled during editor QA" } }); }
    else if (url.origin !== base.origin) { report.externalRequests.push({ url: url.href, method: route.request().method() }); await route.abort("blockedbyclient"); }
    else await route.continue();
  });
  await api("/api/platform/auth/register", { method: "POST", body: { name: "Fictional Material Editor QA", email: `material-editor-${randomUUID()}@example.test`, password: randomUUID() + randomUUID() } });
  const draft = { title: "Material editor local QA", purpose: "greeting", headline: "Амире с теплом", templateId: "classic", paletteId: "ivory", fontPairId: "ceremony", artDirection: { title: "Шёлковое послание", scene: "silk", layout: "editorial" }, eventType: "birthday", locale: "ru", names: ["Амира"], date: { day: "", time: "", timezone: "Asia/Tashkent", showCountdown: false }, greeting: "Амира, желаю радости и вдохновения в каждом дне.", venue: { name: "", address: "" }, timeline: [], closing: "С теплом и добрыми пожеланиями", enabledSections: ["opening", "greeting", "closing"], media: [] };
  let record = (await api("/api/platform/invitations", { method: "POST", body: { draft }, expected: 201 })).invitation;
  const endpoint = `/api/platform/invitations/${record.id}`;
  const artwork = (await api(`${endpoint}/media`, { method: "POST", multipart: { file: { name: "silk.webp", mimeType: "image/webp", buffer: await readFile(path.join(assets, "silk.webp")) } }, expected: 201 })).media;
  record = (await api(endpoint, { method: "PATCH", body: { draft: { ...record.draft, artwork }, expectedUpdatedAt: record.updatedAt } })).invitation;
  record = (await api(`${endpoint}/publish`, { method: "POST", body: { expectedUpdatedAt: record.updatedAt } })).invitation;
  const originalDraft = structuredClone(record.draft);
  const publicPath = `/api/platform/public/${record.slug}`;
  const published = (await api(publicPath)).invitation;
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  await page.goto(new URL("/dashboard", base).href, { waitUntil: "networkidle" });
  const row = page.locator(".pf-invitation-row").filter({ hasText: draft.title });
  await row.getByRole("button", { name: "Редактировать", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Редактировать", exact: true });
  await editor.waitFor();
  await editor.getByRole("tab", { name: /Оформление/ }).click();
  const layout = editor.getByLabel(/^Композиция сайта/);
  assert.equal(await layout.inputValue(), "editorial");
  const frame = page.frameLocator("dialog.pf-editor iframe");
  await frame.locator('.material-site[data-scene="silk"][data-layout="editorial"]').waitFor();
  await layout.selectOption("immersive");
  await frame.locator('.material-site[data-scene="silk"][data-layout="immersive"]').waitFor();
  const changed = await eventually(async () => { const value = (await api(endpoint)).invitation; return value.draft.artDirection.layout === "immersive" ? value : false; }, "Composition selector did not autosave");
  assert.deepEqual(changed.draft, { ...originalDraft, artDirection: { ...originalDraft.artDirection, layout: "immersive" } }, "Changing layout replaced artwork or supplied facts");
  assert.deepEqual((await api(publicPath)).invitation, published, "Editor layout autosave changed the published snapshot");
  report.assertions.selectorChangesActualPreview = true;
  report.assertions.layoutAutosavedWithoutOtherChanges = true;
  await editor.getByRole("button", { name: "Закрыть", exact: true }).click();
  await editor.waitFor({ state: "hidden" });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".pf-invitation-row").filter({ hasText: draft.title }).getByRole("button", { name: "Редактировать", exact: true }).click();
  await editor.waitFor();
  await editor.getByRole("tab", { name: /Оформление/ }).click();
  assert.equal(await layout.inputValue(), "immersive");
  await frame.locator('.material-site[data-scene="silk"][data-layout="immersive"]').waitFor();
  const afterReopen = (await api(endpoint)).invitation;
  assert.deepEqual(afterReopen.draft.artwork, artwork, "Closing/reopening editor lost the original artwork");
  report.assertions.reopenPreservesLayoutAndArtwork = true;
  await page.screenshot({ path: path.join(output, "layout-after-reopen.png") });
  await layout.selectOption("editorial");
  await frame.locator('.material-site[data-scene="silk"][data-layout="editorial"]').waitFor();
  const restored = await eventually(async () => { const value = (await api(endpoint)).invitation; return value.draft.artDirection.layout === "editorial" ? value : false; }, "Restoring original layout did not autosave");
  assert.deepEqual(restored.draft, originalDraft, "Restored layout differs from the initial material draft");
  assert.deepEqual((await api(publicPath)).invitation, published, "Editor session changed the frozen public snapshot");
  report.assertions.originalLayoutRestored = true;
  report.assertions.publishedSnapshotUnchanged = true;
  report.invitationId = record.id;
  report.slug = record.slug;
  await page.screenshot({ path: path.join(output, "layout-restored.png") });
  await editor.getByRole("button", { name: "Закрыть", exact: true }).click();
  assert.equal(report.blockedBrowserGenerationPosts, 0, "Unexpected browser generation attempt");
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.pageErrors, []);
} catch (error) { report.failures.push(error.message); }
finally {
  await browser?.close();
  report.success = report.failures.length === 0;
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(path.join(output, "README.md"), ["# Проверка редактора материального сайта", "", `Результат: **${report.success ? "PASS" : "FAIL"}**. AI POST: 0.`, "", "Проверен реальный сценарий владельца: Оформление → Композиция сайта → изменение editorial/immersive → автосохранение → закрытие и повторное открытие → возврат исходной композиции. Материал и факты сохраняются, опубликованный снимок не меняется.", "", ...report.limitations.map((value) => `- ${value}`), "", "- [Редактор после повторного открытия](layout-after-reopen.png)", "- [Исходная композиция восстановлена](layout-restored.png)", "- [Полный отчёт](report.json)", "", ...(report.failures.length ? report.failures.map((value) => `- Ошибка: ${value}`) : ["Автоматических ошибок не обнаружено."]), ""].join("\n"));
  console.log(JSON.stringify({ success: report.success, assertions: report.assertions, failures: report.failures }, null, 2));
  if (!report.success) process.exitCode = 1;
}
