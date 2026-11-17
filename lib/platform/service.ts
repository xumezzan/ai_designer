import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  InvitationDraftSchema,
  RsvpInputSchema,
  civilDateTimeToIso,
  publicSnapshotContent,
  invitationMediaReferences,
  type InvitationRecord,
  type InvitationSummary,
  type PublicInvitation,
  type RsvpRecord,
  type InvitationDraft,
} from "./schema";
import { platformTheme } from "@/lib/platform-render/theme";
import { PlatformStore, type PlatformState, type StoredRsvp } from "./store";
import { hashToken, PlatformAuth } from "./auth";
import { PlatformError } from "./errors";

function owned(
  state: PlatformState,
  ownerId: string,
  id: string,
): InvitationRecord {
  const invitation = state.invitations.find(
    (item) => item.id === id && item.ownerId === ownerId,
  );
  if (!invitation)
    throw new PlatformError(
      404,
      "INVITATION_NOT_FOUND",
      "Приглашение не найдено",
    );
  return invitation;
}
function publicRsvp(item: StoredRsvp): RsvpRecord {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    status: item.status,
    guestCount: item.guestCount,
    message: item.message,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
function timestamp(previous?: string) {
  return new Date(
    Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0),
  ).toISOString();
}
function assertRevision(
  invitation: InvitationRecord,
  expectedUpdatedAt?: string,
) {
  if (expectedUpdatedAt && invitation.updatedAt !== expectedUpdatedAt)
    throw new PlatformError(
      409,
      "REVISION_CONFLICT",
      "Приглашение изменено в другой вкладке. Обновите страницу",
    );
}
function assertMedia(
  state: PlatformState,
  ownerId: string,
  invitationId: string,
  media: { id: string }[],
) {
  if (
    media.some(
      (reference) =>
        !state.media.some(
          (file) =>
            file.id === reference.id &&
            file.ownerId === ownerId &&
            file.invitationId === invitationId,
        ),
    )
  )
    throw new PlatformError(
      400,
      "INVALID_MEDIA",
      "Используйте изображения, загруженные в это приглашение",
    );
}

function assertAppearance(draft: InvitationDraft) {
  if (!draft.composition) return;
  try {
    platformTheme(draft);
  } catch {
    throw new PlatformError(400, "INVALID_DESIGN", "Параметры оформления несовместимы. Проверьте композицию, палитру и шрифты");
  }
}

