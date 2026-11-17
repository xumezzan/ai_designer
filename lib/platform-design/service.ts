import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PlatformError } from "@/lib/platform/errors";
import { invitationMediaReferences, type InvitationRecord } from "@/lib/platform/schema";
import { PlatformService, platformService } from "@/lib/platform/service";
import type { PlatformState } from "@/lib/platform/store";
import {
  applyInvitationDesign,
  DesignHistoryInputSchema,
  invitationDesign,
  type DesignHistoryItem,
  type DesignHistoryPage,
  type InvitationDesign,
  type RestoreDesignInput,
  type SaveDesignInput,
  type VersionReference,
} from "./schema";

const pageSize = 20;
const maxSavedVersions = 50;
const runningWindowMs = 6 * 60_000;
const CursorSchema = z.object({
  v: z.literal(1),
  invitationId: z.string().uuid(),
  createdAt: z.string().datetime(),
  key: z.string().min(1).max(100).regex(/^(generation:[a-f0-9-]{36}:(before|after)|saved:[a-f0-9-]{36})$/i),
}).strict();

function owned(state: PlatformState, ownerId: string, invitationId: string) {
  const invitation = state.invitations.find((item) => item.id === invitationId && item.ownerId === ownerId);
  if (!invitation) throw new PlatformError(404, "INVITATION_NOT_FOUND", "Приглашение не найдено");
  return invitation;
}
function assertMutation(state: PlatformState, invitation: InvitationRecord, expectedUpdatedAt: string) {
  if (invitation.updatedAt !== expectedUpdatedAt)
    throw new PlatformError(409, "REVISION_CONFLICT", "Приглашение изменилось. Обновите его перед выбором оформления");
  if (state.generationJobs.some((job) => job.ownerId === invitation.ownerId && job.invitationId === invitation.id && job.status === "running" && Date.now() - Date.parse(job.createdAt) < runningWindowMs))
    throw new PlatformError(409, "AI_ALREADY_RUNNING", "Дождитесь завершения текущей генерации");
}
function equalDesign(first: InvitationDesign, second: InvitationDesign) {
  return JSON.stringify(first) === JSON.stringify(second);
}
function nextTimestamp(state: PlatformState, invitation: InvitationRecord) {
  const latest = state.designVersions.filter((version) => version.invitationId === invitation.id)
    .reduce((maximum, version) => Math.max(maximum, Date.parse(version.createdAt)), Date.parse(invitation.updatedAt));
  return new Date(Math.max(Date.now(), latest + 1)).toISOString();
}
function assertCapacity(state: PlatformState, invitationId: string) {
  if (state.designVersions.filter((version) => version.invitationId === invitationId).length >= maxSavedVersions)
    throw new PlatformError(429, "DESIGN_HISTORY_LIMIT", "Достигнут лимит 50 сохранённых оформлений для приглашения");
}
function cursorError(): never {
  throw new PlatformError(400, "INVALID_CURSOR", "Ссылка на страницу истории устарела или некорректна. Обновите историю");
}
function decodeCursor(cursor: string, invitationId: string) {
  try {
    if (!/^[A-Za-z0-9_-]{1,600}$/.test(cursor)) return cursorError();
    const bytes = Buffer.from(cursor, "base64url");
    if (bytes.toString("base64url") !== cursor) return cursorError();
    const decoded = CursorSchema.parse(JSON.parse(bytes.toString("utf8")));
    if (decoded.invitationId !== invitationId) return cursorError();
    return decoded;
  } catch { return cursorError(); }
}
function historyItems(state: PlatformState, ownerId: string, invitationId: string): DesignHistoryItem[] {
  const versions: DesignHistoryItem[] = state.designVersions
    .filter((version) => version.ownerId === ownerId && version.invitationId === invitationId)
    .map((version) => ({
      key: `saved:${version.id}`,
      reference: { kind: "saved", versionId: version.id },
      source: version.source,
      createdAt: version.createdAt,
      label: version.label,
      design: version.design,
    }));
  for (const job of state.generationJobs) {
    if (job.ownerId !== ownerId || job.invitationId !== invitationId || job.status !== "succeeded" || !job.after) continue;
    versions.push({
      key: `generation:${job.requestId}:before`,
      reference: { kind: "generation", requestId: job.requestId, phase: "before" },
      source: "before-generation",
      createdAt: job.createdAt,
      label: job.before.locale === "ru" ? "До генерации" : "Yaratishdan oldin",
      design: invitationDesign(job.before),
    }, {
      key: `generation:${job.requestId}:after`,
      reference: { kind: "generation", requestId: job.requestId, phase: "after" },
      source: "generated",
      createdAt: job.updatedAt,
      label: job.summary?.trim().slice(0, 80) || (job.after.locale === "ru" ? "Оформление ИИ" : "AI bezagi"),
      design: invitationDesign(job.after),
    });
  }
  return versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.key.localeCompare(a.key));
}
function referenceKey(reference: VersionReference) {
  return reference.kind === "saved" ? `saved:${reference.versionId}` : `generation:${reference.requestId}:${reference.phase}`;
}
function assertMedia(state: PlatformState, invitation: InvitationRecord, draft: InvitationRecord["draft"]) {
  if (invitationMediaReferences(draft).some((reference) => !state.media.some((media) => media.id === reference.id && media.ownerId === invitation.ownerId && media.invitationId === invitation.id)))
    throw new PlatformError(400, "INVALID_MEDIA", "Изображения оформления должны принадлежать этому приглашению");
}

