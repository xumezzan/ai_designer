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
        id: z.string(),

        role: z.enum(["hero", "portrait", "story", "gallery", "backdrop", "unused"]),
        subject: z.enum(["couple", "person", "group", "venue", "detail", "landscape"]),

        // Normalised 0..1. The renderer maps focal to object-position.
        focal: z.tuple([z.number(), z.number()]),

        // Normalised box that must never be cropped away (faces, joined hands).
        safeArea: z.object({
          x: z.number(),
          y: z.number(),
          w: z.number(),
          h: z.number(),
        }),

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
        placement: z.object({ section: SectionId, index: z.number() }).nullable(),
        note: z.string().optional(),
      }),
    )
    .default([]),

  // One treatment for the whole set, so mismatched sources read as one film.
  unifiedTreatment: z.enum(["warm-film", "desaturate", "bw", "none"]),
});

export type AssetPlan = z.infer<typeof AssetPlan>;
export type AssetPlanInput = z.input<typeof AssetPlan>;
export type Asset = AssetPlan["assets"][number];
