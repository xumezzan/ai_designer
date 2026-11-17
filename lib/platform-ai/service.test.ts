import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createEmptyDraft } from "@/lib/platform/schema";
import { PlatformService } from "@/lib/platform/service";
import { PlatformStore } from "@/lib/platform/store";
import { PlatformAiService } from "./service";
import type { ArtDirection } from "./schema";
import { resolveStudioComposition } from "@/registry/studioTemplates";
import { moodProfiles } from "@/registry/moodProfiles";

let directory: string;
let platform: PlatformService;
let ownerId: string;
const direction: ArtDirection = {
  paletteId: "sage", artworkPrompt: "Sculptural porcelain jasmine and warm limestone with restrained sage botanical details.",
  greeting: "Дорогие друзья, разделите с нами этот особенный день.", closing: "С любовью и нетерпением ждём встречи.", summary: "Фарфоровый сад в оттенках шалфея",
};
const plan = vi.fn();
const createArtwork = vi.fn();
let ai: PlatformAiService;
let bytes: Buffer;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "platform-ai-"));
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  platform = new PlatformService(new PlatformStore(directory));
  ownerId = (await platform.auth.register({ name: "Host", email: "host@example.com", password: "valid-password-123" })).user.id;
  bytes = await sharp({ create: { width: 256, height: 384, channels: 3, background: "ivory" } }).webp().toBuffer();
  plan.mockReset().mockResolvedValue(direction);
  createArtwork.mockReset().mockResolvedValue(bytes);
  ai = new PlatformAiService(platform, { plan, createArtwork });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});
function readyDraft() {
  return { ...createEmptyDraft("sculpted-garden"), names: ["Азиз", "Малика"],
    date: { day: "2027-06-12", time: "18:00", timezone: "Asia/Tashkent", showCountdown: true },
    venue: { name: "Villa Botanica", address: "Ташкент" },
  };
}
function input(updatedAt: string, requestId = randomUUID()) {
  return { requestId, expectedUpdatedAt: updatedAt, brief: "Светлый скульптурный сад, фарфоровые цветы и натуральный камень." };
}

it.each(moodProfiles)("compiles $name to its authored composition without an image request", async (profile) => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  plan.mockResolvedValue({ themeId: profile.id, summary: "Тема из каталога" });
  const result = await ai.generate(ownerId, invitation.id, {
    ...input(invitation.updatedAt), brief: `Собери приглашение в стиле ${profile.name}.`,
  });
  expect(result.job.status).toBe("succeeded");
  expect(result.invitation?.draft).toMatchObject(profile.selection);
  expect(result.invitation?.draft.artDirection).toBeUndefined();
  expect(createArtwork).not.toHaveBeenCalled();
});

it("merges allowed variations over the catalog recipe and leaves a published draft isolated", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  // Publish an authored invitation before generating an alternative design.
  const authored = { ...invitation.draft, templateId: "classic" as const, greeting: "Текст организатора" };
  const edited = await platform.updateInvitation(ownerId, invitation.id, authored, invitation.updatedAt);
  const published = await platform.publishInvitation(ownerId, invitation.id, edited.updatedAt);
  plan.mockResolvedValue({
    themeId: "modern-editorial", heroLayout: "minimal-card", motionPreset: "drift", sectionOrder: "event-first",
    sectionVariants: { gallery: "filmstrip", program: "cards" }, greeting: "Не заменяет исходный текст", summary: "Журнальная тема с акцентом на программу",
  });
  const result = await ai.generate(ownerId, invitation.id, input(published.updatedAt));
  expect(result.job.status).toBe("succeeded");
  expect(result.invitation?.draft).toMatchObject({
    templateId: "editorial", paletteId: "modern-editorial", fontPairId: "modern-editorial",
    names: authored.names, date: authored.date, venue: authored.venue, greeting: authored.greeting,
    composition: {
      heroLayout: "minimal-card", spacingScale: "airy-gallery", motionPreset: "drift", sectionOrder: "event-first",
      sectionVariants: { gallery: "filmstrip", program: "cards", countdown: "inline" },
    },
  });
  expect(result.invitation?.published).toEqual(published.published);
  expect(createArtwork).not.toHaveBeenCalled();
});

