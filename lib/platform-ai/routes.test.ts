import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let directory: string;
const origin = "http://localhost:3000";
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "platform-ai-route-"));
  vi.stubEnv("PLATFORM_DATA_DIR", directory);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.resetModules();
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  await rm(directory, { recursive: true, force: true });
});
function request(id: string, cookie?: string, body?: unknown, source = origin) {
  return new Request(`${origin}/api/platform/invitations/${id}/generate`, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: source, ...(cookie ? { cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

it("protects paid mutations with auth, CSRF, owner scope and input validation before calling providers", async () => {
  const { platformService } = await import("@/lib/platform/service");
  const { createEmptyDraft } = await import("@/lib/platform/schema");
  const { NativeInvitationAiProvider } = await import("./provider");
  const plan = vi.spyOn(NativeInvitationAiProvider.prototype, "plan");
  const artwork = vi.spyOn(NativeInvitationAiProvider.prototype, "createArtwork");
  const { POST } = await import("@/app/api/platform/invitations/[id]/generate/route");
  const owner = await platformService.auth.register({ name: "Host", email: "host@example.com", password: "valid-password-123" });
  const other = await platformService.auth.register({ name: "Other", email: "other@example.com", password: "valid-password-123" });
  const cookie = `invitation_session=${owner.sessionToken}`;
  const invitation = await platformService.createInvitation(owner.user.id, createEmptyDraft("sculpted-garden"));
  const context = { params: Promise.resolve({ id: invitation.id }) };
  const body = { requestId: randomUUID(), expectedUpdatedAt: invitation.updatedAt, brief: "Спокойный скульптурный сад с фарфоровыми цветами." };
  expect((await POST(request(invitation.id, undefined, body), context)).status).toBe(401);
  expect((await POST(request(invitation.id, cookie, body, "https://attacker.example"), context)).status).toBe(403);
  expect((await POST(request(invitation.id, `invitation_session=${other.sessionToken}`, body), context)).status).toBe(404);
  expect((await POST(request(invitation.id, cookie, { ...body, requestId: "invalid" }), context)).status).toBe(400);
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  const unconfigured = await POST(request(invitation.id, cookie, body), context);
  expect(unconfigured.status).toBe(503);
  expect(await unconfigured.json()).toMatchObject({ error: { code: "AI_NOT_CONFIGURED" } });
  expect(plan).not.toHaveBeenCalled();
  expect(artwork).not.toHaveBeenCalled();
});

it("returns 202 for running duplicates, recovers the owner-scoped job and never exposes private planning state", async () => {
  const { platformService } = await import("@/lib/platform/service");
  const { createEmptyDraft } = await import("@/lib/platform/schema");
  const { NativeInvitationAiProvider } = await import("./provider");
  vi.stubEnv("OPENAI_API_KEY", "");
  let entered!: () => void;
  let release!: () => void;
  const called = new Promise<void>((resolve) => { entered = resolve; });
  const planner = vi.spyOn(NativeInvitationAiProvider.prototype, "plan").mockImplementation(async () => {
    entered();
    await new Promise<void>((resolve) => { release = resolve; });
    return {
      themeId: "modern-editorial", sectionOrder: "programme-first", motionPreset: "still",
      greeting: "Дорогие друзья!", closing: "Ждём вас!", summary: "Журнальная обложка и программа перед местом встречи",
    };
  });
  const artwork = vi.spyOn(NativeInvitationAiProvider.prototype, "createArtwork");
  const { POST, GET } = await import("@/app/api/platform/invitations/[id]/generate/route");
  const owner = await platformService.auth.register({ name: "Host", email: "host@example.com", password: "valid-password-123" });
  const cookie = `invitation_session=${owner.sessionToken}`;
  const invitation = await platformService.createInvitation(owner.user.id, createEmptyDraft("sculpted-garden"));
  const context = { params: Promise.resolve({ id: invitation.id }) };
  const body = { requestId: randomUUID(), expectedUpdatedAt: invitation.updatedAt, brief: "Спокойный скульптурный сад с фарфоровыми цветами." };
  const first = POST(request(invitation.id, cookie, body), context);
  await called;
  const duplicate = await POST(request(invitation.id, cookie, body), context);
  expect(duplicate.status).toBe(202);
  expect(await duplicate.json()).toMatchObject({ job: { requestId: body.requestId, status: "running" } });
  release();
  const completed = await first;
  expect(completed.status).toBe(200);
  const response = await completed.json();
  expect(response).toMatchObject({
    job: { status: "succeeded" },
    invitation: { draft: {
      templateId: "editorial", paletteId: "modern-editorial",
      composition: { sectionOrder: "programme-first", motionPreset: "still" },
    } },
  });
  expect(response.invitation.draft.artwork).toBeUndefined();
  expect(JSON.stringify(response)).not.toMatch(/artworkPrompt|briefHash|callAttempts|test-openai-key/);
  const jobRequest = new Request(`${origin}/api/platform/invitations/${invitation.id}/generate?requestId=${body.requestId}`, { headers: { cookie } });
  const recovered = await GET(jobRequest, context);
  expect(recovered.status).toBe(200);
  expect(recovered.headers.get("cache-control")).toBe("no-store");
  expect(await recovered.json()).toMatchObject({ job: { status: "succeeded" }, previousDraft: invitation.draft });
  expect((await GET(new Request(jobRequest.url), context)).status).toBe(401);
  const latestRequest = new Request(`${origin}/api/platform/invitations/${invitation.id}/generate?latest=1`, { headers: { cookie } });
  expect(await (await GET(latestRequest, context)).json()).toMatchObject({ generation: { job: { requestId: body.requestId, status: "succeeded" } } });
  expect((await GET(new Request(latestRequest.url), context)).status).toBe(401);
  expect(planner).toHaveBeenCalledTimes(1);
  expect(artwork).not.toHaveBeenCalled();
});
