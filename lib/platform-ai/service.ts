import { createHash } from "node:crypto";
import { PlatformError } from "@/lib/platform/errors";
import { InvitationDraftSchema, MediaReferenceSchema, type InvitationDraft, type InvitationRecord } from "@/lib/platform/schema";
import { platformTheme } from "@/lib/platform-render/theme";
import { PlatformService, platformService } from "@/lib/platform/service";
import type { PlatformState } from "@/lib/platform/store";
import { AiProviderError, assertAiConfigured, NativeInvitationAiProvider, type InvitationAiProvider } from "./provider";
import { ArtDirectionSchema, CatalogPlanSchema, GenerationInputSchema, type GenerationInput, type GenerationJob, type GenerationView } from "./schema";
import { getMoodProfile, resolveMoodProfile } from "@/registry/moodProfiles";

const errorMessages: Record<string, string> = {
  AI_PLAN_FAILED: "Не удалось подготовить дизайн. Предыдущая версия сохранена",
  AI_IMAGE_FAILED: "Не удалось создать изображение. Предыдущая версия сохранена",
  AI_PROVIDER_LIMIT: "AI-сервис ограничил запрос. Предыдущая версия сохранена",
  AI_INTERRUPTED: "Генерация прервалась. Предыдущая версия сохранена; новый запуск требует отдельного запроса",
  REVISION_CONFLICT: "Приглашение изменилось во время генерации. Ваши изменения сохранены",
  MEDIA_LIMIT: "Достигнут лимит изображений. Предыдущая версия сохранена",
  AI_GENERATION_FAILED: "Генерация не завершилась. Предыдущая версия сохранена",
  AI_NOT_CONFIGURED: "AI-сервис недоступен. Проверьте настройки доступа. Предыдущая версия сохранена",
};
const staleAfterMs = 6 * 60_000;
const dayMs = 24 * 60 * 60_000;

function owned(state: PlatformState, ownerId: string, id: string): InvitationRecord {
  const invitation = state.invitations.find((item) => item.id === id && item.ownerId === ownerId);
  if (!invitation) throw new PlatformError(404, "INVITATION_NOT_FOUND", "Приглашение не найдено");
  return invitation;
}
function findJob(state: PlatformState, ownerId: string, invitationId: string, requestId: string) {
  const job = state.generationJobs.find((item) => item.ownerId === ownerId && item.invitationId === invitationId && item.requestId === requestId);
  if (!job) throw new PlatformError(404, "GENERATION_NOT_FOUND", "Генерация не найдена");
  return job;
}
function fail(job: GenerationJob, code: string, now = new Date().toISOString()) {
  job.status = "failed";
  job.errorCode = code;
  job.updatedAt = now;
}
function expireJobs(state: PlatformState, ownerId: string) {
  for (const job of state.generationJobs) {
    if (job.ownerId === ownerId && job.status === "running" && Date.now() - Date.parse(job.createdAt) > staleAfterMs)
      fail(job, "AI_INTERRUPTED");
  }
}
function view(job: GenerationJob, invitation: InvitationRecord): GenerationView {
  return {
    job: {
      requestId: job.requestId, status: job.status, createdAt: job.createdAt, updatedAt: job.updatedAt,
      ...(job.summary ? { summary: job.summary } : {}),
      ...(job.errorCode ? { error: { code: job.errorCode, message: errorMessages[job.errorCode] || errorMessages.AI_GENERATION_FAILED } } : {}),
    },
    ...(job.status === "running" ? {} : { invitation }),
    ...(job.status === "succeeded" ? { previousDraft: job.before } : {}),
  };
}
function requestHash(input: GenerationInput) {
  return createHash("sha256").update(JSON.stringify({
    brief: input.brief, referenceIds: input.referenceIds, expectedUpdatedAt: input.expectedUpdatedAt,
  })).digest("hex");
}
function dailyLimit() {
  const value = Number(process.env.PLATFORM_AI_DAILY_LIMIT || 3);
  return Number.isFinite(value) ? Math.max(1, Math.min(20, Math.floor(value))) : 3;
}
function hasDressCode(draft: GenerationJob["before"]) {
  return Boolean(draft.dressCode && (draft.dressCode.title.trim() || draft.dressCode.note?.trim() || draft.dressCode.swatches.length));
}

export class PlatformAiService {
  constructor(
    readonly platform: PlatformService = platformService,
    private readonly provider: InvitationAiProvider = new NativeInvitationAiProvider(),
  ) {}

  async getLatestGeneration(ownerId: string, invitationId: string): Promise<GenerationView | null> {
    return this.platform.store.transaction((state) => {
      const invitation = owned(state, ownerId, invitationId);
      expireJobs(state, ownerId);
      const job = state.generationJobs
        .filter((item) => item.ownerId === ownerId && item.invitationId === invitationId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.requestId.localeCompare(a.requestId))[0];
      return job ? view(job, invitation) : null;
    });
  }

