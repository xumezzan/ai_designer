import { z } from "zod";
import { Hex } from "./common";
import { rsvpTarget } from "../invitation/links";

/**
 * Deterministic event facts (`projects/<slug>/content.json`). The AI never
 * generates these; it may help draft `greeting` on request.
 */
export const Content = z.object({
  slug: z.string(),
  locale: z.enum(["ru", "uz-latn", "en"]),
  eventType: z.enum([
    "wedding",
    "anniversary",
    "birthday",
    "corporate",
    "engagement",
    "other",
  ]),

  hosts: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
      }),
    )
    .min(1),

  headline: z.string().optional(),
  greeting: z.string().optional(),

  date: z.object({
    start: z.string().datetime({ offset: true }),
    timezone: z.string().default("Asia/Tashkent").refine((zone) => {
      try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; }
      catch { return false; }
    }, "Use a valid IANA timezone"),
    showCountdown: z.boolean().default(true),
  }),

  venue: z.object({
    name: z.string(),
    address: z.string(),
    coords: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]).optional(),
    mapUrl: z.string().url().optional(),
    note: z.string().optional(),
  }),

  timeline: z
    .array(
      z.object({
        time: z.string(),
        title: z.string(),
        note: z.string().optional(),
      }),
    )
    .default([]),

  dressCode: z
    .object({
      title: z.string(),
      note: z.string().optional(),
      swatches: z.array(Hex).default([]),
    })
    .optional(),

  rsvp: z
    .object({
      enabled: z.boolean().default(true),
      mode: z.enum(["telegram", "form", "phone"]).default("telegram"),
      target: z.string(),
      deadline: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Use a valid RSVP date").optional(),
      askGuestCount: z.boolean().default(true),
    })
    .optional(),

  media: z
    .array(z.object({ id: z.string(), src: z.string() }))
    .default([]),

  brief: z.string().optional(),
  refs: z.array(z.string()).default([]),
}).superRefine((content, context) => {
  if (content.rsvp?.enabled) {
    try { rsvpTarget(content.rsvp.mode, content.rsvp.target); }
    catch { context.addIssue({ code: z.ZodIssueCode.custom, path: ["rsvp", "target"], message: "Use a destination valid for the RSVP mode" }); }
  }
});

export type Content = z.infer<typeof Content>;
export type ContentInput = z.input<typeof Content>;
