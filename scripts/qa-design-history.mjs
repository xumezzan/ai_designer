import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Historical Sculpted Garden recovery/history acceptance; broader native designs
// and greeting intent are covered by qa-platform-designs.mjs and qa-platform-wizard.mjs.
// All generation requests are intercepted. Authentication, draft persistence
// and design-history operations use the isolated local API, with no paid calls.
const base = process.env.PLATFORM_QA_BASE_URL || "http://127.0.0.1:4310";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
assert.ok(process.env.QA_PLAYWRIGHT_MODULE, "Set QA_PLAYWRIGHT_MODULE");
const phase = process.env.PLATFORM_QA_PHASE || "all";
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME_EXECUTABLE, headless: true, args: ["--no-sandbox"] });
const directory = path.resolve("docs/platform-qa/history-local");
await mkdir(directory, { recursive: true });
const checks = [];
const errors = [];
const requests = [];
let generationPosts = 0;
let generationGets = 0;
let invitation;
let mockJob;

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  async function api(endpoint, options = {}) {
    const response = await context.request.fetch(`${base}/api/platform${endpoint}`, {
      ...options,
      headers: { Origin: base, ...options.headers },
    });
    const body = await response.json();
    assert.ok(response.ok(), `${endpoint}: ${response.status()} ${JSON.stringify(body)}`);
    return body;
  }
  async function currentRecord() {
    return (await api(`/invitations/${invitation.id}`)).invitation;
  }
  async function openEditor() {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator(".pf-invitation-row").filter({ hasText: invitation.draft.title }).getByRole("button", { name: "Редактировать", exact: true }).click();
    await page.locator(".pf-editor[open]").waitFor();
    await page.locator(".pf-ai-refine").waitFor();
  }
  async function closeEditor() {
    await page.locator('.pf-editor-header button[aria-label="Закрыть"]').click();
    await page.locator(".pf-editor").waitFor({ state: "detached" });
    invitation = await currentRecord();
  }
  await api("/auth/register", { method: "POST", data: { name: "History QA", email: `history-${randomUUID()}@example.test`, password: randomUUID() + randomUUID() } });
  const draft = {
    title: `История QA ${randomUUID().slice(0, 8)}`, templateId: "sculpted-garden", paletteId: "ivory", fontPairId: "editorial",
    eventType: "wedding", locale: "ru", names: ["QA София", "QA Александр"],
    date: { day: "2027-06-19", time: "17:00", timezone: "Asia/Tashkent", showCountdown: true },
    greeting: "Свежий текст владельца", story: "Наша актуальная история", venue: { name: "QA Garden", address: "Ташкент" },
    timeline: [{ time: "17:00", title: "Встреча гостей" }], closing: "С любовью от владельца",
    enabledSections: ["opening", "greeting", "story", "date", "venue", "timeline", "rsvp", "closing"], media: [],
  };
  invitation = (await api("/invitations", { method: "POST", data: { draft } })).invitation;
  const generationPattern = `**/api/platform/invitations/${invitation.id}/generate*`;
  await page.route(generationPattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST") {
      generationPosts += 1;
      const payload = request.postDataJSON();
      const now = new Date().toISOString();
      mockJob = { requestId: payload.requestId, status: "running", createdAt: now, updatedAt: now };
      requests.push({ kind: "generation-post", requestId: payload.requestId });
      await route.fulfill({ status: 502, json: { error: { message: "QA transport interruption" } } });
      return;
    }
    generationGets += 1;
    if (url.searchParams.get("latest") === "1") {
      await route.fulfill({ status: 200, json: { generation: mockJob ? { job: mockJob } : null } });
      return;
    }
    requests.push({ kind: "generation-get", requestId: url.searchParams.get("requestId") });
    const current = await currentRecord();
    await route.fulfill({ status: 200, json: { job: { ...mockJob, status: "succeeded", summary: "QA recovered result" }, invitation: current, previousDraft: draft } });
  });
  page.on("request", (request) => {
    if (request.method() === "PATCH" && new URL(request.url()).pathname.endsWith(`/invitations/${invitation.id}`)) {
      requests.push({ kind: "draft-patch", title: request.postDataJSON().draft.title });
    }
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith(`/invitations/${invitation.id}/design-history`)) {
      requests.push({ kind: "history-post", action: request.postDataJSON().action });
    }
  });
  if (phase === "all" || phase === "recovery") {
    await openEditor();
    await page.locator(".pf-ai-refine textarea").fill("Спокойные фарфоровые цветы в тёплой светлой композиции.");
    await page.locator(".pf-ai-refine").getByRole("button", { name: "Создать оформление", exact: true }).click();
    const statusButton = page.locator(".pf-ai-refine").getByRole("button", { name: "Проверить статус", exact: true });
    await statusButton.waitFor();
    const manualTitle = "Правка непосредственно перед восстановлением";
    const from = requests.length;
    await page.locator(".pf-editor-fields").getByLabel("Название для вас", { exact: true }).fill(manualTitle);
    await statusButton.click();
    await page.locator(".pf-ai-refine").getByRole("button", { name: "Создать оформление", exact: true }).waitFor();
    assert.equal(await page.locator(".pf-editor-fields").getByLabel("Название для вас", { exact: true }).inputValue(), manualTitle);
    const stored = await currentRecord();
    assert.equal(stored.draft.title, manualTitle);
    const sequence = requests.slice(from);
    assert.ok(sequence.findIndex((item) => item.kind === "draft-patch") >= 0);
    assert.ok(sequence.findIndex((item) => item.kind === "draft-patch") < sequence.findIndex((item) => item.kind === "generation-get"));
    assert.equal(generationPosts, 1, "Recovery must never repeat a paid POST");
    checks.push("A manual edit inside the autosave debounce survives recovered success; PATCH completes before GET");
    await closeEditor();
    const now = new Date().toISOString();
    mockJob = { requestId: randomUUID(), status: "running", createdAt: now, updatedAt: now };
    await page.evaluate(() => sessionStorage.clear());
    await openEditor();
    await page.locator(".pf-ai-refine").getByRole("button", { name: "Проверить статус", exact: true }).waitFor();
    assert.equal(generationPosts, 1);
    checks.push("Reopened editor discovers a server-side running job with empty sessionStorage and no new POST");
    await page.locator(".pf-ai-refine").getByRole("button", { name: "Проверить статус", exact: true }).click();
    await page.locator(".pf-ai-refine").getByRole("button", { name: "Создать оформление", exact: true }).waitFor();
    assert.equal(generationPosts, 1);
    checks.push("Discovered job completes via GET without a duplicate generation request");
    await page.screenshot({ path: path.join(directory, "recovery-390.png"), fullPage: true });
    await closeEditor();
    mockJob = undefined;
  }
  if (phase === "all" || phase === "history") {
    async function waitForRecord(predicate) {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const record = await currentRecord();
        if (predicate(record)) return record;
        await page.waitForTimeout(100);
      }
      throw new Error("Expected persisted record change did not arrive");
    }
    async function historyTab() {
      await page.getByRole("tab", { name: /Версии/ }).click();
      await page.locator(".pf-design-history").waitFor();
      await page.locator(".pf-design-history-loading").waitFor({ state: "detached" });
    }
    const firstLabel = "Первый фарфоровый вариант";
    await openEditor();
    await historyTab();
    await page.locator(".pf-design-history-save input").fill(firstLabel);
    const saveBefore = (await currentRecord()).updatedAt;
    await page.locator(".pf-design-history").getByRole("button", { name: "Сохранить оформление", exact: true }).click();
    await page.locator(".pf-design-history-card").filter({ hasText: firstLabel }).waitFor();
    assert.equal((await currentRecord()).updatedAt, saveBefore);
    checks.push("Manual design save persists a named history entry without changing the invitation revision");

    await page.getByRole("tab", { name: /Оформление/ }).click();
    await page.getByRole("button", { name: "Пыльная роза", exact: true }).click();
    await waitForRecord((record) => record.draft.paletteId === "rose");
    await page.locator(".pf-editor-actions").getByRole("button", { name: /Опубликовать|Обновить публикацию/ }).click();
    const published = await waitForRecord((record) => record.status === "published");
    const publicBefore = (await api(`/public/${published.slug}`)).invitation;
    await historyTab();
    const firstCard = page.locator(".pf-design-history-card").filter({ hasText: firstLabel });
    const previewBefore = await currentRecord();
    const patchCount = requests.filter((item) => item.kind === "draft-patch").length;
    await firstCard.click();
    await page.locator(".pf-history-preview-notice").waitFor();
    const frame = page.frameLocator('.pf-preview-viewport iframe');
    await frame.locator('.sg-invitation[data-palette="ivory"]').waitFor();
    await page.waitForTimeout(900);
    assert.equal((await currentRecord()).updatedAt, previewBefore.updatedAt);
    assert.equal((await currentRecord()).draft.paletteId, "rose");
    assert.equal(requests.filter((item) => item.kind === "draft-patch").length, patchCount);
    assert.equal(await page.locator(".pf-editor-actions").getByRole("button", { name: "Обновить публикацию", exact: true }).isDisabled(), true);
    checks.push("Selecting history previews in the actual iframe without a PATCH, draft revision change or publication");
    await page.locator(".pf-history-preview-notice").getByRole("button", { name: "Показать мой черновик", exact: true }).click();
    await page.locator(".pf-design-history-selection").waitFor({ state: "detached" });
    await frame.locator('.sg-invitation[data-palette="rose"]').waitFor();
    assert.equal(await page.locator(".pf-editor-actions").getByRole("button", { name: "Обновить публикацию", exact: true }).isEnabled(), true);
    checks.push("Cancelling historical preview resets the selected card and returns the current draft");

    await page.getByRole("tab", { name: /Основное/ }).click();
    const freshTitle = "Новейшие данные перед возвратом оформления";
    const restoreSequenceStart = requests.length;
    await page.locator(".pf-editor-fields").getByLabel("Название для вас", { exact: true }).fill(freshTitle);
    await historyTab();
    await page.locator(".pf-design-history-card").filter({ hasText: firstLabel }).click();
    const restoreButton = page.locator(".pf-design-history-selection").getByRole("button", { name: "Вернуть оформление", exact: true });
    await restoreButton.evaluate((element) => { element.click(); element.click(); });
    const restored = await waitForRecord((record) => record.draft.paletteId === "ivory");
    await page.locator(".pf-design-history-selection").waitFor({ state: "detached" });
    assert.equal(restored.draft.title, freshTitle);
    for (const field of ["names", "date", "greeting", "story", "venue", "timeline", "closing", "media", "enabledSections"]) {
      assert.deepEqual(restored.draft[field], published.draft[field], `Restore altered event field: ${field}`);
    }
    assert.deepEqual(restored.published, published.published);
    assert.deepEqual((await api(`/public/${published.slug}`)).invitation, publicBefore);
    const restoreSequence = requests.slice(restoreSequenceStart);
    assert.equal(restoreSequence.filter((item) => item.kind === "history-post" && item.action === "restore").length, 1, "Double click duplicated restore POST");
    assert.ok(restoreSequence.findIndex((item) => item.kind === "draft-patch") < restoreSequence.findIndex((item) => item.kind === "history-post" && item.action === "restore"));
    checks.push("Restore flushes the latest unsaved facts, changes only design, keeps the published snapshot and deduplicates rapid clicks");

    const historyAfter = await api(`/invitations/${invitation.id}/design-history`);
    const rollback = historyAfter.versions.find((version) => version.source === "before-restore" && version.design.paletteId === "rose");
    assert.ok(rollback, "Previous unsaved design was not checkpointed");
    await page.locator(".pf-design-history-card").filter({ hasText: rollback.label }).click();
    await page.locator(".pf-design-history-selection").getByRole("button", { name: "Вернуть оформление", exact: true }).click();
    const undone = await waitForRecord((record) => record.draft.paletteId === "rose");
    assert.equal(undone.draft.title, freshTitle);
    assert.deepEqual(undone.published, published.published);
    checks.push("Automatic before-restore checkpoint supports durable undo without changing current facts or guest publication");
    await closeEditor();
    await openEditor();
    await historyTab();
    await page.locator(".pf-design-history-card").filter({ hasText: firstLabel }).waitFor();
    checks.push("Named history entries survive closing and reopening the editor");
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await page.evaluate(() => {
        const history = document.querySelector(".pf-design-history");
        return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, historyWidth: history.clientWidth, historyScrollWidth: history.scrollWidth };
      });
      assert.equal(layout.documentWidth, width);
      assert.ok(layout.historyScrollWidth <= layout.historyWidth + 1, `History overflow at ${width}`);
      if (width === 390) await page.locator(".pf-editor").screenshot({ path: path.join(directory, "history-390.png") });
    }
    checks.push("History and its controls fit 320/390/430px without horizontal overflow");
  }
  if (phase === "artwork") {
    const refs = [];
    for (const name of ["portrait", "wide"]) {
      const buffer = await readFile(path.resolve(`public/artwork/sculpted-garden/${name}.webp`));
      const uploaded = await api(`/invitations/${invitation.id}/media`, {
        method: "POST", multipart: { file: { name: `${name}.webp`, mimeType: "image/webp", buffer } },
      });
      refs.push(uploaded.media);
    }
    const now = new Date().toISOString();
    const requestId = randomUUID();
    const variants = refs.map((artwork, index) => ({
      key: `generation:${requestId}:${index ? "after" : "before"}`,
      reference: { kind: "generation", requestId, phase: index ? "after" : "before" },
      source: index ? "generated" : "before-generation",
      createdAt: now,
      label: index ? "Результат ИИ · QA" : "До генерации · QA",
      design: { templateId: "sculpted-garden", paletteId: "ivory", fontPairId: "editorial", artwork },
    }));
    await page.route(`**/api/platform/invitations/${invitation.id}/design-history*`, async (route) => {
      assert.equal(route.request().method(), "GET", "The source preview check must not mutate history");
      await route.fulfill({ status: 200, json: { versions: variants } });
    });
    invitation = (await api(`/invitations/${invitation.id}/publish`, { method: "POST", data: { expectedUpdatedAt: invitation.updatedAt } })).invitation;
    const original = await currentRecord();
    const guestBefore = (await api(`/public/${invitation.slug}`)).invitation;
    await openEditor();
    await page.getByRole("tab", { name: /Версии/ }).click();
    await page.locator(".pf-design-history-card").filter({ hasText: variants[0].label }).waitFor();
    const from = requests.length;
    const frame = page.frameLocator('.pf-preview-viewport iframe');
    for (const variant of variants) {
      await page.locator(".pf-design-history-card").filter({ hasText: variant.label }).click();
      await frame.locator(`.sg-hero-art img[src="${variant.design.artwork.src}"]`).first().waitFor();
      const state = await frame.locator(".sg-invitation").evaluate((element) => ({
        art: [...element.querySelectorAll(".sg-hero-art img")].map((image) => image.getAttribute("src")),
        heading: element.querySelector("h1").textContent,
        text: element.textContent,
      }));
      assert.ok(state.art.every((src) => src === variant.design.artwork.src));
      assert.match(state.heading, /QA София/);
      assert.match(state.heading, /QA Александр/);
      assert.ok(state.text.includes(original.draft.greeting));
      assert.ok(state.text.includes(original.draft.venue.name));
      assert.deepEqual(await currentRecord(), original);
    }
    await page.waitForTimeout(900);
    assert.equal(requests.slice(from).filter((item) => item.kind === "draft-patch" || item.kind === "history-post").length, 0);
    assert.deepEqual((await api(`/public/${invitation.slug}`)).invitation, guestBefore);
    assert.equal(generationPosts, 0);
    checks.push("Before-generation and generated history cards independently preview their owner-uploaded artwork sources");
    checks.push("Both artwork previews preserve live names, greeting and venue without PATCH, history mutation, paid generation or publication change");
    await page.locator(".pf-editor").screenshot({ path: path.join(directory, "artwork-sources-390.png") });
  }
  const report = { generatedAt: new Date().toISOString(), phase, paidCalls: 0, checks, errors, generationPosts, generationGets, invitationId: invitation.id };
  await writeFile(path.join(directory, `report-${phase}.json`), JSON.stringify(report, null, 2) + "\n");
  assert.equal(errors.length, 0);
  console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(path.join(directory, `failure-${phase}.json`), JSON.stringify({ message: error.message, checks, errors, generationPosts, generationGets, requests, invitationId: invitation?.id }, null, 2));
  throw error;
} finally {
  await browser.close();
}