export class PlatformDesignService {
  constructor(readonly platform: PlatformService = platformService) {}

  async list(ownerId: string, invitationId: string, cursor?: string): Promise<DesignHistoryPage> {
    return this.platform.store.transaction((state) => {
      owned(state, ownerId, invitationId);
      const versions = historyItems(state, ownerId, invitationId);
      let start = 0;
      if (cursor !== undefined) {
        const decoded = decodeCursor(cursor, invitationId);
        const index = versions.findIndex((version) => version.key === decoded.key && version.createdAt === decoded.createdAt);
        if (index < 0) return cursorError();
        start = index + 1;
      }
      const selected = versions.slice(start, start + pageSize);
      const last = selected.at(-1);
      return {
        versions: selected,
        ...(last && start + selected.length < versions.length ? {
          nextCursor: Buffer.from(JSON.stringify({ v: 1, invitationId, createdAt: last.createdAt, key: last.key })).toString("base64url"),
        } : {}),
      };
    }, false);
  }

  async save(ownerId: string, invitationId: string, input: SaveDesignInput): Promise<InvitationRecord> {
    const parsed = DesignHistoryInputSchema.parse(input);
    if (parsed.action !== "save") throw new PlatformError(400, "INVALID_ACTION", "Некорректное действие истории");
    return this.platform.store.transaction((state) => {
      const invitation = owned(state, ownerId, invitationId);
      assertMutation(state, invitation, parsed.expectedUpdatedAt);
      const design = invitationDesign(invitation.draft);
      assertMedia(state, invitation, invitation.draft);
      if (state.designVersions.some((version) => version.ownerId === ownerId && version.invitationId === invitationId && version.source === "saved" && equalDesign(version.design, design))) return invitation;
      assertCapacity(state, invitationId);
      state.designVersions.push({
        id: randomUUID(), ownerId, invitationId, source: "saved",
        label: parsed.label || (invitation.draft.locale === "ru" ? "Сохранённое оформление" : "Saqlangan bezak"),
        design,
        createdAt: nextTimestamp(state, invitation),
      });
      // Saving a checkpoint changes history, not the current draft revision.
      return invitation;
    });
  }

  async restore(ownerId: string, invitationId: string, input: RestoreDesignInput): Promise<InvitationRecord> {
    const parsed = DesignHistoryInputSchema.parse(input);
    if (parsed.action !== "restore") throw new PlatformError(400, "INVALID_ACTION", "Некорректное действие истории");
    return this.platform.store.transaction((state) => {
      const invitation = owned(state, ownerId, invitationId);
      assertMutation(state, invitation, parsed.expectedUpdatedAt);
      if (invitation.status === "archived") throw new PlatformError(409, "INVITATION_ARCHIVED", "Сначала восстановите приглашение из архива");
      const target = historyItems(state, ownerId, invitationId).find((version) => version.key === referenceKey(parsed.reference));
      if (!target) throw new PlatformError(404, "DESIGN_VERSION_NOT_FOUND", "Оформление не найдено");
      const candidate = applyInvitationDesign(invitation.draft, target.design);
      assertMedia(state, invitation, candidate);
      const current = invitationDesign(invitation.draft);
      if (equalDesign(current, target.design)) return invitation;
      const alreadySaved = state.designVersions.some((version) => version.ownerId === ownerId && version.invitationId === invitationId && equalDesign(version.design, current));
      if (!alreadySaved) {
        assertCapacity(state, invitationId);
        state.designVersions.push({
          id: randomUUID(), ownerId, invitationId, source: "before-restore",
          label: invitation.draft.locale === "ru" ? "До восстановления" : "Qaytarishdan oldin",
          design: current,
          createdAt: nextTimestamp(state, invitation),
        });
      }
      invitation.draft = candidate;
      invitation.updatedAt = nextTimestamp(state, invitation);
      // Status and the frozen published snapshot remain untouched.
      return invitation;
    });
  }
}

export const platformDesignService = new PlatformDesignService();