it("discovers the latest owner-scoped generation after a new browser session without another provider call", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  expect(await ai.getLatestGeneration(ownerId, invitation.id)).toBeNull();
  const other = (await platform.auth.register({ name: "Other", email: "latest-other@example.com", password: "valid-password-123" })).user.id;
  await expect(ai.getLatestGeneration(other, invitation.id)).rejects.toMatchObject({ status: 404 });
  const result = await ai.generate(ownerId, invitation.id, input(invitation.updatedAt));
  const restarted = new PlatformAiService(new PlatformService(new PlatformStore(directory)), { plan, createArtwork });
  expect(await restarted.getLatestGeneration(ownerId, invitation.id)).toMatchObject({
    job: { requestId: result.job.requestId, status: "succeeded" },
    invitation: { id: invitation.id },
  });
  expect(plan).toHaveBeenCalledTimes(1);
  expect(createArtwork).toHaveBeenCalledTimes(1);
});

it("discovers running jobs and marks abandoned requests failed without restarting paid work", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  let entered!: () => void;
  let release!: (value: Buffer) => void;
  const called = new Promise<void>((resolve) => { entered = resolve; });
  createArtwork.mockImplementation(() => { entered(); return new Promise<Buffer>((resolve) => { release = resolve; }); });
  const request = input(invitation.updatedAt);
  const generation = ai.generate(ownerId, invitation.id, request);
  await called;
  expect(await ai.getLatestGeneration(ownerId, invitation.id)).toMatchObject({ job: { status: "running", requestId: request.requestId } });
  await platform.store.transaction((state) => {
    state.generationJobs[0].createdAt = new Date(Date.now() - 7 * 60_000).toISOString();
  });
  expect(await ai.getLatestGeneration(ownerId, invitation.id)).toMatchObject({ job: { status: "failed", error: { code: "AI_INTERRUPTED" } } });
  release(bytes);
  await generation;
  expect((await platform.getInvitation(ownerId, invitation.id)).draft).toEqual(invitation.draft);
  expect(createArtwork).toHaveBeenCalledTimes(1);
});

it("checks ownership, same-invitation references and configured keys before any provider call", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  const outsider = (await platform.auth.register({ name: "Other", email: "other@example.com", password: "valid-password-123" })).user.id;
  await expect(ai.generate(outsider, invitation.id, input(invitation.updatedAt))).rejects.toMatchObject({ code: "INVITATION_NOT_FOUND" });
  const another = await platform.createInvitation(ownerId, readyDraft());
  const media = await platform.uploadMedia(ownerId, another.id, bytes);
  await expect(ai.generate(ownerId, invitation.id, { ...input(invitation.updatedAt), referenceIds: [media.id] })).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  await expect(ai.generate(ownerId, invitation.id, input(invitation.updatedAt))).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  expect(plan).not.toHaveBeenCalled();
  expect(createArtwork).not.toHaveBeenCalled();
  expect(await platform.store.transaction((state) => state.generationJobs, false)).toEqual([]);
});

it("applies artwork and blank copy atomically, preserves facts/photos/copy and the previously published snapshot", async () => {
  const invitation = await platform.createInvitation(ownerId, { ...readyDraft(), greeting: "Только наш собственный текст", story: "Наша история" });
  const photo = await platform.uploadMedia(ownerId, invitation.id, bytes);
  const withPhoto = await platform.updateInvitation(ownerId, invitation.id, { ...invitation.draft, media: [photo] }, invitation.updatedAt);
  const published = await platform.publishInvitation(ownerId, invitation.id, withPhoto.updatedAt);
  const result = await ai.generate(ownerId, invitation.id, { ...input(published.updatedAt), referenceIds: [photo.id] });
  expect(result.job.status).toBe("succeeded");
  expect(result.invitation!.draft).toMatchObject({
    templateId: "sculpted-garden", paletteId: "sage", names: published.draft.names,
    date: published.draft.date, venue: published.draft.venue, eventType: "wedding",
    media: [photo], greeting: "Только наш собственный текст", closing: direction.closing, story: "Наша история",
  });
  expect(result.previousDraft).toEqual(published.draft);
  expect(result.invitation!.published).toEqual(published.published);
  expect(await platform.getPublicInvitation(invitation.slug)).toMatchObject({ content: published.published!.content });
  expect(plan).toHaveBeenCalledWith(expect.objectContaining({ needsGreeting: false, needsClosing: true }));
  expect(createArtwork.mock.calls[0][1]).toHaveLength(1);
  expect(createArtwork.mock.calls[0][1][0]).toEqual(await platform.getMedia(photo.id, ownerId));
  const artwork = result.invitation!.draft.artwork!;
  expect(await platform.getMedia(artwork.id, ownerId)).toBeInstanceOf(Buffer);
  await expect(platform.getMedia(artwork.id)).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
  await platform.publishInvitation(ownerId, invitation.id, result.invitation!.updatedAt);
  expect(await platform.getMedia(artwork.id)).toBeInstanceOf(Buffer);
  const state = await platform.store.transaction((state) => state.generationJobs[0], false);
  expect(state.before).toEqual(published.draft);
  expect(state.after).toEqual(result.invitation!.draft);
  expect(state.callAttempts).toEqual({ planner: 1, image: 1 });
  expect(JSON.stringify(result)).not.toContain("artworkPrompt");
  expect(JSON.stringify(result)).not.toContain("briefHash");
});