  async getGeneration(ownerId: string, invitationId: string, requestId: string): Promise<GenerationView> {
    return this.platform.store.transaction((state) => {
      const invitation = owned(state, ownerId, invitationId);
      expireJobs(state, ownerId);
      return view(findJob(state, ownerId, invitationId, requestId), invitation);
    });
  }

  async generate(ownerId: string, invitationId: string, input: unknown): Promise<GenerationView> {
    const data = GenerationInputSchema.parse(input);
    const hash = requestHash(data);
    const reserved = await this.platform.store.transaction((state) => {
      const invitation = owned(state, ownerId, invitationId);
      expireJobs(state, ownerId);
      const existing = state.generationJobs.find((job) => job.ownerId === ownerId && job.requestId === data.requestId);
      if (existing) {
        if (existing.invitationId !== invitationId || existing.briefHash !== hash)
          throw new PlatformError(409, "IDEMPOTENCY_CONFLICT", "Этот запрос уже использован с другими параметрами");
        return { start: false, result: view(existing, invitation), job: existing };
      }
      if (invitation.updatedAt !== data.expectedUpdatedAt)
        throw new PlatformError(409, "REVISION_CONFLICT", "Приглашение изменено. Обновите страницу перед генерацией");
      if (state.generationJobs.some((job) => job.ownerId === ownerId && job.status === "running"))
        throw new PlatformError(409, "AI_ALREADY_RUNNING", "Дождитесь завершения текущей генерации");
      if (state.generationJobs.filter((job) => job.ownerId === ownerId && Date.now() - Date.parse(job.createdAt) < dayMs).length >= dailyLimit())
        throw new PlatformError(429, "AI_DAILY_LIMIT", "Достигнут лимит AI-генераций за 24 часа");
      if (data.referenceIds.some((id) => !state.media.some((media) => media.id === id && media.ownerId === ownerId && media.invitationId === invitationId)))
        throw new PlatformError(400, "INVALID_REFERENCE", "Используйте референсы, загруженные в это приглашение");
      // Catalog generation requires only the planner.
      assertAiConfigured(false);
      const now = new Date().toISOString();
      const job: GenerationJob = {
        requestId: data.requestId, invitationId, ownerId, briefHash: hash,
        status: "running", createdAt: now, updatedAt: now, baseUpdatedAt: invitation.updatedAt,
        callAttempts: { planner: 0, image: 0 }, before: structuredClone(invitation.draft),
      };
      state.generationJobs.push(job);
      return { start: true, result: view(job, invitation), job };
    });
    if (!reserved.start) return reserved.result;

    try {
      const references = await Promise.all(data.referenceIds.map((id) => this.platform.getMedia(id, ownerId)));
      await this.markCall(ownerId, invitationId, data.requestId, "planner");
      const before = reserved.job.before;
      const recentDesigns = await this.platform.store.transaction((state) => state.generationJobs
        .filter((job) => job.ownerId === ownerId && job.after)
        .slice(-3).map(({ after }) => ({
          templateId: after!.templateId, paletteId: after!.paletteId, fontPairId: after!.fontPairId,
          ...(after!.composition ? { composition: after!.composition } : {}),
          ...(after!.artDirection ? { artDirection: after!.artDirection } : {}),
        })), false);
      const needsHeadline = before.purpose === "greeting" && !before.headline?.trim();
      const planned = await this.provider.plan({
        brief: data.brief, locale: before.locale, eventType: before.eventType,
        purpose: before.purpose ?? "invitation", needsHeadline,
        hasPhotos: before.media.length > 0, references, recentDesigns,
        needsGreeting: !before.greeting.trim(), needsClosing: !before.closing.trim(),
        needsDressCode: before.purpose !== "greeting" && !hasDressCode(before),
      });
      const catalogResult = CatalogPlanSchema.safeParse(planned);
      const catalog = catalogResult.success ? catalogResult.data : undefined;
      const legacyResult = catalog ? undefined : ArtDirectionSchema.safeParse(planned);
      const legacy = legacyResult?.success ? legacyResult.data : undefined;
      const copy = catalog ?? legacy;
      if (!copy) throw new AiProviderError("AI_PLAN_FAILED");

      const profile = catalog ? getMoodProfile(catalog.themeId) : legacy && resolveMoodProfile(legacy);
      if (catalog && !profile) throw new AiProviderError("AI_PLAN_FAILED");
      const templateId = profile?.selection.templateId ?? legacy?.templateId ?? "sculpted-garden";
      const legacySculpted = templateId === "sculpted-garden" && !legacy?.artDirection;
      if (before.purpose === "greeting" && legacySculpted) throw new AiProviderError("AI_PLAN_FAILED");
      const appearance: Partial<InvitationDraft> = {
        templateId, paletteId: legacy?.paletteId ?? before.paletteId,
        fontPairId: legacy?.fontPairId ?? "editorial",
        composition: legacySculpted ? undefined : legacy?.composition,
        ornamentSetId: legacySculpted ? undefined : legacy?.ornamentSetId,
        ...profile?.selection,
        artDirection: profile ? undefined : legacy?.artDirection,
        artwork: undefined, artworkWide: undefined,
      };
      if (catalog && profile) {
        const { heroLayout, sectionOrder, motionPreset, sectionVariants } = catalog;
        const base = profile.selection.composition;
        appearance.composition = {
          ...base,
          heroLayout: heroLayout ?? base.heroLayout,
          ...(sectionOrder ? { sectionOrder } : {}),
          ...(motionPreset ? { motionPreset } : {}),
          sectionVariants: { ...base.sectionVariants, ...sectionVariants },
        };
      }
      if (templateId !== "sculpted-garden") {
        try { platformTheme({ ...before, ...appearance }); }
        catch { throw new AiProviderError("AI_PLAN_FAILED"); }
      }
      let artwork: InvitationDraft["artwork"];
      if (legacy && !profile && (legacy.artDirection || legacySculpted)) {
        assertAiConfigured();
        await this.platform.store.transaction((state) => {
          if (state.media.filter((media) => media.invitationId === invitationId).length >= 12)
            throw new PlatformError(429, "MEDIA_LIMIT", "Достигнут лимит изображений приглашения");
        }, false);
        await this.markCall(ownerId, invitationId, data.requestId, "image");
        const bytes = await this.provider.createArtwork(legacy, references);
        artwork = MediaReferenceSchema.parse(await this.platform.uploadMedia(ownerId, invitationId, bytes));
      }
      await this.platform.store.transaction((state) => {
        const invitation = owned(state, ownerId, invitationId);
        const job = findJob(state, ownerId, invitationId, data.requestId);
        if (job.status !== "running") return;
        if (invitation.updatedAt !== job.baseUpdatedAt) {
          fail(job, "REVISION_CONFLICT");
          return;
        }
        const generatedDressCode = before.purpose !== "greeting" && !hasDressCode(before) ? copy.dressCode : undefined;
        const enabledSections = before.purpose === "greeting"
          ? before.enabledSections.filter((section) => ["opening", "greeting", "story", "wishes", "closing"].includes(section))
          : [...before.enabledSections];
        if (generatedDressCode && !enabledSections.includes("dressCode")) {
          const following = enabledSections.findIndex((section) => section === "rsvp" || section === "closing");
          enabledSections.splice(following < 0 ? enabledSections.length : following, 0, "dressCode");
        }
        const candidate = InvitationDraftSchema.parse({
          ...before, ...appearance, artwork,
          headline: needsHeadline ? copy.headline : before.headline,
          greeting: before.greeting.trim() ? before.greeting : copy.greeting || "",
          closing: before.closing.trim() ? before.closing : copy.closing || "",
          dressCode: generatedDressCode || before.dressCode,
          enabledSections,
        });
        invitation.draft = candidate;
        invitation.updatedAt = new Date(Math.max(Date.now(), Date.parse(invitation.updatedAt) + 1)).toISOString();
        if (invitation.status === "archived") invitation.status = "draft";
        job.status = "succeeded";
        job.updatedAt = invitation.updatedAt;
        job.after = structuredClone(candidate);
        job.summary = copy.summary;
        // The last published snapshot remains unchanged until explicit publication.
      });
    } catch (error) {
      const code = error instanceof AiProviderError ? error.code : error instanceof PlatformError && ["REVISION_CONFLICT", "MEDIA_LIMIT", "AI_NOT_CONFIGURED"].includes(error.code) ? error.code : "AI_GENERATION_FAILED";
      await this.platform.store.transaction((state) => {
        const job = findJob(state, ownerId, invitationId, data.requestId);
        if (job.status === "running") fail(job, code);
      });
    }
    return this.getGeneration(ownerId, invitationId, data.requestId);
  }

  private async markCall(ownerId: string, invitationId: string, requestId: string, kind: "planner" | "image") {
    await this.platform.store.transaction((state) => {
      const invitation = owned(state, ownerId, invitationId);
      const job = findJob(state, ownerId, invitationId, requestId);
      if (job.status !== "running" || job.callAttempts[kind])
        throw new PlatformError(409, "AI_ALREADY_RUNNING", "Запрос уже обработан");
      if (invitation.updatedAt !== job.baseUpdatedAt)
        throw new PlatformError(409, "REVISION_CONFLICT", "Приглашение изменилось во время генерации");
      job.callAttempts[kind] = 1;
      job.updatedAt = new Date().toISOString();
    });
  }
}

export const platformAiService = new PlatformAiService();
