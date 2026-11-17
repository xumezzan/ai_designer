import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createEmptyDraft, type InvitationDraft, type InvitationRecord } from "@/lib/platform/schema";
import { PlatformService } from "@/lib/platform/service";
import { PlatformStore } from "@/lib/platform/store";
import { applyInvitationDesign, invitationDesign, InvitationDesignSchema } from "./schema";
import { PlatformDesignService } from "./service";
import { resolveStudioComposition } from "@/registry/studioTemplates";

let directory: string;
let platform: PlatformService;
let designs: PlatformDesignService;
let ownerId: string;
let png: Buffer;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "invitation-designs-"));
  platform = new PlatformService(new PlatformStore(directory));
  designs = new PlatformDesignService(platform);
  ownerId = (await platform.auth.register({ name: "Host", email: "host@example.com", password: "valid-password-123" })).user.id;
  png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "ivory" } }).png().toBuffer();
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
function readyDraft(): InvitationDraft {
  return { ...createEmptyDraft("sculpted-garden"), names: ["Азиз", "Малика"], title: "Private management title",
    date: { day: "2027-06-12", time: "18:00", timezone: "Asia/Tashkent", showCountdown: true },
    venue: { name: "Сад", address: "Ташкент" }, greeting: "Наш текст", closing: "До встречи",
  };
}
async function job(invitation: InvitationRecord, before = invitation.draft, after: InvitationDraft = { ...invitation.draft, paletteId: "sage" }, status: "running" | "succeeded" | "failed" = "succeeded", createdAt = invitation.createdAt) {
  const requestId = randomUUID();
  await platform.store.transaction((state) => {
    state.generationJobs.push({
      requestId, ownerId: invitation.ownerId, invitationId: invitation.id, status,
      briefHash: "a".repeat(64), callAttempts: { planner: 1, image: 1 }, baseUpdatedAt: invitation.updatedAt,
      before, after, createdAt, updatedAt: new Date(Date.parse(createdAt) + 1).toISOString(), summary: "Приватное направление оформления",
    });
  });
  return requestId;
}

it("replaces exactly the design fields and removes both obsolete artwork references", () => {
  const ref = { id: randomUUID(), src: "" };
  ref.src = `/api/platform/media/${ref.id}`;
  const draft = { ...readyDraft(), artwork: ref, artworkWide: ref, media: [ref], story: "Сохраняем историю", enabledSections: ["opening", "story"] as InvitationDraft["enabledSections"] };
  const selected = { templateId: "classic", paletteId: "rose", fontPairId: "modern", artwork: undefined } as const;
  const result = applyInvitationDesign(draft, selected);
  expect(result).toEqual({ ...readyDraft(), templateId: "classic", paletteId: "rose", fontPairId: "modern", media: [ref], story: "Сохраняем историю", enabledSections: ["opening", "story"] });
  expect(result).not.toHaveProperty("artwork");
  expect(result).not.toHaveProperty("artworkWide");
  expect(draft.artwork).toEqual(ref);
  expect(InvitationDesignSchema.safeParse({ ...selected, names: ["Injected"] }).success).toBe(false);
});

it("restores composed appearance after restart while keeping greeting purpose, headline and event facts; old versions clear optional appearance", async () => {
  const composition = resolveStudioComposition("modern");
  const draft: InvitationDraft = {
    ...readyDraft(), templateId: "modern", paletteId: "cobalt", fontPairId: "modernist",
    composition, ornamentSetId: "graphic-ribbon", purpose: "greeting", headline: "Наш заголовок",
  };
  const invitation = await platform.createInvitation(ownerId, draft);
  await designs.save(ownerId, invitation.id, { action: "save", expectedUpdatedAt: invitation.updatedAt });
  const oldDesign = invitationDesign(readyDraft());
  const current = await platform.updateInvitation(ownerId, invitation.id, {
    ...applyInvitationDesign(draft, oldDesign), headline: "Новый заголовок", greeting: "Новые пожелания",
  }, invitation.updatedAt);
  const restarted = new PlatformDesignService(new PlatformService(new PlatformStore(directory)));
  const saved = (await restarted.list(ownerId, invitation.id)).versions[0];
  expect(saved.design).toMatchObject({ composition, ornamentSetId: "graphic-ribbon" });
  expect(saved.design).not.toHaveProperty("purpose");
  expect(saved.design).not.toHaveProperty("headline");
  const restored = await restarted.restore(ownerId, invitation.id, { action: "restore", reference: saved.reference, expectedUpdatedAt: current.updatedAt });
  expect(restored.draft).toMatchObject({ composition, ornamentSetId: "graphic-ribbon", purpose: "greeting", headline: "Новый заголовок", greeting: "Новые пожелания", date: draft.date, venue: draft.venue });
  const legacy = applyInvitationDesign(restored.draft, oldDesign);
  expect(legacy).not.toHaveProperty("composition");
  expect(legacy).not.toHaveProperty("ornamentSetId");
  expect(legacy).toMatchObject({ purpose: "greeting", headline: "Новый заголовок", greeting: "Новые пожелания" });
});