export class PlatformService {
  readonly auth: PlatformAuth;
  constructor(readonly store = new PlatformStore()) {
    this.auth = new PlatformAuth(store);
  }
  async listInvitations(ownerId: string): Promise<InvitationSummary[]> {
    return this.store.transaction(
      (state) =>
        state.invitations
          .filter((item) => item.ownerId === ownerId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((item) => ({
            id: item.id,
            slug: item.slug,
            status: item.status,
            title: item.draft.title,
            ...(item.draft.purpose ? { purpose: item.draft.purpose } : {}),
            templateId: item.draft.templateId,
            names: item.draft.names,
            date: item.draft.date,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            publishedAt: item.published?.publishedAt || null,
            responseCount: state.rsvps.filter(
              (response) => response.invitationId === item.id,
            ).length,
          })),
      false,
    );
  }
  async getInvitation(ownerId: string, id: string) {
    return this.store.transaction((state) => owned(state, ownerId, id), false);
  }
  async createInvitation(ownerId: string, input: unknown) {
    const draft = InvitationDraftSchema.parse(input);
    assertAppearance(draft);
    return this.store.transaction((state) => {
      if (!state.users.some((user) => user.id === ownerId))
        throw new PlatformError(401, "UNAUTHENTICATED", "Войдите в аккаунт");
      if (
        state.invitations.filter((item) => item.ownerId === ownerId).length >=
        50
      )
        throw new PlatformError(
          429,
          "INVITATION_LIMIT",
          "Достигнут лимит 50 приглашений",
        );
      const id = randomUUID();
      assertMedia(state, ownerId, id, invitationMediaReferences(draft));
      const now = timestamp();
      const invitation: InvitationRecord = {
        id,
        ownerId,
        slug: `invite-${randomBytes(12).toString("hex")}`,
        status: "draft",
        draft,
        published: null,
        createdAt: now,
        updatedAt: now,
      };
      state.invitations.push(invitation);
      return invitation;
    });
  }
  async updateInvitation(
    ownerId: string,
    id: string,
    input: unknown,
    expectedUpdatedAt?: string,
  ) {
    const draft = InvitationDraftSchema.parse(input);
    assertAppearance(draft);
    return this.store.transaction((state) => {
      const invitation = owned(state, ownerId, id);
      assertRevision(invitation, expectedUpdatedAt);
      assertMedia(state, ownerId, id, invitationMediaReferences(draft));
      invitation.draft = draft;
      invitation.updatedAt = timestamp(invitation.updatedAt);
      if (invitation.status === "archived") invitation.status = "draft";
      return invitation;
    });
  }
  async publishInvitation(
    ownerId: string,
    id: string,
    expectedUpdatedAt?: string,
  ) {
    return this.store.transaction((state) => {
      const invitation = owned(state, ownerId, id);
      assertRevision(invitation, expectedUpdatedAt);
      const draft = invitation.draft;
      assertAppearance(draft);
      if (draft.artDirection && !draft.artwork)
        throw new PlatformError(
          400,
          "INCOMPLETE_ARTWORK",
          "Перед публикацией создайте изображение для выбранной материальной концепции",
        );
      if (
        draft.names.some((name) => !name.trim()) ||
        (draft.purpose !== "greeting" && (!draft.date.day || !draft.date.time))
      )
        throw new PlatformError(
          400,
          "INCOMPLETE_INVITATION",
          draft.purpose === "greeting"
            ? "Для публикации укажите получателя поздравления"
            : "Для публикации заполните имена, дату и время события",
        );
      if (draft.purpose !== "greeting" && draft.enabledSections.includes("venue") && !draft.venue.name)
        throw new PlatformError(
          400,
          "INCOMPLETE_VENUE",
          "Укажите название места проведения",
        );
      try {
        if (draft.purpose !== "greeting") civilDateTimeToIso(
          draft.date.day,
          draft.date.time,
          draft.date.timezone,
        );
      } catch {
        throw new PlatformError(
          400,
          "INVALID_LOCAL_TIME",
          "Это время отсутствует в выбранном часовом поясе",
        );
      }
      assertMedia(state, ownerId, id, invitationMediaReferences(draft));
      const now = timestamp(invitation.updatedAt);
      invitation.published = {
        content: publicSnapshotContent(draft),
        publishedAt: now,
      };
      invitation.status = "published";
      invitation.updatedAt = now;
      return invitation;
    });
  }
  async unpublishInvitation(
    ownerId: string,
    id: string,
    expectedUpdatedAt?: string,
  ) {
    return this.changeStatus(ownerId, id, "draft", expectedUpdatedAt);
  }
  async archiveInvitation(
    ownerId: string,
    id: string,
    expectedUpdatedAt?: string,
  ) {
    return this.changeStatus(ownerId, id, "archived", expectedUpdatedAt);
  }
  private async changeStatus(
    ownerId: string,
    id: string,
    status: "draft" | "archived",
    expectedUpdatedAt?: string,
  ) {
    return this.store.transaction((state) => {
      const invitation = owned(state, ownerId, id);
      assertRevision(invitation, expectedUpdatedAt);
      invitation.status = status;
      invitation.published = null;
      invitation.updatedAt = timestamp(invitation.updatedAt);
      return invitation;
    });
  }
  async deleteInvitation(ownerId: string, id: string) {
    const files = await this.store.transaction((state) => {
      owned(state, ownerId, id);
      const ids = state.media
        .filter((item) => item.invitationId === id)
        .map((item) => item.id);
      state.invitations = state.invitations.filter((item) => item.id !== id);
      state.rsvps = state.rsvps.filter((item) => item.invitationId !== id);
      state.media = state.media.filter((item) => item.invitationId !== id);
      state.designVersions = state.designVersions.filter((item) => item.invitationId !== id);
      return ids;
    });
    await Promise.all(
      files.map((id) =>
        unlink(this.mediaPath(id)).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        }),
      ),
    );
  }
  async getPublicInvitation(slug: string): Promise<PublicInvitation | null> {
    if (!/^invite-[a-f0-9]{24}$/.test(slug)) return null;
    return this.store.transaction((state) => {
      const item = state.invitations.find(
        (item) =>
          item.slug === slug && item.status === "published" && item.published,
      );
      // Sanitize again so snapshots made by an older server build cannot expose
      // fields that were only visually hidden before this publication policy.
      return item?.published
        ? {
            slug: item.slug,
            content: publicSnapshotContent(item.published.content),
            publishedAt: item.published.publishedAt,
          }
        : null;
    }, false);
  }
  async listRsvps(ownerId: string, id: string): Promise<RsvpRecord[]> {
    return this.store.transaction((state) => {
      owned(state, ownerId, id);
      return state.rsvps
        .filter((item) => item.invitationId === id)
        .map(publicRsvp)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }, false);
  }
  async submitRsvp(slug: string, input: unknown) {
    const data = RsvpInputSchema.parse(input);
    return this.store.transaction((state) => {
      const invitation = state.invitations.find(
        (item) =>
          item.slug === slug && item.status === "published" && item.published,
      );
      if (!invitation?.published)
        throw new PlatformError(
          404,
          "INVITATION_NOT_FOUND",
          "Приглашение не найдено",
        );
      if (invitation.published.content.purpose === "greeting" || !invitation.published.content.enabledSections.includes("rsvp"))
        throw new PlatformError(400, "RSVP_DISABLED", "Приём ответов отключён");
      let response: StoredRsvp | undefined;
      let editToken = data.editToken;
      if (editToken) {
        response = state.rsvps.find(
          (item) =>
            item.invitationId === invitation.id &&
            item.editTokenHash === hashToken(editToken!),
        );
        if (!response)
          throw new PlatformError(
            403,
            "INVALID_EDIT_TOKEN",
            "Не удалось подтвердить право изменения ответа",
          );
      } else {
        if (
          state.rsvps.filter((item) => item.invitationId === invitation.id)
            .length >= 5000
        )
          throw new PlatformError(429, "RSVP_LIMIT", "Лимит ответов достигнут");
        editToken = randomBytes(32).toString("hex");
        const now = timestamp();
        response = {
          id: randomUUID(),
          invitationId: invitation.id,
          editTokenHash: hashToken(editToken),
          name: data.name,
          status: data.status,
          guestCount: data.guestCount,
          createdAt: now,
          updatedAt: now,
        };
        state.rsvps.push(response);
      }
      Object.assign(response, {
        name: data.name,
        email: data.email,
        status: data.status,
        guestCount: data.guestCount,
        message: data.message,
        updatedAt: timestamp(response.updatedAt),
      });
      return { response: publicRsvp(response), editToken };
    });
  }
  private mediaPath(id: string) {
    return path.join(this.store.directory, "media", `${id}.webp`);
  }
  async uploadMedia(ownerId: string, invitationId: string, buffer: Buffer) {
    await this.getInvitation(ownerId, invitationId);
    if (!buffer.length || buffer.length > 8 * 1024 * 1024)
      throw new PlatformError(
        413,
        "IMAGE_TOO_LARGE",
        "Размер изображения должен быть не более 8 МБ",
      );
    const jpeg = buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png = buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP";
    if (!jpeg && !png && !webp)
      throw new PlatformError(
        415,
        "INVALID_IMAGE",
        "Поддерживаются JPEG, PNG и WebP",
      );
    let encoded: Buffer;
    try {
      encoded = await sharp(buffer, {
        limitInputPixels: 40_000_000,
        animated: false,
      })
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new PlatformError(
        400,
        "INVALID_IMAGE",
        "Изображение повреждено или слишком велико",
      );
    }
    const id = randomUUID();
    await mkdir(path.join(this.store.directory, "media"), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(this.mediaPath(id), encoded, { mode: 0o600, flag: "wx" });
    try {
      await this.store.transaction((state) => {
        owned(state, ownerId, invitationId);
        if (
          state.media.filter((item) => item.invitationId === invitationId)
            .length >= 12
        )
          throw new PlatformError(
            429,
            "MEDIA_LIMIT",
            "Можно загрузить не более 12 изображений",
          );
        state.media.push({ id, ownerId, invitationId, createdAt: timestamp() });
      });
    } catch (error) {
      await unlink(this.mediaPath(id));
      throw error;
    }
    return { id, src: `/api/platform/media/${id}` };
  }
  async getMedia(id: string, viewerId?: string): Promise<Buffer> {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)
    )
      throw new PlatformError(404, "MEDIA_NOT_FOUND", "Изображение не найдено");
    await this.store.transaction((state) => {
      const media = state.media.find((item) => item.id === id);
      const published = state.invitations.some(
        (item) =>
          item.status === "published" &&
          item.published &&
          invitationMediaReferences(item.published.content).some(
            (reference) => reference.id === id,
          ),
      );
      if (!media || (media.ownerId !== viewerId && !published))
        throw new PlatformError(
          404,
          "MEDIA_NOT_FOUND",
          "Изображение не найдено",
        );
    }, false);
    try {
      return await readFile(this.mediaPath(id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new PlatformError(
          404,
          "MEDIA_NOT_FOUND",
          "Изображение не найдено",
        );
      throw error;
    }
  }
}

export const platformService = new PlatformService();
export const getPublicInvitation = (slug: string) =>
  platformService.getPublicInvitation(slug);