it("reserves exactly one paid request across concurrent duplicates and persistent service recreation", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  let release!: (value: Buffer) => void;
  let entered!: () => void;
  const called = new Promise<void>((resolve) => { entered = resolve; });
  createArtwork.mockImplementation(() => { entered(); return new Promise<Buffer>((resolve) => { release = resolve; }); });
  const request = input(invitation.updatedAt);
  const first = ai.generate(ownerId, invitation.id, request);
  await called;
  expect((await ai.generate(ownerId, invitation.id, request)).job.status).toBe("running");
  const restartedDuringCall = new PlatformAiService(new PlatformService(new PlatformStore(directory)), { plan, createArtwork });
  expect((await restartedDuringCall.generate(ownerId, invitation.id, request)).job.status).toBe("running");
  await expect(ai.generate(ownerId, invitation.id, input(invitation.updatedAt))).rejects.toMatchObject({ code: "AI_ALREADY_RUNNING" });
  release(bytes);
  const finished = await first;
  expect(finished.job.status).toBe("succeeded");
  vi.stubEnv("OPENAI_API_KEY", "");
  const restarted = new PlatformAiService(new PlatformService(new PlatformStore(directory)), { plan, createArtwork });
  expect((await restarted.generate(ownerId, invitation.id, request)).job.status).toBe("succeeded");
  expect(plan).toHaveBeenCalledTimes(1);
  expect(createArtwork).toHaveBeenCalledTimes(1);
  await expect(restarted.generate(ownerId, invitation.id, { ...request, brief: `${request.brief} другое описание` })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
});

it("counts reserved requests against the daily quota and preserves failures across replay", async () => {
  vi.stubEnv("PLATFORM_AI_DAILY_LIMIT", "1");
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  createArtwork.mockRejectedValue(new Error("provider raw secret detail"));
  const request = input(invitation.updatedAt);
  const result = await ai.generate(ownerId, invitation.id, request);
  expect(result.job).toMatchObject({ status: "failed", error: { code: "AI_GENERATION_FAILED" } });
  expect(JSON.stringify(result)).not.toContain("provider raw secret");
  expect((await platform.getInvitation(ownerId, invitation.id)).draft).toEqual(invitation.draft);
  expect((await ai.generate(ownerId, invitation.id, request)).job.status).toBe("failed");
  await expect(ai.generate(ownerId, invitation.id, input(invitation.updatedAt))).rejects.toMatchObject({ code: "AI_DAILY_LIMIT" });
  expect(createArtwork).toHaveBeenCalledTimes(1);
});

it("rejects invalid planner output before the image call, retaining all invitation data", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  const published = await platform.publishInvitation(ownerId, invitation.id, invitation.updatedAt);
  plan.mockResolvedValue({ ...direction, paletteId: "arbitrary-from-model", names: ["Wrong"] });
  const result = await ai.generate(ownerId, invitation.id, input(published.updatedAt));
  expect(result.job.error?.code).toBe("AI_PLAN_FAILED");
  expect(createArtwork).not.toHaveBeenCalled();
  expect(await platform.getInvitation(ownerId, invitation.id)).toEqual(published);
});

