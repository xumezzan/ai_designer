import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Exactly one paid generation request, explicitly enabled. Never retry a POST.
assert.equal(process.env.MATERIAL_QA_LIVE_AI, "1", "Set MATERIAL_QA_LIVE_AI=1 to enable one real planner + artwork acceptance request");
const base = new URL(process.env.PLATFORM_QA_BASE_URL || "http://127.0.0.1:4315");
assert.ok(["http:", "https:"].includes(base.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && !base.username && !base.password, "Use an isolated loopback server");
const output = path.resolve(process.env.PLATFORM_QA_OUTPUT_DIR || "docs/material-studio/live");
const report = { generatedAt: new Date().toISOString(), mode: "one-real-material-generation", base: base.origin, generationPosts: 0, success: false };
let cookie;
async function request(endpoint, { method = "GET", body, expected = [200], timeout = 180_000 } = {}) {
  const url = new URL(endpoint, base);
  assert.equal(url.origin, base.origin);
  if (method === "POST" && /\/generate$/.test(url.pathname)) {
    assert.equal(report.generationPosts, 0, "No generation POST retry is allowed");
    report.generationPosts++;
  }
  const response = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(timeout), headers: { Origin: base.origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.ok(expected.includes(response.status), `${method} ${url.pathname}: HTTP ${response.status}`);
  return response;
}
const api = async (endpoint, options) => (await request(endpoint, options)).json();
await mkdir(output, { recursive: true });
try {
  const tag = randomUUID();
  const registration = await request("/api/platform/auth/register", { method: "POST", body: { name: "Fictional Material Live QA", email: `material-live-${tag}@example.test`, password: randomUUID() + randomUUID() } });
  cookie = registration.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  const draft = { title: "PRIVATE QA LIVE TITLE", purpose: "greeting", templateId: "editorial", paletteId: "wine", fontPairId: "poetic", eventType: "birthday", locale: "ru", names: ["Лейла"], date: { day: "", time: "", timezone: "Asia/Tashkent", showCountdown: false }, greeting: "", venue: { name: "", address: "" }, timeline: [], closing: "", enabledSections: ["opening", "greeting", "closing"], media: [] };
  let invitation = (await api("/api/platform/invitations", { method: "POST", expected: [201], body: { draft } })).invitation;
  const endpoint = `/api/platform/invitations/${invitation.id}`;
  const requestId = randomUUID();
  report.invitationId = invitation.id;
  report.requestId = requestId;
  const brief = "Личное поздравление Лейле с днём рождения — чувственный винный шёлк, как индивидуальный сайт модного ателье. Богатый бордовый атлас со скульптурными складками и мягким боковым светом, глубокие тени и тёплая светлая антиква. Создайте новое оригинальное фоновое изображение и отдельную композицию сайта, не плоскую перекраску шаблона. Никаких свадебных формулировок, мероприятия, гостей, программы, даты, места и RSVP. Только заголовок, личные тёплые пожелания и красивое заключение; без выдуманных биографических фактов и отношений. Имя Лейла сохраните точно.";
  let result;
  try { result = await api(`${endpoint}/generate`, { method: "POST", expected: [200, 202], body: { requestId, expectedUpdatedAt: invitation.updatedAt, brief, referenceIds: [] } }); }
  catch (error) { report.postResponseUncertain = error.message; }
  const deadline = Date.now() + 6 * 60_000;
  while (!result || result.job.status === "running") {
    assert.ok(Date.now() < deadline, "Generation did not settle; POST was not retried");
    result = await api(`${endpoint}/generate?requestId=${requestId}`);
    if (result.job.status === "running") await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  report.jobStatus = result.job.status;
  assert.equal(result.job.status, "succeeded", result.job.error?.code || "Generation failed");
  invitation = result.invitation;
  assert.ok(invitation.draft.artDirection, "Real planner must return an individual material direction");
  assert.ok(invitation.draft.artwork, "Real generation must store new original artwork");
  assert.deepEqual(invitation.draft.names, draft.names);
  assert.deepEqual(invitation.draft.date, draft.date);
  assert.deepEqual(invitation.draft.venue, draft.venue);
  assert.deepEqual(invitation.draft.timeline, []);
  assert.equal(invitation.draft.purpose, "greeting");
  for (const field of ["headline", "greeting", "closing"]) assert.ok(invitation.draft[field]?.trim(), `Missing generated ${field}`);
  invitation = (await api(`${endpoint}/publish`, { method: "POST", body: { expectedUpdatedAt: invitation.updatedAt } })).invitation;
  const published = (await api(`/api/platform/public/${invitation.slug}`)).invitation;
  assert.equal((await request(published.content.artwork.src)).status, 200);
  assert.equal(published.content.title, "Лейла");
  report.slug = invitation.slug;
  report.url = new URL(`/i/${invitation.slug}`, base).href;
  report.design = { templateId: invitation.draft.templateId, paletteId: invitation.draft.paletteId, fontPairId: invitation.draft.fontPairId, artDirection: invitation.draft.artDirection, artwork: invitation.draft.artwork };
  report.assertions = { newOwnedArtwork: true, suppliedFactsPreserved: true, personalCopyFilled: true, published: true, noPostRetry: true };
  await writeFile(path.join(output, "published.json"), JSON.stringify(published.content, null, 2) + "\n");
  report.success = true;
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally { await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report)); }
