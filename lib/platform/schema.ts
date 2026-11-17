import { z } from "zod";
import type { Content } from "@/lib/schema/content";
import { resolveWallTime } from "@/lib/studio/date";
import { MaterialArtDirectionSchema } from "./art-direction";
import {
  STUDIO_FONT_PAIR_IDS,
  STUDIO_ORNAMENT_SET_IDS,
  STUDIO_PALETTE_IDS,
  StudioComposition,
} from "@/lib/schema/studioTemplate";

export const TEMPLATE_IDS = [
  "classic",
  "botanical",
  "nocturne",
  "heritage",
  "sculpted-garden",
  "editorial",
  "modern",
  "corporate",
] as const;
export const PALETTE_IDS = [
  ...STUDIO_PALETTE_IDS,
  "midnight",
] as const;
export const FONT_PAIR_IDS = [
  ...STUDIO_FONT_PAIR_IDS,
  "classic",
  "modern",
  "romantic",
] as const;
export const SECTION_IDS = [
  "opening",
  "greeting",
  "story",
  "date",
  "venue",
  "timeline",
  "dressCode",
  "wishes",
  "rsvp",
  "closing",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export type SectionId = (typeof SECTION_IDS)[number];

const text = (max: number) => z.string().trim().max(max);
const timezone = z
  .string()
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Укажите часовой пояс IANA");
const httpUrl = z
  .string()
  .url()
  .max(2000)
  .refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }, "Допустимы только HTTP(S) ссылки без пароля");
export const MediaReferenceSchema = z
  .object({
    id: z.string().uuid(),
    src: z.string().regex(/^\/api\/platform\/media\/[0-9a-f-]{36}$/),
  })
  .strict()
  .refine(
    (value) => value.src === `/api/platform/media/${value.id}`,
    "Некорректная ссылка на изображение",
  );

export const InvitationDraftSchema = z
  .object({
    title: text(120).min(1),
    purpose: z.enum(["invitation", "greeting"]).optional(),
    headline: text(200).optional(),
    templateId: z.enum(TEMPLATE_IDS),
    paletteId: z.enum(PALETTE_IDS),
    fontPairId: z.enum(FONT_PAIR_IDS),
    composition: StudioComposition.optional(),
    ornamentSetId: z.enum(STUDIO_ORNAMENT_SET_IDS).optional(),
    artDirection: MaterialArtDirectionSchema.optional(),
    eventType: z.enum([
      "wedding",
      "anniversary",
      "birthday",
      "corporate",
      "engagement",
      "other",
    ]),
    locale: z.enum(["ru", "uz-latn"]),
    names: z.array(text(100)).min(1).max(6),
    date: z
      .object({
        day: z.union([z.literal(""), z.string().date()]),
        time: z.union([
          z.literal(""),
          z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        ]),
        timezone,
        showCountdown: z.boolean(),
      })
      .strict(),
    greeting: text(4000),
    story: text(10000).optional(),
    wishes: text(10000).optional(),
    venue: z
      .object({
        name: text(200),
        address: text(500),
        mapUrl: httpUrl.optional(),
        note: text(2000).optional(),
      })
      .strict(),
    timeline: z
      .array(
        z
          .object({
            time: text(20),
            title: text(160),
            note: text(1000).optional(),
          })
          .strict(),
      )
      .max(30),
    dressCode: z
      .object({
        title: text(200),
        note: text(2000).optional(),
        swatches: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(8),
      })
      .strict()
      .optional(),
    closing: text(2000),
    enabledSections: z
      .array(z.enum(SECTION_IDS))
      .max(SECTION_IDS.length)
      .refine(
        (values) => new Set(values).size === values.length,
        "Разделы не должны повторяться",
      ),
    media: z.array(MediaReferenceSchema).max(12),
    artwork: MediaReferenceSchema.optional(),
    artworkWide: MediaReferenceSchema.optional(),
  })
  .strict();
export type InvitationDraft = z.infer<typeof InvitationDraftSchema>;