it("lists derived successful AI before/after versions and persisted manual designs without private planning metadata", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  const requestId = await job(invitation);
  await job(invitation, invitation.draft, invitation.draft, "failed");
  await job(invitation, invitation.draft, invitation.draft, "running", new Date(Date.now() - 7 * 60_000).toISOString());
  await designs.save(ownerId, invitation.id, { action: "save", label: "Наш вариант", expectedUpdatedAt: invitation.updatedAt });
  const restarted = new PlatformDesignService(new PlatformService(new PlatformStore(directory)));
  const history = await restarted.list(ownerId, invitation.id);
  expect(history.versions).toHaveLength(3);
  expect(history.versions.map((version) => version.source)).toEqual(["saved", "generated", "before-generation"]);
  expect(history.versions.find((version) => version.source === "generated")).toMatchObject({ reference: { kind: "generation", requestId, phase: "after" }, design: { paletteId: "sage" } });
  expect(history.versions[0].label).toBe("Наш вариант");
  const serialized = JSON.stringify(history);
  expect(serialized).not.toMatch(/briefHash|callAttempts|baseUpdatedAt|ownerId|Private management title|Наш текст|Азиз/);
  expect(await platform.getInvitation(ownerId, invitation.id)).toEqual(invitation);
});

it("restores historical design while preserving all current facts, gallery, publication, status and paid counters; checkpoints enable undo", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  const image = await platform.uploadMedia(ownerId, invitation.id, png);
  const wide = await platform.uploadMedia(ownerId, invitation.id, png);
  const after = { ...invitation.draft, names: ["Старое имя"], paletteId: "sage" as const, artwork: image, artworkWide: wide };
  const requestId = await job(invitation, invitation.draft, after);
  const published = await platform.publishInvitation(ownerId, invitation.id, invitation.updatedAt);
  const current = await platform.updateInvitation(ownerId, invitation.id, { ...published.draft, names: ["Новое имя"], greeting: "Совсем новый текст", paletteId: "rose", fontPairId: "modern", story: "Новая история", media: [wide], timeline: [{ time: "19:00", title: "Встреча" }] }, published.updatedAt);
  const restored = await designs.restore(ownerId, invitation.id, { action: "restore", reference: { kind: "generation", requestId, phase: "after" }, expectedUpdatedAt: current.updatedAt });
  expect(restored.draft).toEqual(applyInvitationDesign(current.draft, invitationDesign(after)));
  expect(restored.published).toEqual(published.published);
  expect(restored.status).toBe("published");
  expect(restored.updatedAt).not.toBe(current.updatedAt);
  expect((await platform.getPublicInvitation(invitation.slug))?.content).toEqual(published.published!.content);
  await expect(platform.getMedia(image.id)).rejects.toMatchObject({ status: 404 });
  const [checkpoint] = (await designs.list(ownerId, invitation.id)).versions.filter((version) => version.source === "before-restore");
  expect(checkpoint.design).toEqual(invitationDesign(current.draft));
  const undone = await designs.restore(ownerId, invitation.id, { action: "restore", reference: checkpoint.reference, expectedUpdatedAt: restored.updatedAt });
  expect(undone.draft).toEqual(current.draft);
  expect(undone.published).toEqual(published.published);
  expect(await platform.store.transaction((state) => state.generationJobs.map((generation) => generation.callAttempts), false)).toEqual([{ planner: 1, image: 1 }]);
});

it("requires the current revision, same invitation and owner without exposing foreign histories", async () => {
  const first = await platform.createInvitation(ownerId, readyDraft());
  const second = await platform.createInvitation(ownerId, readyDraft());
  const requestId = await job(first);
  const otherOwner = (await platform.auth.register({ name: "Other", email: "other@example.com", password: "valid-password-123" })).user.id;
  await expect(designs.list(otherOwner, first.id)).rejects.toMatchObject({ status: 404 });
  await expect(designs.save(otherOwner, first.id, { action: "save", expectedUpdatedAt: first.updatedAt })).rejects.toMatchObject({ status: 404 });
  await expect(designs.restore(ownerId, second.id, { action: "restore", reference: { kind: "generation", requestId, phase: "after" }, expectedUpdatedAt: second.updatedAt })).rejects.toMatchObject({ status: 404 });
  await designs.save(ownerId, first.id, { action: "save", expectedUpdatedAt: first.updatedAt });
  const saved = (await designs.list(ownerId, first.id)).versions.find((version) => version.source === "saved")!;
  await expect(designs.restore(ownerId, second.id, { action: "restore", reference: saved.reference, expectedUpdatedAt: second.updatedAt })).rejects.toMatchObject({ status: 404 });
  const edited = await platform.updateInvitation(ownerId, first.id, { ...first.draft, greeting: "Edited" }, first.updatedAt);
  await expect(designs.save(ownerId, first.id, { action: "save", expectedUpdatedAt: first.updatedAt })).rejects.toMatchObject({ status: 409, code: "REVISION_CONFLICT" });
  await expect(designs.restore(ownerId, first.id, { action: "restore", reference: saved.reference, expectedUpdatedAt: first.updatedAt })).rejects.toMatchObject({ status: 409, code: "REVISION_CONFLICT" });
  expect(await platform.getInvitation(ownerId, first.id)).toEqual(edited);
});

