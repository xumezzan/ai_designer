import { z } from "zod";
import { SECTION_IDS } from "../../registry/keys";

const SectionId = z.enum(SECTION_IDS);

/**
 * Per-image art direction (`projects/<slug>/asset-plan.json`). Every photo gets
 * its own direction; the renderer enforces the crop rules, they are not
 * suggestions.
 */
export const AssetPlan = z.object({
  assets: z
    .array(
      z.object({
        id: z.string().min(1).max(100),

        role: z.enum(["hero", "portrait", "story", "gallery", "backdrop", "unused"]),
        subject: z.enum(["couple", "person", "group", "venue", "detail", "landscape"]),

        // Normalised 0..1. The renderer maps focal to object-position.
        focal: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),

        // Normalised box that must never be cropped away (faces, joined hands).
        safeArea: z.object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          w: z.number().positive().max(1),
          h: z.number().positive().max(1),
        }).refine((box) => box.x + box.w <= 1.0000001 && box.y + box.h <= 1.0000001, "Safe area must fit inside the image"),

        allowedRatios: z
          .array(z.enum(["3:4", "4:5", "1:1", "3:2", "16:9"]))
          .min(1),
        treatment: z.enum(["none", "warm-film", "duotone", "desaturate", "bw"]),

        quality: z.enum(["high", "usable", "low"]),
        issues: z
          .array(
            z.enum([
              "soft-focus",
              "low-res",
              "harsh-flash",
              "mixed-white-balance",
              "busy-background",
              "watermark",
              "cluttered-edges",
            ]),
          )
          .default([]),

        // Cap on how much screen the image may occupy.
        maxViewportShare: z.number().min(0.15).max(1),
        placement: z.object({ section: SectionId, index: z.number().int().nonnegative().max(40) }).nullable(),
        // Explicit editor placement takes precedence over a generated snapshot.
        placementPinned: z.boolean().optional(),
        note: z.string().max(1000).optional(),
      }),
    )
    .max(40).default([]),

  // One treatment for the whole set, so mismatched sources read as one film.
  unifiedTreatment: z.enum(["warm-film", "desaturate", "bw", "none"]),
}).superRefine((plan, context) => {
  if (new Set(plan.assets.map((asset) => asset.id)).size !== plan.assets.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["assets"], message: "Photo ids must be unique" });
  plan.assets.forEach((asset, index) => {
    if (asset.role === "unused" && asset.placement) context.addIssue({ code: z.ZodIssueCode.custom, path: ["assets", index, "placement"], message: "Unused photos cannot have a placement" });
    if ((asset.role === "hero" || asset.placement?.section === "hero") && asset.quality !== "high") context.addIssue({ code: z.ZodIssueCode.custom, path: ["assets", index, "quality"], message: "Hero requires high quality" });
  });
});

export type AssetPlan = z.infer<typeof AssetPlan>;
export type AssetPlanInput = z.input<typeof AssetPlan>;
export type Asset = AssetPlan["assets"][number];
