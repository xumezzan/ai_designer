import { z } from "zod";
import { InvitationDraftSchema, PALETTE_IDS, FONT_PAIR_IDS, type InvitationRecord } from "@/lib/platform/schema";
import { MaterialArtDirectionSchema } from "@/lib/platform/art-direction";
import {
  StudioComposition, STUDIO_HERO_LAYOUTS, STUDIO_MOTION_PRESETS,
  STUDIO_ORNAMENT_SET_IDS, STUDIO_SECTION_ORDERS, STUDIO_SECTION_VARIANTS,
} from "@/lib/schema/studioTemplate";
import { moodProfiles } from "@/registry/moodProfiles";

export const AI_TEMPLATE_IDS = ["editorial", "botanical", "classic", "modern", "corporate", "nocturne", "sculpted-garden"] as const;

export const GenerationInputSchema = z.object({
  requestId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  brief: z.string().trim().min(20).max(2000),
  referenceIds: z.array(z.string().uuid()).max(3).default([]),
}).strict().refine((input) => new Set(input.referenceIds).size === input.referenceIds.length, {
  message: "Выберите разные референсы", path: ["referenceIds"],
});
export type GenerationInput = z.infer<typeof GenerationInputSchema>;

const themeIds = moodProfiles.map(({ id }) => id);
const generatedDressCode = z.object({
  title: z.string().trim().max(200),
  note: z.string().trim().max(1000).optional(),
  swatches: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(6),
}).strict();
const generatedCopy = {
  headline: z.string().trim().max(200).optional(),
  greeting: z.string().trim().max(1600).optional(),
  closing: z.string().trim().max(700).optional(),
  dressCode: generatedDressCode.optional(),
  summary: z.string().trim().min(1).max(400),
};

export const CatalogPlanSchema = z.object({
  themeId: z.string().refine((id) => themeIds.includes(id), "Unknown theme"),
  heroLayout: z.enum(STUDIO_HERO_LAYOUTS).optional(),
  sectionOrder: z.enum(STUDIO_SECTION_ORDERS).optional(),
  motionPreset: z.enum(STUDIO_MOTION_PRESETS).optional(),
  sectionVariants: StudioComposition.shape.sectionVariants.partial().optional(),
  ...generatedCopy,
}).strict();
export type CatalogPlan = z.infer<typeof CatalogPlanSchema>;

const enumSchema = (values: readonly string[]) => ({ type: "string", enum: [...values] });

// Claude's structured outputs enforce the shape and enum values. Zod also
// checks string lengths and other application limits when the response arrives.
export const CATALOG_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["themeId", "summary"],
  properties: {
    themeId: enumSchema(themeIds),
    heroLayout: enumSchema(STUDIO_HERO_LAYOUTS),
    sectionOrder: enumSchema(STUDIO_SECTION_ORDERS),
    motionPreset: enumSchema(STUDIO_MOTION_PRESETS),
    sectionVariants: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.entries(STUDIO_SECTION_VARIANTS).map(([key, choices]) => [key, enumSchema(choices)]),
      ),
    },
    headline: { type: "string" },
    greeting: { type: "string" },
    closing: { type: "string" },
    dressCode: {
      type: "object",
      additionalProperties: false,
      required: ["title", "swatches"],
      properties: {
        title: { type: "string" },
        note: { type: "string" },
        swatches: { type: "array", items: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } },
      },
    },
    summary: { type: "string" },
  },
};

export const ArtDirectionSchema = z.object({
  // Missing selection fields remain readable for the original sculpted jobs.
  templateId: z.enum(AI_TEMPLATE_IDS).optional(),
  paletteId: z.enum(PALETTE_IDS),
  fontPairId: z.enum(FONT_PAIR_IDS).optional(),
  ornamentSetId: z.enum(STUDIO_ORNAMENT_SET_IDS).optional(),
  composition: StudioComposition.optional(),
  artDirection: MaterialArtDirectionSchema.optional(),
  artworkPrompt: z.string().trim().min(40).max(1800).optional(),
  ...generatedCopy,
}).strict().superRefine((direction, context) => {
  if (direction.artDirection && !direction.artworkPrompt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["artworkPrompt"], message: "Material art direction requires original artwork" });
  if (!direction.templateId || direction.templateId === "sculpted-garden") {
    if (!direction.artworkPrompt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["artworkPrompt"], message: "Original artwork requires a prompt" });
  } else {
    for (const field of ["fontPairId", "ornamentSetId", "composition"] as const)
      if (!direction[field]) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Authored designs require a complete selection" });
  }
});
export type ArtDirection = z.infer<typeof ArtDirectionSchema>;

// This record is private repository data. The API exposes only GenerationView.
export const GenerationJobSchema = z.object({
  requestId: z.string().uuid(),
  invitationId: z.string().uuid(),
  ownerId: z.string(),
  briefHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["running", "succeeded", "failed"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  baseUpdatedAt: z.string().datetime(),
  callAttempts: z.object({ planner: z.number().int().min(0).max(1), image: z.number().int().min(0).max(1) }).strict(),
  before: InvitationDraftSchema,
  after: InvitationDraftSchema.optional(),
  summary: z.string().max(400).optional(),
  errorCode: z.string().max(80).optional(),
}).strict();
export type GenerationJob = z.infer<typeof GenerationJobSchema>;

export type GenerationView = {
  job: Pick<GenerationJob, "requestId" | "status" | "createdAt" | "updatedAt" | "summary"> & {
    error?: { code: string; message: string };
  };
  invitation?: InvitationRecord;
  previousDraft?: z.infer<typeof InvitationDraftSchema>;
};
