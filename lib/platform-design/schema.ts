import { z } from "zod";
import { InvitationDraftSchema, type InvitationDraft } from "@/lib/platform/schema";

/** Artwork and authored design choices only; event facts never belong to a design version. */
export const InvitationDesignSchema = InvitationDraftSchema.pick({
  templateId: true,
  paletteId: true,
  fontPairId: true,
  composition: true,
  ornamentSetId: true,
  artDirection: true,
  artwork: true,
  artworkWide: true,
}).strict();
export type InvitationDesign = z.infer<typeof InvitationDesignSchema>;

export function invitationDesign(draft: InvitationDraft): InvitationDesign {
  return InvitationDesignSchema.parse({
    templateId: draft.templateId,
    paletteId: draft.paletteId,
    fontPairId: draft.fontPairId,
    ...(draft.composition ? { composition: draft.composition } : {}),
    ...(draft.ornamentSetId ? { ornamentSetId: draft.ornamentSetId } : {}),
    ...(draft.artDirection ? { artDirection: draft.artDirection } : {}),
    ...(draft.artwork ? { artwork: draft.artwork } : {}),
    ...(draft.artworkWide ? { artworkWide: draft.artworkWide } : {}),
  });
}

/** Replacing a design also clears artwork absent from the selected version. */
export function applyInvitationDesign(draft: InvitationDraft, input: InvitationDesign): InvitationDraft {
  const design = InvitationDesignSchema.parse(input);
  const next = structuredClone(draft);
  delete next.artwork;
  delete next.artworkWide;
  delete next.composition;
  delete next.ornamentSetId;
  delete next.artDirection;
  Object.assign(next, design);
  if (!design.artwork) delete next.artwork;
  if (!design.artworkWide) delete next.artworkWide;
  if (!design.composition) delete next.composition;
  if (!design.ornamentSetId) delete next.ornamentSetId;
  if (!design.artDirection) delete next.artDirection;
  return InvitationDraftSchema.parse(next);
}

export const VersionReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("generation"), requestId: z.string().uuid(), phase: z.enum(["before", "after"]) }).strict(),
  z.object({ kind: z.literal("saved"), versionId: z.string().uuid() }).strict(),
]);
export type VersionReference = z.infer<typeof VersionReferenceSchema>;

export const StoredDesignVersionSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().min(1).max(100),
  invitationId: z.string().uuid(),
  source: z.enum(["saved", "before-restore"]),
  label: z.string().trim().min(1).max(80),
  design: InvitationDesignSchema,
  createdAt: z.string().datetime(),
}).strict();
export type StoredDesignVersion = z.infer<typeof StoredDesignVersionSchema>;

export type DesignHistoryItem = {
  key: string;
  reference: VersionReference;
  source: "before-generation" | "generated" | "saved" | "before-restore";
  createdAt: string;
  label: string;
  design: InvitationDesign;
};
export type DesignHistoryPage = { versions: DesignHistoryItem[]; nextCursor?: string };

const revision = z.string().datetime();
export const DesignHistoryInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), label: z.string().trim().min(1).max(80).optional(), expectedUpdatedAt: revision }).strict(),
  z.object({ action: z.literal("restore"), reference: VersionReferenceSchema, expectedUpdatedAt: revision }).strict(),
]);
export type DesignHistoryInput = z.infer<typeof DesignHistoryInputSchema>;
export type SaveDesignInput = Extract<DesignHistoryInput, { action: "save" }>;
export type RestoreDesignInput = Extract<DesignHistoryInput, { action: "restore" }>;
