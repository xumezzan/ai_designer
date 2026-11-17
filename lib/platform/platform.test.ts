import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { hashPassword, hashToken, verifyPassword } from "./auth";
import { PlatformStore } from "./store";
import { PlatformService } from "./service";
import {
  createEmptyDraft,
  InvitationDraftSchema,
  RsvpInputSchema,
  civilDateTimeToIso,
  publicSnapshotContent,
  toInvitationContent,
} from "./schema";
import {
  assertSameOrigin,
  clearSession,
  readBody,
  readJson,
  route,
  withSession,
} from "./http";
import { PlatformError } from "./errors";
import { resolveStudioComposition } from "@/registry/studioTemplates";

let directory: string;
let service: PlatformService;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "invitation-platform-"));
  service = new PlatformService(new PlatformStore(directory));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});
const readyDraft = () => ({
  ...createEmptyDraft(),
  names: ["Азиз", "Малика"],
  date: {
    day: "2027-06-12",
    time: "18:00",
    timezone: "Asia/Tashkent",
    showCountdown: true,
  },
  venue: { name: "Сад", address: "Ташкент" },
});
async function account(email = "owner@example.com") {
  return service.auth.register({
    name: "Owner",
    email,
    password: "valid-password-123",
  });
}

describe("platform credentials and sessions", () => {
  it("uses salted scrypt, verifies credentials and rejects malformed hashes", async () => {
    const first = await hashPassword("valid-password-123");
    const second = await hashPassword("valid-password-123");
    expect(first).not.toBe(second);
    expect(first).not.toContain("valid-password-123");
    expect(await verifyPassword("valid-password-123", first)).toBe(true);
    expect(await verifyPassword("wrong", first)).toBe(false);
    expect(await verifyPassword("wrong", "scrypt-v1$corrupt$corrupt")).toBe(
      false,
    );
  });
  it("persists safe user data and hashed opaque session tokens; logout revokes", async () => {
    const { user, sessionToken } = await account("OWNER@example.com");
    expect(user.email).toBe("owner@example.com");
    expect(user).not.toHaveProperty("passwordHash");
    expect(sessionToken).toMatch(/^[a-f0-9]{64}$/);
    const stored = await readFile(path.join(directory, "state.json"), "utf8");
    expect(stored).not.toContain(sessionToken);
    expect(stored).not.toContain("valid-password-123");
    expect(stored).toContain(hashToken(sessionToken));
    expect((await stat(path.join(directory, "state.json"))).mode & 0o777).toBe(
      0o600,
    );
    const restarted = new PlatformService(new PlatformStore(directory));
    expect(await restarted.auth.userForSession(sessionToken)).toEqual(user);
    await restarted.auth.logout(sessionToken);
    expect(await service.auth.userForSession(sessionToken)).toBeNull();
    expect(await service.auth.userForSession("invalid")).toBeNull();
  });
  it("enforces absolute session expiry and normalized email uniqueness", async () => {
    const { sessionToken } = await account();
    await expect(account("OWNER@example.com")).rejects.toMatchObject({
      status: 409,
    });
    await service.store.transaction((state) => {
      state.sessions[0].expiresAt = new Date(0).toISOString();
    });
    expect(await service.auth.userForSession(sessionToken)).toBeNull();
    const login = await service.auth.login({
      email: "OWNER@example.com",
      password: "valid-password-123",
    });
    expect(await service.auth.userForSession(login.sessionToken)).toEqual(
      login.user,
    );
  });
  it("validates before password work and limits repeated failed logins persistently", async () => {
    await expect(
      service.auth.register({
        name: "x",
        email: "x@example.com",
        password: "shortpass",
      }),
    ).rejects.toThrow();
    await expect(
      service.auth.register({
        name: "x",
        email: "x@example.com",
        password: "a".repeat(129),
      }),
    ).rejects.toThrow();
    for (let attempt = 0; attempt < 10; attempt++)
      await expect(
        service.auth.login({
          email: "unknown@example.com",
          password: "wrong-password",
        }),
      ).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    const restarted = new PlatformService(new PlatformStore(directory));
    await expect(
      restarted.auth.login({
        email: "unknown@example.com",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe("invitation ownership, persistence and publication", () => {
  it("protects all private resources with owner authorization", async () => {
    const owner = (await account()).user;
    const stranger = (await account("other@example.com")).user;
    const invitation = await service.createInvitation(owner.id, readyDraft());
    expect(await service.listInvitations(stranger.id)).toEqual([]);
    for (const action of [
      () => service.getInvitation(stranger.id, invitation.id),
      () => service.updateInvitation(stranger.id, invitation.id, readyDraft()),
      () => service.publishInvitation(stranger.id, invitation.id),
      () => service.unpublishInvitation(stranger.id, invitation.id),
      () => service.archiveInvitation(stranger.id, invitation.id),
      () => service.deleteInvitation(stranger.id, invitation.id),
      () => service.listRsvps(stranger.id, invitation.id),
    ])
      await expect(action()).rejects.toMatchObject({ status: 404 });
    expect(await service.getPublicInvitation(invitation.slug)).toBeNull();
  });
  it("publishes a snapshot, keeps draft changes private, and checks stale revisions", async () => {
    const owner = (await account()).user;
    const created = await service.createInvitation(owner.id, readyDraft());
    const published = await service.publishInvitation(
      owner.id,
      created.id,
      created.updatedAt,
    );
    const nextDraft = {
      ...readyDraft(),
      greeting: "Private unfinished changes",
      title: "Changed title",
    };
    const saved = await service.updateInvitation(
      owner.id,
      created.id,
      nextDraft,
      published.updatedAt,
    );
    expect(saved.status).toBe("published");
    expect(
      (await service.getPublicInvitation(created.slug))?.content.greeting,
    ).toBe("");
    await expect(
      service.updateInvitation(
        owner.id,
        created.id,
        readyDraft(),
        published.updatedAt,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.publishInvitation(owner.id, created.id, published.updatedAt),
    ).rejects.toMatchObject({ status: 409 });
    await service.publishInvitation(owner.id, created.id, saved.updatedAt);
    const publicData = await service.getPublicInvitation(created.slug);
    expect(publicData?.content.greeting).toBe("Private unfinished changes");
    expect(publicData).not.toHaveProperty("ownerId");
    const restarted = new PlatformService(new PlatformStore(directory));
    expect((await restarted.getInvitation(owner.id, created.id)).draft).toEqual(
      nextDraft,
    );
    expect((await restarted.listInvitations(owner.id))[0]).toMatchObject({
      title: "Changed title",
      responseCount: 0,
      status: "published",
    });
    await service.unpublishInvitation(owner.id, created.id);
    expect(await service.getPublicInvitation(created.slug)).toBeNull();
  });
  it("requires actual event facts before publication and rejects DST ambiguity", async () => {
    const owner = (await account()).user;
    const invitation = await service.createInvitation(
      owner.id,
      createEmptyDraft(),
    );
    await expect(
      service.publishInvitation(owner.id, invitation.id),
    ).rejects.toMatchObject({ code: "INCOMPLETE_INVITATION" });
    await service.updateInvitation(owner.id, invitation.id, {
      ...readyDraft(),
      date: {
        day: "2027-03-14",
        time: "02:30",
        timezone: "America/New_York",
        showCountdown: true,
      },
    });
    await expect(
      service.publishInvitation(owner.id, invitation.id),
    ).rejects.toMatchObject({ code: "INVALID_LOCAL_TIME" });
  });
  it("publishes a greeting without event requirements and never exposes retained event facts or accepts RSVP", async () => {
    const owner = (await account()).user;
    const draft = {
      ...readyDraft(), purpose: "greeting" as const, headline: "С днём рождения!", eventType: "birthday" as const,
      title: "Private management title", names: ["Малика"],
      date: { day: "", time: "", timezone: "Asia/Tashkent", showCountdown: true },
      venue: { name: "", address: "private-address", note: "private-location-note" },
      timeline: [{ time: "private-time", title: "private-programme" }],
      dressCode: { title: "private-dress", swatches: ["#AABBCC"] },
    };
    const invitation = await service.createInvitation(owner.id, draft);
    await service.publishInvitation(owner.id, invitation.id);
    const restarted = new PlatformService(new PlatformStore(directory));
    expect((await restarted.getInvitation(owner.id, invitation.id)).draft).toEqual(draft);
    const publicData = await restarted.getPublicInvitation(invitation.slug);
    expect(publicData?.content).toMatchObject({ purpose: "greeting", headline: "С днём рождения!", title: "Малика", date: { day: "", time: "", showCountdown: false }, venue: { name: "", address: "" }, timeline: [] });
    expect(JSON.stringify(publicData)).not.toContain("private-");
    expect(publicData?.content.enabledSections).not.toContain("rsvp");
    expect(publicData?.content).not.toHaveProperty("dressCode");
    // An older snapshot may still carry enabled RSVP/event facts. Reading and
    // submitting both enforce the current greeting boundary independently.
    await service.store.transaction((state) => { state.invitations[0].published!.content = draft; });
    expect(JSON.stringify(await service.getPublicInvitation(invitation.slug))).not.toContain("private-");
    await expect(service.submitRsvp(invitation.slug, { name: "Guest", status: "yes", guestCount: 1 })).rejects.toMatchObject({ code: "RSVP_DISABLED" });
    expect(await service.listRsvps(owner.id, invitation.id)).toEqual([]);
  });
  it("rejects incompatible composed designs before create, update or publish can mutate persisted state", async () => {
    const owner = (await account()).user;
    const invalid = { ...readyDraft(), templateId: "editorial" as const, fontPairId: "gallery" as const, composition: resolveStudioComposition("editorial") };
    await expect(service.createInvitation(owner.id, invalid)).rejects.toMatchObject({ status: 400, code: "INVALID_DESIGN" });
    expect(await service.listInvitations(owner.id)).toEqual([]);
    const valid = await service.createInvitation(owner.id, readyDraft());
    await expect(service.updateInvitation(owner.id, valid.id, invalid, valid.updatedAt)).rejects.toMatchObject({ status: 400, code: "INVALID_DESIGN" });
    expect(await service.getInvitation(owner.id, valid.id)).toEqual(valid);
    // Guard the publication boundary for older persisted or externally restored
    // composed data too, even if its enums are all individually valid.
    await service.store.transaction((state) => { state.invitations[0].draft = invalid; });
    const beforePublish = await readFile(path.join(directory, "state.json"), "utf8");
    await expect(service.publishInvitation(owner.id, valid.id)).rejects.toMatchObject({ status: 400, code: "INVALID_DESIGN" });
    expect(await readFile(path.join(directory, "state.json"), "utf8")).toBe(beforePublish);
  });
  it("serializes concurrent writes across store instances and preserves every update", async () => {
    const owner = (await account()).user;
    const restarted = new PlatformService(new PlatformStore(directory));
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        (index % 2 ? service : restarted).createInvitation(owner.id, {
          ...readyDraft(),
          title: `Event ${index}`,
        }),
      ),
    );
    expect(await service.listInvitations(owner.id)).toHaveLength(12);
  });
  it("shares the process mutex across independently loaded module copies", async () => {
    const initialModule = await import("./store");
    vi.resetModules();
    const reloadedModule = await import("./store");
    expect(initialModule.PlatformStore).not.toBe(reloadedModule.PlatformStore);
    const first = new initialModule.PlatformStore(directory);
    const second = new reloadedModule.PlatformStore(directory);
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const one = first.transaction(async (state) => {
      entered();
      await gate;
      state.loginAttempts.push({
        key: "first",
        count: 1,
        resetAt: new Date().toISOString(),
      });
    });
    await started;
    let secondEntered = false;
    const two = second.transaction((state) => {
      secondEntered = true;
      state.loginAttempts.push({
        key: "second",
        count: 1,
        resetAt: new Date().toISOString(),
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(secondEntered).toBe(false);
    release();
    await Promise.all([one, two]);
    expect(
      await second.transaction(
        (state) => state.loginAttempts.map((item) => item.key),
        false,
      ),
    ).toEqual(["first", "second"]);
  });
  it("sanitizes public snapshots and SSR props while preserving private drafts", async () => {
    const owner = (await account()).user;
    const draft = {
      ...readyDraft(),
      title: "internal-client-work-in-progress",
      enabledSections: ["opening"] as const,
      greeting: "hidden-greeting",
      story: "hidden-story",
      closing: "hidden-closing",
      venue: {
        name: "hidden-venue",
        address: "hidden-address",
        note: "hidden-note",
        mapUrl: "https://private-place.example.com",
      },
      timeline: [
        {
          time: "16:30",
          title: "hidden-timeline",
          note: "hidden-timeline-note",
        },
      ],
      dressCode: {
        title: "hidden-dresscode",
        note: "hidden-dresscode-note",
        swatches: ["#AABBCC"],
      },
    };
    const input = { ...draft, enabledSections: [...draft.enabledSections] };
    const invitation = await service.createInvitation(owner.id, input);
    await service.publishInvitation(owner.id, invitation.id);
    const publicData = await service.getPublicInvitation(invitation.slug);
    const serializedProps = JSON.stringify(publicData);
    for (const secret of [
      "internal-client-work-in-progress",
      "hidden-",
      "private-place",
      "2027-06-12",
      "18:00",
      "#AABBCC",
    ])
      expect(serializedProps).not.toContain(secret);
    expect(publicData?.content.title).toBe("Азиз & Малика");
    expect(publicData?.content.date).toEqual({
      day: "",
      time: "",
      timezone: "Asia/Tashkent",
      showCountdown: false,
    });
    expect(
      (await service.getInvitation(owner.id, invitation.id)).draft,
    ).toEqual(input);
    // Older persisted snapshots receive the same filtering at the read boundary.
    await service.store.transaction((state) => {
      state.invitations[0].published!.content = input;
    });
    expect(
      JSON.stringify(await service.getPublicInvitation(invitation.slug)),
    ).not.toContain("hidden-");
    expect(
      publicSnapshotContent({ ...input, eventType: "corporate" }).title,
    ).toBe("Азиз & Малика");
  });
  it("does not lose existing state when a transaction throws", async () => {
    const owner = (await account()).user;
    await expect(
      service.store.transaction((state) => {
        state.users = [];
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");
    expect(
      await service.store.transaction(
        (state) => state.users.map((user) => user.id),
        false,
      ),
    ).toEqual([owner.id]);
  });
});

describe("RSVP persistence and capability tokens", () => {
  it("stores yes/no/maybe, requires invitation-bound edit token, never lists tokens", async () => {
    const owner = (await account()).user;
    const invitation = await service.createInvitation(owner.id, readyDraft());
    await expect(
      service.submitRsvp(invitation.slug, {
        name: "Guest",
        status: "yes",
        guestCount: 2,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await service.publishInvitation(owner.id, invitation.id);
    const initial = await service.submitRsvp(invitation.slug, {
      name: "Guest",
      email: "guest@example.com",
      status: "yes",
      guestCount: 2,
    });
    const updated = await service.submitRsvp(invitation.slug, {
      name: "Guest",
      status: "maybe",
      guestCount: 1,
      editToken: initial.editToken,
    });
    expect(updated.response.id).toBe(initial.response.id);
    expect(updated.response.status).toBe("maybe");
    const declined = await service.submitRsvp(invitation.slug, {
      name: "Other guest",
      status: "no",
      guestCount: 1,
    });
    expect(declined.response.status).toBe("no");
    await expect(
      service.submitRsvp(invitation.slug, {
        name: "Attacker",
        status: "yes",
        guestCount: 1,
        editToken: "0".repeat(64),
      }),
    ).rejects.toMatchObject({ status: 403 });
    const other = await service.createInvitation(owner.id, readyDraft());
    await service.publishInvitation(owner.id, other.id);
    await expect(
      service.submitRsvp(other.slug, {
        name: "Guest",
        status: "no",
        guestCount: 1,
        editToken: initial.editToken,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const responses = await service.listRsvps(owner.id, invitation.id);
    expect(responses).toHaveLength(2);
    expect(JSON.stringify(responses)).not.toContain("Token");
    expect(
      await readFile(path.join(directory, "state.json"), "utf8"),
    ).not.toContain(initial.editToken!);
    expect(
      (await service.listInvitations(owner.id)).find(
        (item) => item.id === invitation.id,
      )?.responseCount,
    ).toBe(2);
    await service.archiveInvitation(owner.id, invitation.id);
    expect(await service.getPublicInvitation(invitation.slug)).toBeNull();
    await expect(
      service.submitRsvp(invitation.slug, {
        name: "Guest",
        status: "yes",
        guestCount: 1,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await service.deleteInvitation(owner.id, invitation.id);
    expect(
      await service.store.transaction(
        (state) =>
          state.rsvps.filter((item) => item.invitationId === invitation.id),
        false,
      ),
    ).toEqual([]);
  });
  it("validates bounded fields and disabled RSVP server-side", async () => {
    expect(
      RsvpInputSchema.safeParse({
        name: "Guest",
        status: "yes",
        guestCount: 999,
      }).success,
    ).toBe(false);
    const owner = (await account()).user;
    const draft = readyDraft();
    draft.enabledSections = draft.enabledSections.filter(
      (section) => section !== "rsvp",
    );
    const invitation = await service.createInvitation(owner.id, draft);
    await service.publishInvitation(owner.id, invitation.id);
    await expect(
      service.submitRsvp(invitation.slug, {
        name: "Guest",
        status: "yes",
        guestCount: 1,
      }),
    ).rejects.toMatchObject({ code: "RSVP_DISABLED" });
  });
});

describe("private media lifecycle", () => {
  it("authorizes AI artwork independently of the gallery and freezes its public visibility", async () => {
    const owner = (await account()).user;
    const draft = { ...readyDraft(), templateId: "sculpted-garden" as const };
    const first = await service.createInvitation(owner.id, draft);
    const second = await service.createInvitation(owner.id, draft);
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "ivory" } }).png().toBuffer();
    const artwork = await service.uploadMedia(owner.id, first.id, bytes);
    for (const field of ["artwork", "artworkWide"] as const) {
      await expect(service.updateInvitation(owner.id, second.id, { ...draft, [field]: artwork }))
        .rejects.toMatchObject({ code: "INVALID_MEDIA" });
    }
    await service.updateInvitation(owner.id, first.id, { ...draft, artwork });
    await expect(service.getMedia(artwork.id)).rejects.toMatchObject({ status: 404 });
    await service.publishInvitation(owner.id, first.id);
    expect((await service.getPublicInvitation(first.slug))?.content.artwork).toEqual(artwork);
    expect((await service.getMedia(artwork.id)).length).toBeGreaterThan(0);
    // Editing the owner's draft does not replace or revoke the live snapshot.
    await service.updateInvitation(owner.id, first.id, draft);
    expect((await service.getMedia(artwork.id)).length).toBeGreaterThan(0);
    await service.publishInvitation(owner.id, first.id);
    await expect(service.getMedia(artwork.id)).rejects.toMatchObject({ status: 404 });
    await service.updateInvitation(owner.id, first.id, { ...draft, artwork, templateId: "classic" });
    await service.publishInvitation(owner.id, first.id);
    expect((await service.getPublicInvitation(first.slug))?.content.artwork).toBeUndefined();
    await expect(service.getMedia(artwork.id)).rejects.toMatchObject({ status: 404 });
  });
  it("re-encodes images, validates ownership, publishes only referenced snapshots, revokes on archive", async () => {
    const owner = (await account()).user;
    const invitation = await service.createInvitation(owner.id, readyDraft());
    const png = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const reference = await service.uploadMedia(owner.id, invitation.id, png);
    await expect(service.getMedia(reference.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      (await sharp(await service.getMedia(reference.id, owner.id)).metadata())
        .format,
    ).toBe("webp");
    await expect(
      service.uploadMedia("stranger", invitation.id, png),
    ).rejects.toMatchObject({ status: 404 });
    const other = await service.createInvitation(owner.id, readyDraft());
    await expect(
      service.updateInvitation(owner.id, other.id, {
        ...readyDraft(),
        media: [reference],
      }),
    ).rejects.toMatchObject({ code: "INVALID_MEDIA" });
    await service.updateInvitation(owner.id, invitation.id, {
      ...readyDraft(),
      media: [reference],
    });
    await service.publishInvitation(owner.id, invitation.id);
    expect((await service.getMedia(reference.id)).length).toBeGreaterThan(0);
    await service.updateInvitation(owner.id, invitation.id, readyDraft());
    expect((await service.getMedia(reference.id)).length).toBeGreaterThan(0);
    await service.archiveInvitation(owner.id, invitation.id);
    await expect(service.getMedia(reference.id)).rejects.toMatchObject({
      status: 404,
    });
    await service.deleteInvitation(owner.id, invitation.id);
    await expect(
      service.getMedia(reference.id, owner.id),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("rejects remote/data media references, SVG, oversized and malformed images", async () => {
    const owner = (await account()).user;
    const invitation = await service.createInvitation(owner.id, readyDraft());
    expect(
      InvitationDraftSchema.safeParse({
        ...readyDraft(),
        media: [{ id: "bad", src: "https://attacker/image.svg" }],
      }).success,
    ).toBe(false);
    await expect(
      service.uploadMedia(owner.id, invitation.id, Buffer.from("<svg/>")),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      service.uploadMedia(
        owner.id,
        invitation.id,
        Buffer.alloc(9 * 1024 * 1024),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      service.uploadMedia(
        owner.id,
        invitation.id,
        Buffer.from([0xff, 0xd8, 0xff, 0]),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.getMedia("../../state.json", owner.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("HTTP boundary and renderer adapter", () => {
  it("requires exact same Origin for mutations", () => {
    const request = (origin?: string) =>
      new Request("https://example.com/api/platform", {
        method: "POST",
        headers: origin ? { origin } : {},
      });
    expect(() =>
      assertSameOrigin(request("https://example.com")),
    ).not.toThrow();
    expect(() => assertSameOrigin(request())).toThrow();
    expect(() => assertSameOrigin(request("https://evil.example"))).toThrow();
  });
  it("compares Origin to transport Host when Next rewrites the internal request URL", () => {
    const request = (host: string, origin: string, forwardedHost?: string) => new Request("http://localhost:3000/api/platform", {
      method: "POST", headers: { host, origin, ...(forwardedHost ? { "x-forwarded-host": forwardedHost } : {}) },
    });
    expect(() => assertSameOrigin(request("127.0.0.1:3000", "http://127.0.0.1:3000"))).not.toThrow();
    expect(() => assertSameOrigin(request("localhost:3000", "http://localhost:3000"))).not.toThrow();
    expect(() => assertSameOrigin(request("127.0.0.1:3000", "http://localhost:3000"))).toThrow();
    expect(() => assertSameOrigin(request("localhost:3000", "http://evil.example", "evil.example"))).toThrow();
    for (const origin of ["null", "not-a-url", "http://localhost:3000/path", "http://user:pass@localhost:3000"]) expect(() => assertSameOrigin(request("localhost:3000", origin))).toThrow();
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/platform", {
      method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "cross-site" },
    }))).toThrow();
  });
  it("limits actual streamed bytes and rejects non JSON or malformed JSON", async () => {
    await expect(
      readBody(
        new Request("http://localhost", {
          method: "POST",
          body: "x".repeat(20),
        }),
        10,
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readJson(new Request("http://localhost", { method: "POST", body: "{}" })),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      readJson(
        new Request("http://localhost", {
          method: "POST",
          body: "{bad",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("sets private production session cookie and never returns its token in JSON", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = withSession({ id: "user" }, "token-secret");
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.headers.get("set-cookie")).toMatch(/Secure/i);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
    expect(await response.json()).toEqual({ user: { id: "user" } });
    expect(clearSession().headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });
  it("returns bounded safe errors without leaking internal exception messages", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("http://localhost");
    const result = await route(request, async () => {
      throw new Error("private/path/password");
    });
    expect(result.status).toBe(500);
    expect(JSON.stringify(await result.json())).not.toContain(
      "private/path/password",
    );
    expect(
      (
        await route(request, async () => {
          throw new PlatformError(404, "NOT_FOUND", "Не найдено");
        })
      ).status,
    ).toBe(404);
  });
  it("preserves civil dates, rejects DST folds, and hides disabled sections", () => {
    expect(civilDateTimeToIso("2027-06-12", "18:00", "Asia/Tashkent")).toBe(
      "2027-06-12T13:00:00.000Z",
    );
    expect(civilDateTimeToIso("2027-06-12", "", "Asia/Tashkent")).toBe("");
    expect(() =>
      civilDateTimeToIso("2027-11-07", "01:30", "America/New_York"),
    ).toThrow();
    const content = toInvitationContent(
      {
        ...readyDraft(),
        enabledSections: ["opening"],
        greeting: "hidden",
        story: "hidden",
      },
      "sample",
    );
    expect(content.date.start).toBe("");
    expect(content.date.day).toBeUndefined();
    expect(content.venue.name).toBe("");
    expect(content.greeting).toBeUndefined();
    expect(content.wishes).toBeUndefined();
    expect(content.rsvp).toBeUndefined();
  });
});

it("allows an unfinished material draft but requires owned artwork for publication", async () => {
  const owner = (await account()).user.id;
  const concept = { title: "Фарфоровая история", scene: "porcelain", layout: "keepsake" } as const;
  const draft = { ...readyDraft(), templateId: "editorial" as const, artDirection: concept };
  const invitation = await service.createInvitation(owner, draft);
  expect(invitation.draft.artDirection).toEqual(concept);
  await expect(service.publishInvitation(owner, invitation.id, invitation.updatedAt)).rejects.toMatchObject({ status: 400, code: "INCOMPLETE_ARTWORK" });
  expect((await service.getInvitation(owner, invitation.id)).published).toBeNull();
  const bytes = await sharp({ create: { width: 256, height: 384, channels: 3, background: "ivory" } }).webp().toBuffer();
  const media = await service.uploadMedia(owner, invitation.id, bytes);
  const withArtwork = await service.updateInvitation(owner, invitation.id, { ...invitation.draft, artwork: media }, invitation.updatedAt);
  const published = await service.publishInvitation(owner, invitation.id, withArtwork.updatedAt);
  expect(published.published!.content).toMatchObject({ artDirection: concept, artwork: media });
});
