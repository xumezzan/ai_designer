import { z } from "zod";
import { VersionId } from "./versions";
import { safeId } from "./ids";
export const QA_ENGINE = "m6-2";
export const CHECK_IDS = ["overflow", "collision", "clipping", "contrast", "measure", "widow", "fonts", "tap", "resolution", "reduced-motion", "lcp", "cls", "face-crop", "busy-photo", "alignment"] as const;
export const Finding = z.object({ severity: z.enum(["error", "warning"]), selector: z.string().max(500), viewport: z.number().int().positive(), message: z.string().max(1000), observed: z.number().finite().optional(), expected: z.number().finite().optional() }).strict();
export const QaReport = z.object({
  runId: z.string().uuid(), slug: z.string().refine(safeId), conceptId: z.string().refine(safeId), version: VersionId,
  createdAt: z.string().datetime(), engine: z.string().regex(/^m6-\d+$/),
  contentRevision: z.string().length(64), planRevision: z.string().length(64), themeRevision: z.string().length(64), rendererRevision: z.string().length(64),
  viewports: z.tuple([z.literal(390), z.literal(1024), z.literal(1440)]),
  checks: z.array(z.object({ id: z.enum(CHECK_IDS), status: z.enum(["pass", "fail", "warning", "skipped", "error"]), samples: z.number().int().nonnegative(), findings: z.array(Finding).max(200) }).strict()).length(CHECK_IDS.length),
  visionModel: z.string().max(100).nullable(),
  measurements: z.object({ lcpMs: z.number().nonnegative().nullable(), cls: z.number().nonnegative().nullable(), profile: z.literal("Fast3G-150ms-1.6Mbps-4xCPU") }).strict().optional(),
  evidence: z.array(z.object({ file: z.string().regex(/^[a-z0-9-]+\.png$/), label: z.string().max(100) }).strict()).max(8),
}).strict().superRefine((report, ctx) => {
  if (new Set(report.checks.map((check) => check.id)).size !== CHECK_IDS.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Every QA check must be represented once" });
  for (const check of report.checks) {
    if (check.status === "pass" && check.findings.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passed checks cannot contain findings" });
    if (check.status === "fail" && !check.findings.some((finding) => finding.severity === "error")) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Failed checks require a hard finding" });
  }
});
export type QaReport = z.infer<typeof QaReport>;
export type QaCheck = QaReport["checks"][number];
export type QaState = { report: QaReport; stale: boolean };
export function qaStatus(report: QaReport) {
  if (report.checks.some((check) => check.status === "error" || check.status === "skipped")) return "incomplete";
  if (report.checks.some((check) => check.status === "fail")) return "failed";
  if (report.checks.some((check) => check.status === "warning")) return "warning";
  return "passed";
}