it("makes repeated save and restoring the current design idempotent without revision changes or history growth", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  await designs.save(ownerId, invitation.id, { action: "save", expectedUpdatedAt: invitation.updatedAt });
  expect(await designs.save(ownerId, invitation.id, { action: "save", expectedUpdatedAt: invitation.updatedAt })).toEqual(invitation);
  const history = await designs.list(ownerId, invitation.id);
  expect(history.versions).toHaveLength(1);
  const restored = await designs.restore(ownerId, invitation.id, { action: "restore", reference: history.versions[0].reference, expectedUpdatedAt: invitation.updatedAt });
  expect(restored).toEqual(invitation);
  expect((await designs.list(ownerId, invitation.id)).versions).toHaveLength(1);
});

it("guards active generation and archived restore while permitting expired jobs without replaying them", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  await designs.save(ownerId, invitation.id, { action: "save", expectedUpdatedAt: invitation.updatedAt });
  const reference = (await designs.list(ownerId, invitation.id)).versions[0].reference;
  const requestId = await job(invitation, invitation.draft, invitation.draft, "running");
  for (const action of [() => designs.save(ownerId, invitation.id, { action: "save", expectedUpdatedAt: invitation.updatedAt }), () => designs.restore(ownerId, invitation.id, { action: "restore", reference, expectedUpdatedAt: invitation.updatedAt })])
    await expect(action()).rejects.toMatchObject({ status: 409, code: "AI_ALREADY_RUNNING" });
  await platform.store.transaction((state) => { state.generationJobs.find((entry) => entry.requestId === requestId)!.createdAt = new Date(Date.now() - 7 * 60_000).toISOString(); });
  expect(await designs.restore(ownerId, invitation.id, { action: "restore", reference, expectedUpdatedAt: invitation.updatedAt })).toEqual(invitation);
  const archived = await platform.archiveInvitation(ownerId, invitation.id, invitation.updatedAt);
  await expect(designs.restore(ownerId, invitation.id, { action: "restore", reference, expectedUpdatedAt: archived.updatedAt })).rejects.toMatchObject({ status: 409, code: "INVITATION_ARCHIVED" });
});

it("validates every media reference in a historical design before saving a checkpoint or changing the draft", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  const another = await platform.createInvitation(ownerId, readyDraft());
  const foreign = await platform.uploadMedia(ownerId, another.id, png);
  const requestId = await job(invitation, invitation.draft, { ...invitation.draft, artwork: foreign });
  await expect(designs.restore(ownerId, invitation.id, { action: "restore", reference: { kind: "generation", requestId, phase: "after" }, expectedUpdatedAt: invitation.updatedAt })).rejects.toMatchObject({ code: "INVALID_MEDIA" });
  expect(await platform.getInvitation(ownerId, invitation.id)).toEqual(invitation);
  expect(await platform.store.transaction((state) => state.designVersions, false)).toEqual([]);
});

it("paginates a stable timeline in bounded pages with strict invitation-scoped opaque cursors", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  for (let index = 0; index < 23; index++) await job(invitation, invitation.draft, invitation.draft, "succeeded", new Date(Date.parse(invitation.createdAt) + index * 5).toISOString());
  const first = await designs.list(ownerId, invitation.id);
  const second = await designs.list(ownerId, invitation.id, first.nextCursor);
  const third = await designs.list(ownerId, invitation.id, second.nextCursor);
  expect([first.versions.length, second.versions.length, third.versions.length]).toEqual([20, 20, 6]);
  expect(third.nextCursor).toBeUndefined();
  expect(new Set([...first.versions, ...second.versions, ...third.versions].map((version) => version.key)).size).toBe(46);
  for (const cursor of ["", "%%%", `${first.nextCursor}=`, Buffer.from(JSON.stringify({ v: 1, invitationId: invitation.id, createdAt: invitation.createdAt, key: "saved:invalid" })).toString("base64url")])
    await expect(designs.list(ownerId, invitation.id, cursor)).rejects.toMatchObject({ status: 400, code: "INVALID_CURSOR" });
  const secondInvitation = await platform.createInvitation(ownerId, readyDraft());
  await expect(designs.list(ownerId, secondInvitation.id, first.nextCursor)).rejects.toMatchObject({ status: 400, code: "INVALID_CURSOR" });
});