it("keeps edits made during image generation and leaves the public snapshot unchanged", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  const published = await platform.publishInvitation(ownerId, invitation.id, invitation.updatedAt);
  let edited: typeof published;
  createArtwork.mockImplementation(async () => {
    edited = await platform.updateInvitation(ownerId, invitation.id, { ...published.draft, closing: "Новая редакция владельца" }, published.updatedAt);
    return bytes;
  });
  const result = await ai.generate(ownerId, invitation.id, input(published.updatedAt));
  expect(result.job).toMatchObject({ status: "failed", error: { code: "REVISION_CONFLICT" } });
  expect(await platform.getInvitation(ownerId, invitation.id)).toEqual(edited!);
  expect(result.invitation!.published).toEqual(published.published);
});

it("does not restart a persisted in-flight paid call, including after interruption expiry", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  const request = input(invitation.updatedAt);
  await platform.store.transaction((state) => {
    state.generationJobs.push({
      requestId: request.requestId, ownerId, invitationId: invitation.id, status: "running",
      briefHash: "a".repeat(64), baseUpdatedAt: invitation.updatedAt, before: invitation.draft,
      createdAt: new Date(Date.now() - 7 * 60_000).toISOString(), updatedAt: invitation.updatedAt,
      callAttempts: { planner: 1, image: 1 },
    });
  });
  const result = await new PlatformAiService(new PlatformService(new PlatformStore(directory)), { plan, createArtwork }).getGeneration(ownerId, invitation.id, request.requestId);
  expect(result.job).toMatchObject({ status: "failed", error: { code: "AI_INTERRUPTED" } });
  expect(createArtwork).not.toHaveBeenCalled();
  const other = (await platform.auth.register({ name: "Other", email: "other@example.com", password: "valid-password-123" })).user.id;
  await expect(ai.getGeneration(other, invitation.id, request.requestId)).rejects.toMatchObject({ code: "INVITATION_NOT_FOUND" });
});

it("loads a pre-AI repository without a generationJobs field", async () => {
  const filename = path.join(directory, "state.json");
  const state = JSON.parse(await readFile(filename, "utf8"));
  delete state.generationJobs;
  await writeFile(filename, JSON.stringify(state));
  expect(await new PlatformStore(directory).transaction((saved) => saved.generationJobs, false)).toEqual([]);
});

it("fills a completely empty dress-code only when the planner supplies one and keeps existing owner choices", async () => {
  plan.mockResolvedValue({ ...direction, dressCode: { title: "Garden palette", note: "Пастельные оттенки", swatches: ["#ced9c2"] } });
  const invitation = await platform.createInvitation(ownerId, { ...readyDraft(), dressCode: { title: "", note: "", swatches: [] } });
  const result = await ai.generate(ownerId, invitation.id, input(invitation.updatedAt));
  expect(result.invitation!.draft.dressCode).toMatchObject({ title: "Garden palette", swatches: ["#ced9c2"] });
  expect(result.invitation!.draft.enabledSections).toContain("dressCode");
  const ownDressCode = { title: "Наш выбор", note: "Только синий", swatches: ["#1122aa"] };
  const second = await platform.createInvitation(ownerId, { ...readyDraft(), dressCode: ownDressCode });
  const kept = await ai.generate(ownerId, second.id, input(second.updatedAt));
  expect(kept.invitation!.draft.dressCode).toEqual(ownDressCode);
  expect(kept.invitation!.draft.enabledSections).not.toContain("dressCode");
});

it("creates and persists a composed birthday with one name without an image key or paid image call", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const composition = resolveStudioComposition("modern");
  plan.mockResolvedValue({ templateId: "modern", paletteId: "cobalt", fontPairId: "modernist", ornamentSetId: "graphic-ribbon", composition, greeting: "Буду рада встрече!", summary: "Крупная типографика, кобальт и графический плакат" });
  const invitation = await platform.createInvitation(ownerId, { ...readyDraft(), eventType: "birthday", names: ["Александра"], greeting: "Мой собственный текст" });
  const published = await platform.publishInvitation(ownerId, invitation.id, invitation.updatedAt);
  const result = await ai.generate(ownerId, invitation.id, input(published.updatedAt));
  expect(result.job.status).toBe("succeeded");
  expect(result.invitation!.draft).toMatchObject({ templateId: "modern", paletteId: "cobalt", fontPairId: "modernist", composition, names: ["Александра"], greeting: "Мой собственный текст", date: published.draft.date });
  expect(result.invitation!.draft.artwork).toBeUndefined();
  expect(createArtwork).not.toHaveBeenCalled();
  expect(result.invitation!.published).toEqual(published.published);
  expect((await new PlatformService(new PlatformStore(directory)).getInvitation(ownerId, invitation.id)).draft.composition).toEqual(composition);
  expect((await platform.store.transaction((state) => state.generationJobs[0], false)).callAttempts).toEqual({ planner: 1, image: 0 });
});

