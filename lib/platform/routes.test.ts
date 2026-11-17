import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createEmptyDraft } from "./schema";

let directory: string;
const origin = "http://localhost:3000";
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "invitation-routes-"));
  vi.stubEnv("PLATFORM_DATA_DIR", directory);
  vi.resetModules();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  await rm(directory, { recursive: true, force: true });
});
function request(
  url: string,
  cookie?: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  return new Request(`${origin}/api/platform/${url}`, {
    method,
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

it("exercises registration cookie, owner API, publication snapshots, upload visibility, RSVP and logout", async () => {
  const registration = await import("@/app/api/platform/auth/register/route");
  const login = await registration.POST(
    request("auth/register", undefined, {
      name: "Host",
      email: "host@example.com",
      password: "valid-password123",
    }),
  );
  expect(login.status).toBe(200);
  expect(login.headers.get("set-cookie")).toContain("HttpOnly");
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  expect(await login.json()).toMatchObject({ user: { name: "Host" } });
  const me = await import("@/app/api/platform/auth/me/route");
  expect(await (await me.GET(request("auth/me", cookie))).json()).toMatchObject(
    { user: { email: "host@example.com" } },
  );

  const list = await import("@/app/api/platform/invitations/route");
  expect((await list.GET(request("invitations"))).status).toBe(401);
  const draft = {
    ...createEmptyDraft(),
    names: ["Host"],
    date: {
      day: "2027-06-12",
      time: "18:00",
      timezone: "Asia/Tashkent",
      showCountdown: true,
    },
    venue: { name: "Garden", address: "Tashkent" },
  };
  const created = await list.POST(request("invitations", cookie, { draft }));
  expect(created.status).toBe(201);
  const { invitation } = await created.json();
  const context = { params: Promise.resolve({ id: invitation.id }) };
  const publicContext = { params: Promise.resolve({ slug: invitation.slug }) };
  const publicRoute = await import("@/app/api/platform/public/[slug]/route");
  expect(
    (await publicRoute.GET(request(`public/${invitation.slug}`), publicContext))
      .status,
  ).toBe(404);

  const otherLogin = await registration.POST(
    request("auth/register", undefined, {
      name: "Other",
      email: "other@example.com",
      password: "valid-password123",
    }),
  );
  const otherCookie = otherLogin.headers.get("set-cookie")!.split(";")[0];
  const edit = await import("@/app/api/platform/invitations/[id]/route");
  expect(
    (
      await edit.GET(
        request(`invitations/${invitation.id}`, otherCookie),
        context,
      )
    ).status,
  ).toBe(404);

  const upload = await import(
    "@/app/api/platform/invitations/[id]/media/route"
  );
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array(bytes)], "photo.png", { type: "image/png" }),
  );
  const uploaded = await upload.POST(
    new Request(`${origin}/api/platform/invitations/${invitation.id}/media`, {
      method: "POST",
      headers: { origin, cookie },
      body: form,
    }),
    context,
  );
  expect(uploaded.status).toBe(201);
  const { media } = await uploaded.json();
  const mediaRoute = await import("@/app/api/platform/media/[id]/route");
  const mediaContext = { params: Promise.resolve({ id: media.id }) };
  expect(
    (await mediaRoute.GET(request(`media/${media.id}`), mediaContext)).status,
  ).toBe(404);
  expect(
    (
      await mediaRoute.GET(request(`media/${media.id}`, cookie), mediaContext)
    ).headers.get("content-type"),
  ).toBe("image/webp");
  const saved = await edit.PATCH(
    request(
      `invitations/${invitation.id}`,
      cookie,
      {
        draft: { ...draft, media: [media] },
        expectedUpdatedAt: invitation.updatedAt,
      },
      "PATCH",
    ),
    context,
  );
  expect(saved.status).toBe(200);
  const publish = await import(
    "@/app/api/platform/invitations/[id]/publish/route"
  );
  expect(
    (
      await publish.POST(
        request(`invitations/${invitation.id}/publish`, cookie, {}),
        context,
      )
    ).status,
  ).toBe(200);
  const publicData = await (
    await publicRoute.GET(request(`public/${invitation.slug}`), publicContext)
  ).json();
  expect(publicData.invitation.content.media).toEqual([media]);
  expect(publicData.invitation).not.toHaveProperty("ownerId");
  expect(
    (await mediaRoute.GET(request(`media/${media.id}`), mediaContext)).status,
  ).toBe(200);

  const rsvp = await import("@/app/api/platform/public/[slug]/rsvp/route");
  const response = await rsvp.POST(
    request(`public/${invitation.slug}/rsvp`, undefined, {
      name: "Guest",
      status: "yes",
      guestCount: 2,
    }),
    publicContext,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    response: { name: "Guest", status: "yes", guestCount: 2 },
    editToken: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  const native = await rsvp.POST(
    new Request(`${origin}/api/platform/public/${invitation.slug}/rsvp`, {
      method: "POST",
      headers: { origin, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        name: "Native guest",
        status: "maybe",
        guestCount: "1",
      }),
    }),
    publicContext,
  );
  expect(native.status).toBe(303);
  expect(native.headers.get("location")).toBe(
    `${origin}/i/${invitation.slug}?rsvp=saved`,
  );
  const invalidNative = await rsvp.POST(
    new Request(`${origin}/api/platform/public/${invitation.slug}/rsvp`, {
      method: "POST",
      headers: { origin, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: "", status: "invalid" }),
    }),
    publicContext,
  );
  expect(invalidNative.status).toBe(303);
  expect(invalidNative.headers.get("location")).toContain("rsvp=error");
  const guestList = await import(
    "@/app/api/platform/invitations/[id]/rsvps/route"
  );
  expect(
    (
      await guestList.GET(
        request(`invitations/${invitation.id}/rsvps`, otherCookie),
        context,
      )
    ).status,
  ).toBe(404);
  const guests = await (
    await guestList.GET(
      request(`invitations/${invitation.id}/rsvps`, cookie),
      context,
    )
  ).json();
  expect(guests.responses).toHaveLength(2);
  expect(JSON.stringify(guests)).not.toContain("Token");

  const archive = await import(
    "@/app/api/platform/invitations/[id]/archive/route"
  );
  expect(
    (
      await archive.POST(
        request(`invitations/${invitation.id}/archive`, cookie, {}),
        context,
      )
    ).status,
  ).toBe(200);
  expect(
    (await mediaRoute.GET(request(`media/${media.id}`), mediaContext)).status,
  ).toBe(404);
  expect(
    (await publicRoute.GET(request(`public/${invitation.slug}`), publicContext))
      .status,
  ).toBe(404);
  const logout = await import("@/app/api/platform/auth/logout/route");
  expect((await logout.POST(request("auth/logout", cookie, {}))).status).toBe(
    200,
  );
  expect(await (await me.GET(request("auth/me", cookie))).json()).toEqual({
    user: null,
  });
});