/** Only registered media can cross the draft/publication boundary. */
export function invitationMediaReferences(draft: InvitationDraft) {
  return [
    ...draft.media,
    ...(draft.artwork ? [draft.artwork] : []),
    ...(draft.artworkWide ? [draft.artworkWide] : []),
  ];
}

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};
export type InvitationStatus = "draft" | "published" | "archived";
export type PublishedSnapshot = {
  content: InvitationDraft;
  publishedAt: string;
};
export type InvitationRecord = {
  id: string;
  ownerId: string;
  slug: string;
  status: InvitationStatus;
  draft: InvitationDraft;
  published: PublishedSnapshot | null;
  createdAt: string;
  updatedAt: string;
};
export type InvitationSummary = {
  id: string;
  slug: string;
  status: InvitationStatus;
  title: string;
  purpose?: InvitationDraft["purpose"];
  templateId: TemplateId;
  names: string[];
  date: InvitationDraft["date"];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  responseCount: number;
};
export type PublicInvitation = {
  slug: string;
  content: InvitationDraft;
  publishedAt: string;
};
export const RsvpInputSchema = z
  .object({
    name: text(120).min(1),
    email: z.string().trim().email().max(254).optional(),
    status: z.enum(["yes", "no", "maybe"]),
    guestCount: z.number().int().min(1).max(20),
    message: text(2000).optional(),
    editToken: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();
export type RsvpInput = z.infer<typeof RsvpInputSchema>;
export type RsvpRecord = {
  id: string;
  name: string;
  email?: string;
  status: RsvpInput["status"];
  guestCount: number;
  message?: string;
  createdAt: string;
  updatedAt: string;
};

export function createEmptyDraft(
  templateId: TemplateId = "classic",
): InvitationDraft {
  return {
    title: "Моё приглашение",
    templateId,
    paletteId:
      templateId === "nocturne"
        ? "midnight"
        : templateId === "botanical"
          ? "sage"
          : templateId === "heritage"
            ? "cinnabar"
            : "ivory",
    fontPairId: templateId === "heritage" ? "romantic" : "editorial",
    eventType: "wedding",
    locale: "ru",
    names: ["", ""],
    date: { day: "", time: "", timezone: "Asia/Tashkent", showCountdown: true },
    greeting: "",
    story: "",
    venue: { name: "", address: "" },
    timeline: [],
    closing: "",
    enabledSections: [
      "opening",
      "greeting",
      "date",
      "venue",
      "timeline",
      "rsvp",
      "closing",
    ],
    media: [],
  };
}

/** A public snapshot contains only enabled guest-facing event facts. */
export function publicSnapshotContent(draft: InvitationDraft): InvitationDraft {
  const content = structuredClone(draft);
  if (content.purpose === "greeting") {
    // Date, location and guest actions can remain in the private draft when
    // switching modes, but a congratulatory page never publishes them.
    content.enabledSections = content.enabledSections.filter((section) =>
      ["opening", "greeting", "story", "wishes", "closing"].includes(section),
    );
  }
  const enabled = new Set(content.enabledSections);
  content.title = content.names
    .filter((name) => name.trim())
    .join(" & ")
    .slice(0, 120);
  if (!enabled.has("greeting")) content.greeting = "";
  if (!enabled.has("story")) delete content.story;
  if (!enabled.has("date"))
    content.date = {
      day: "",
      time: "",
      timezone: content.date.timezone,
      showCountdown: false,
    };
  if (!enabled.has("venue")) content.venue = { name: "", address: "" };
  if (!enabled.has("timeline")) content.timeline = [];
  if (!enabled.has("dressCode")) delete content.dressCode;
  if (!enabled.has("wishes")) delete content.wishes;
  if (!enabled.has("closing")) content.closing = "";
  if (!content.artDirection && (content.templateId !== "sculpted-garden" || content.purpose === "greeting")) {
    delete content.artwork;
    delete content.artworkWide;
  }
  return content;
}

/** Share studio IANA resolution, including DST gap and overlap rejection. */
export function civilDateTimeToIso(
  day: string,
  time: string,
  zone: string,
): string {
  if (!day || !time) return "";
  return new Date(resolveWallTime(`${day}T${time}`, zone)).toISOString();
}

/** Feed existing renderers from platform facts without invoking generation or AI. */
export function toInvitationContent(
  draft: InvitationDraft,
  slug: string,
): Content {
  const enabled = new Set(draft.enabledSections.filter((section) =>
    draft.purpose !== "greeting" || ["opening", "greeting", "story", "wishes", "closing"].includes(section),
  ));
  return {
    slug,
    locale: draft.locale,
    ...(draft.purpose ? { purpose: draft.purpose } : {}),
    eventType: draft.eventType,
    hosts: draft.names.map((name) => ({ name })),
    headline: draft.headline?.trim() || draft.title,
    greeting: enabled.has("greeting") ? draft.greeting : undefined,
    wishes: enabled.has("wishes") ? draft.wishes : undefined,
    closing: enabled.has("closing") ? draft.closing : undefined,
    date: {
      start: enabled.has("date")
        ? civilDateTimeToIso(
            draft.date.day,
            draft.date.time,
            draft.date.timezone,
          )
        : "",
      day: enabled.has("date") && draft.date.day ? draft.date.day : undefined,
      timezone: draft.date.timezone,
      showCountdown: enabled.has("date") && draft.date.showCountdown,
    },
    venue: enabled.has("venue") ? draft.venue : { name: "", address: "" },
    timeline: enabled.has("timeline") ? draft.timeline : [],
    dressCode: enabled.has("dressCode") ? draft.dressCode : undefined,
    media: draft.media,
    refs: [],
  };
}