it("creates a personal greeting without an event and preserves its purpose and current headline", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  plan.mockResolvedValue({ templateId: "editorial", paletteId: "clay", fontPairId: "editorial", ornamentSetId: "editorial-rules", composition: resolveStudioComposition("editorial"), headline: "Чужой заголовок", greeting: "Пусть каждый день приносит радость.", closing: "С самыми тёплыми пожеланиями", summary: "Тёплая бумага, редакционная антиква и свободные поля" });
  const draft = { ...createEmptyDraft("editorial"), purpose: "greeting" as const, eventType: "birthday" as const, headline: "С днём рождения!", names: ["Мадина"], enabledSections: ["opening", "greeting", "story", "closing"] as const };
  const invitation = await platform.createInvitation(ownerId, { ...draft, enabledSections: [...draft.enabledSections] });
  const result = await ai.generate(ownerId, invitation.id, input(invitation.updatedAt));
  expect(result.job.status).toBe("succeeded");
  expect(result.invitation!.draft).toMatchObject({ purpose: "greeting", eventType: "birthday", headline: "С днём рождения!", names: ["Мадина"], date: invitation.draft.date, venue: invitation.draft.venue });
  expect(createArtwork).not.toHaveBeenCalled();
  expect(plan).toHaveBeenCalledWith(expect.objectContaining({ purpose: "greeting", needsHeadline: false, needsDressCode: false }));
  const published = await platform.publishInvitation(ownerId, invitation.id, result.invitation!.updatedAt);
  expect(published.published!.content.enabledSections).not.toContain("rsvp");
  await expect(platform.submitRsvp(published.slug, { name: "Guest", status: "yes", guestCount: 1 })).rejects.toMatchObject({ code: "RSVP_DISABLED" });
});

it("rejects incompatible composed typography and incomplete native plans before image work", async () => {
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  plan.mockResolvedValue({ templateId: "modern", paletteId: "cobalt", fontPairId: "modernist", ornamentSetId: "graphic-ribbon", composition: { ...resolveStudioComposition("modern"), typographyAccent: "italic-serif-accent" }, summary: "Несовместимая типографика" });
  const rejected = await ai.generate(ownerId, invitation.id, input(invitation.updatedAt));
  expect(rejected.job.error?.code).toBe("AI_PLAN_FAILED");
  expect((await platform.getInvitation(ownerId, invitation.id)).draft).toEqual(invitation.draft);
  plan.mockResolvedValue({ templateId: "botanical", paletteId: "sage", summary: "Неполный дизайн" });
  expect((await ai.generate(ownerId, invitation.id, input(invitation.updatedAt))).job.error?.code).toBe("AI_PLAN_FAILED");
  expect(createArtwork).not.toHaveBeenCalled();
});

function materialDirection(): ArtDirection {
  return { templateId: "editorial", paletteId: "ivory", fontPairId: "editorial", ornamentSetId: "editorial-rules", composition: resolveStudioComposition("editorial"),
    artDirection: { title: "Письмо на шёлке", scene: "silk", layout: "editorial" },
    artworkPrompt: "Original flowing silk and substantial woven fibres with soft reflected light and a calm central reading field.",
    greeting: "С теплом и самыми добрыми пожеланиями.", closing: "Пусть сбываются мечты.", summary: "Шёлк, мягкий свет и редакционная композиция",
  };
}