it("caps saved/checkpoint records without deleting older designs or changing a draft when capacity is exhausted", async () => {
  const invitation = await platform.createInvitation(ownerId, { ...readyDraft(), paletteId: "rose" });
  const requestId = await job(invitation, invitation.draft, { ...invitation.draft, paletteId: "sage" });
  await platform.store.transaction((state) => {
    for (let index = 0; index < 50; index++) state.designVersions.push({ id: randomUUID(), ownerId, invitationId: invitation.id, source: "saved", label: `Version ${index}`, design: { templateId: "classic", paletteId: "ivory", fontPairId: "classic" }, createdAt: invitation.createdAt });
  });
  await expect(designs.save(ownerId, invitation.id, { action: "save", expectedUpdatedAt: invitation.updatedAt })).rejects.toMatchObject({ status: 429, code: "DESIGN_HISTORY_LIMIT" });
  await expect(designs.restore(ownerId, invitation.id, { action: "restore", reference: { kind: "generation", requestId, phase: "after" }, expectedUpdatedAt: invitation.updatedAt })).rejects.toMatchObject({ status: 429, code: "DESIGN_HISTORY_LIMIT" });
  expect(await platform.store.transaction((state) => state.designVersions.length, false)).toBe(50);
  expect(await platform.getInvitation(ownerId, invitation.id)).toEqual(invitation);
});

it("reads pre-history repositories and removes owned saved versions when their invitation is deleted", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  const filename = path.join(directory, "state.json");
  const state = JSON.parse(await readFile(filename, "utf8"));
  delete state.designVersions;
  await writeFile(filename, JSON.stringify(state));
  expect((await designs.list(ownerId, invitation.id)).versions).toEqual([]);
  await designs.save(ownerId, invitation.id, { action: "save", expectedUpdatedAt: invitation.updatedAt });
  const another = await platform.createInvitation(ownerId, readyDraft());
  await designs.save(ownerId, another.id, { action: "save", expectedUpdatedAt: another.updatedAt });
  await platform.deleteInvitation(ownerId, invitation.id);
  expect(await platform.store.transaction((saved) => saved.designVersions.map((version) => version.invitationId), false)).toEqual([another.id]);
  await expect(designs.list(ownerId, invitation.id)).rejects.toMatchObject({ status: 404 });
});

it("persists material concepts with their own artwork and restores them without altering facts or publication", async () => {
  const invitation = await platform.createInvitation(ownerId, { ...readyDraft(), templateId: "editorial" });
  const image = await platform.uploadMedia(ownerId, invitation.id, png);
  const otherImage = await platform.uploadMedia(ownerId, invitation.id, png);
  const firstConcept = { title: "Лунный сад", scene: "night-garden", layout: "immersive" } as const;
  const first = await platform.updateInvitation(ownerId, invitation.id, { ...invitation.draft, artDirection: firstConcept, artwork: image }, invitation.updatedAt);
  await designs.save(ownerId, invitation.id, { action: "save", expectedUpdatedAt: first.updatedAt });
  const current = await platform.updateInvitation(ownerId, invitation.id, { ...first.draft, artDirection: { title: "Тёплый шёлк", scene: "silk", layout: "editorial" }, artwork: otherImage, purpose: "greeting", headline: "Для тебя", names: ["Амира"], greeting: "Текущие личные пожелания" }, first.updatedAt);
  const published = await platform.publishInvitation(ownerId, invitation.id, current.updatedAt);
  const restarted = new PlatformDesignService(new PlatformService(new PlatformStore(directory)));
  const previous = (await restarted.list(ownerId, invitation.id)).versions.find((version) => version.source === "saved")!;
  expect(previous.design).toMatchObject({ artDirection: firstConcept, artwork: image });
  const restored = await restarted.restore(ownerId, invitation.id, { action: "restore", reference: previous.reference, expectedUpdatedAt: published.updatedAt });
  expect(restored.draft).toMatchObject({ artDirection: firstConcept, artwork: image, purpose: "greeting", headline: current.draft.headline, names: ["Амира"], greeting: current.draft.greeting });
  expect(restored.published).toEqual(published.published);
  await expect(platform.getMedia(image.id)).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
  expect(await platform.getMedia(otherImage.id)).toBeInstanceOf(Buffer);
  const republished = await platform.publishInvitation(ownerId, invitation.id, restored.updatedAt);
  expect(republished.published!.content).toMatchObject({ artDirection: firstConcept, artwork: image });
  expect(await platform.getMedia(image.id)).toBeInstanceOf(Buffer);
  await expect(platform.getMedia(otherImage.id)).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
});