it("rejects CSRF before registration and keeps malformed requests bounded", async () => {
  const registration = await import("@/app/api/platform/auth/register/route");
  const csrf = await registration.POST(
    new Request(`${origin}/api/platform/auth/register`, {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "x",
        email: "x@example.com",
        password: "valid-password123",
      }),
    }),
  );
  expect(csrf.status).toBe(403);
  const oversized = await registration.POST(
    new Request(`${origin}/api/platform/auth/register`, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: "x".repeat(65 * 1024),
    }),
  );
  expect(oversized.status).toBe(413);
  const malformed = await registration.POST(
    new Request(`${origin}/api/platform/auth/register`, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: "not-json",
    }),
  );
  expect(malformed.status).toBe(400);
});

it("never sends disabled section facts or the internal project title through the public API", async () => {
  const { platformService } = await import("./service");
  const { user } = await platformService.auth.register({
    name: "Host",
    email: "privacy@example.com",
    password: "valid-password123",
  });
  const draft = {
    ...createEmptyDraft(),
    title: "secret-internal-title",
    names: ["Host", "Partner"],
    enabledSections: ["opening" as const],
    date: {
      day: "2027-06-12",
      time: "18:00",
      timezone: "Asia/Tashkent",
      showCountdown: true,
    },
    greeting: "secret-greeting",
    story: "secret-story",
    closing: "secret-closing",
    venue: { name: "secret-venue", address: "secret-address" },
    timeline: [{ time: "17:00", title: "secret-timeline" }],
    dressCode: { title: "secret-dresscode", swatches: ["#AABBCC"] },
  };
  const invitation = await platformService.createInvitation(user.id, draft);
  await platformService.publishInvitation(user.id, invitation.id);
  const publicRoute = await import("@/app/api/platform/public/[slug]/route");
  const response = await publicRoute.GET(request(`public/${invitation.slug}`), {
    params: Promise.resolve({ slug: invitation.slug }),
  });
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).not.toContain("secret-");
  expect(body).not.toContain("2027-06-12");
  expect(JSON.parse(body).invitation.content.title).toBe("Host & Partner");
});