it("generates fresh material art for a native personal greeting and publishes only the selected owned image", async () => {
  const planned = materialDirection();
  plan.mockResolvedValue(planned);
  const supplied = { ...createEmptyDraft("editorial"), purpose: "greeting" as const, eventType: "birthday" as const, names: ["Амира"], headline: "С днём рождения!", greeting: "Мои личные слова", story: "Моя история", enabledSections: ["opening", "greeting", "story", "closing"] as const };
  const invitation = await platform.createInvitation(ownerId, { ...supplied, enabledSections: [...supplied.enabledSections] });
  const originalPublication = await platform.publishInvitation(ownerId, invitation.id, invitation.updatedAt);
  const request = input(originalPublication.updatedAt);
  const result = await ai.generate(ownerId, invitation.id, request);
  expect(result.job.status).toBe("succeeded");
  expect(result.invitation!.draft).toMatchObject({ artDirection: planned.artDirection, purpose: "greeting", headline: supplied.headline, names: supplied.names, greeting: supplied.greeting, story: supplied.story, date: invitation.draft.date, venue: invitation.draft.venue });
  expect(result.invitation!.published).toEqual(originalPublication.published);
  const firstArt = result.invitation!.draft.artwork!;
  expect(firstArt.src).toBe(`/api/platform/media/${firstArt.id}`);
  await expect(platform.getMedia(firstArt.id)).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
  const replay = await ai.generate(ownerId, invitation.id, request);
  expect(replay.invitation!.draft.artwork).toEqual(firstArt);
  expect(plan).toHaveBeenCalledTimes(1);
  expect(createArtwork).toHaveBeenCalledTimes(1);

  const second = await ai.generate(ownerId, invitation.id, input(result.invitation!.updatedAt));
  expect(second.job.status).toBe("succeeded");
  expect(second.invitation!.draft.artwork!.id).not.toBe(firstArt.id);
  expect(createArtwork).toHaveBeenCalledTimes(2);
  expect(plan.mock.calls[1][0].recentDesigns).toEqual(expect.arrayContaining([expect.objectContaining({ artDirection: planned.artDirection })]));
  const published = await platform.publishInvitation(ownerId, invitation.id, second.invitation!.updatedAt);
  expect(published.published!.content).toMatchObject({ artDirection: planned.artDirection, artwork: second.invitation!.draft.artwork });
  expect(await platform.getMedia(second.invitation!.draft.artwork!.id)).toBeInstanceOf(Buffer);
  await expect(platform.getMedia(firstArt.id)).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
  expect((await platform.store.transaction((state) => state.generationJobs, false)).map((job) => job.callAttempts)).toEqual([{ planner: 1, image: 1 }, { planner: 1, image: 1 }]);
  expect(JSON.stringify(second)).not.toContain("artworkPrompt");
});

it("does not silently fall back to a flat result when material image creation fails or its key is absent", async () => {
  plan.mockResolvedValue(materialDirection());
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  vi.stubEnv("OPENAI_API_KEY", "");
  const missingKey = await ai.generate(ownerId, invitation.id, input(invitation.updatedAt));
  expect(missingKey.job).toMatchObject({ status: "failed", error: { code: "AI_NOT_CONFIGURED" } });
  expect(createArtwork).not.toHaveBeenCalled();
  expect((await platform.getInvitation(ownerId, invitation.id)).draft).toEqual(invitation.draft);
  vi.stubEnv("OPENAI_API_KEY", "test-image-key");
  createArtwork.mockRejectedValue(new Error("private image error"));
  const failed = await ai.generate(ownerId, invitation.id, input(invitation.updatedAt));
  expect(failed.job.status).toBe("failed");
  expect((await platform.getInvitation(ownerId, invitation.id)).draft).toEqual(invitation.draft);
  expect(createArtwork).toHaveBeenCalledTimes(1);
});

it("clears a previous material scene and its image when a later plan explicitly returns a native flat design", async () => {
  plan.mockResolvedValue(materialDirection());
  const invitation = await platform.createInvitation(ownerId, readyDraft());
  const first = await ai.generate(ownerId, invitation.id, input(invitation.updatedAt));
  plan.mockResolvedValue({ templateId: "modern", paletteId: "cobalt", fontPairId: "modernist", ornamentSetId: "graphic-ribbon", composition: resolveStudioComposition("modern"), summary: "Явно плоский типографический плакат" });
  const flat = await ai.generate(ownerId, invitation.id, input(first.invitation!.updatedAt));
  expect(flat.job.status).toBe("succeeded");
  expect(flat.invitation!.draft.artDirection).toBeUndefined();
  expect(flat.invitation!.draft.artwork).toBeUndefined();
  expect(flat.invitation!.draft.names).toEqual(invitation.draft.names);
  expect(createArtwork).toHaveBeenCalledTimes(1);
});
