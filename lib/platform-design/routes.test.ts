import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let directory: string;
const origin = "http://localhost:3000";
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "invitation-design-route-"));
  vi.stubEnv("PLATFORM_DATA_DIR", directory);
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.resetModules();
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  await rm(directory, { recursive: true, force: true });
});
function request(id: string, cookie?: string, body?: unknown, source = origin, query = "") {
  return new Request(`${origin}/api/platform/invitations/${id}/design-history${query}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: source, ...(cookie ? { cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

it("requires an owner session, trusted mutation origin and validated input before touching design history", async () => {
  const { platformService } = await import("@/lib/platform/service");
  const { createEmptyDraft } = await import("@/lib/platform/schema");
  const { SESSION_COOKIE } = await import("@/lib/platform/auth");
  const { GET, POST } = await import("@/app/api/platform/invitations/[id]/design-history/route");
  const owner = await platformService.auth.register({ name: "Owner", email: "owner@example.com", password: "valid-password-123" });
  const other = await platformService.auth.register({ name: "Other", email: "other@example.com", password: "valid-password-123" });
  const cookie = `${SESSION_COOKIE}=${owner.sessionToken}`;
  const invitation = await platformService.createInvitation(owner.user.id, createEmptyDraft());
  const context = { params: Promise.resolve({ id: invitation.id }) };
  const body = { action: "save", expectedUpdatedAt: invitation.updatedAt };
  expect((await GET(request(invitation.id), context)).status).toBe(401);
  expect((await POST(request(invitation.id, undefined, body), context)).status).toBe(401);
  expect((await POST(request(invitation.id, cookie, body, "https://attacker.example"), context)).status).toBe(403);
  expect((await GET(request(invitation.id, `${SESSION_COOKIE}=${other.sessionToken}`), context)).status).toBe(404);
  expect((await POST(request(invitation.id, `${SESSION_COOKIE}=${other.sessionToken}`, body), context)).status).toBe(404);
  for (const input of [
    { action: "save" },
    { ...body, label: "" },
    { ...body, label: "x".repeat(81) },
    { ...body, design: { templateId: "arbitrary" } },
    { ...body, action: "restore", reference: { kind: "saved", versionId: "invalid" } },
  ]) expect((await POST(request(invitation.id, cookie, input), context)).status).toBe(400);
  expect(await platformService.store.transaction((state) => state.designVersions, false)).toEqual([]);
  expect(await platformService.store.transaction((state) => state.generationJobs, false)).toEqual([]);
});

it("saves and restores owner designs through no-store API responses without provider configuration or public publication changes", async () => {
  const { platformService } = await import("@/lib/platform/service");
  const { createEmptyDraft } = await import("@/lib/platform/schema");
  const { SESSION_COOKIE } = await import("@/lib/platform/auth");
  const { GET, POST } = await import("@/app/api/platform/invitations/[id]/design-history/route");
  const owner = await platformService.auth.register({ name: "Owner", email: "owner@example.com", password: "valid-password-123" });
  const cookie = `${SESSION_COOKIE}=${owner.sessionToken}`;
  const draft = { ...createEmptyDraft(), names: ["Host"], title: "Internal management copy", greeting: "Visible original copy", date: { day: "2027-06-12", time: "18:00", timezone: "Asia/Tashkent", showCountdown: true }, venue: { name: "Garden", address: "Tashkent" } };
  const invitation = await platformService.createInvitation(owner.user.id, draft);
  const published = await platformService.publishInvitation(owner.user.id, invitation.id, invitation.updatedAt);
  const context = { params: Promise.resolve({ id: invitation.id }) };
  const savedResponse = await POST(request(invitation.id, cookie, { action: "save", label: "Ceremony", expectedUpdatedAt: published.updatedAt }), context);
  expect(savedResponse.status).toBe(200);
  expect(await savedResponse.json()).toEqual({ invitation: published });
  const historyResponse = await GET(request(invitation.id, cookie), context);
  expect(historyResponse.headers.get("cache-control")).toBe("no-store");
  const history = await historyResponse.json();
  expect(history.versions).toHaveLength(1);
  expect(history.versions[0]).toMatchObject({ source: "saved", label: "Ceremony", design: { templateId: "classic", paletteId: "ivory" } });
  expect(JSON.stringify(history)).not.toMatch(/Internal management|Visible original|ownerId|generationJobs/);
  const edited = await platformService.updateInvitation(owner.user.id, invitation.id, { ...published.draft, names: ["Updated host"], greeting: "New text stays", paletteId: "rose" }, published.updatedAt);
  const restoreResponse = await POST(request(invitation.id, cookie, { action: "restore", reference: history.versions[0].reference, expectedUpdatedAt: edited.updatedAt }), context);
  expect(restoreResponse.status).toBe(200);
  const restored = (await restoreResponse.json()).invitation;
  expect(restored.draft).toMatchObject({ names: ["Updated host"], greeting: "New text stays", paletteId: "ivory" });
  expect(restored.published).toEqual(published.published);
  expect(restored.status).toBe("published");
  expect((await GET(request(invitation.id, cookie, undefined, origin, "?cursor=invalid"), context)).status).toBe(400);
  const repeated = await POST(request(invitation.id, cookie, { action: "restore", reference: history.versions[0].reference, expectedUpdatedAt: restored.updatedAt }), context);
  expect((await repeated.json()).invitation.updatedAt).toBe(restored.updatedAt);
  expect(await platformService.store.transaction((state) => state.generationJobs, false)).toEqual([]);
});
