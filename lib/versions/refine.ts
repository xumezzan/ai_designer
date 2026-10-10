import type { Theme } from "@/lib/schema/theme";
import { ThemePatch, type VersionRecord } from "@/lib/schema/versions";
import { repairTheme, validateTheme, type ValidateOptions } from "@/lib/theme/validate";
import type { Content } from "@/lib/schema/content";
import type { AssetPlan } from "@/lib/schema/assetPlan";
import { hasHeroPhoto } from "@/lib/assets/layout";
import { heroGrade, type ImageInfo } from "@/lib/assets/crop";
import { populatedSections } from "@/lib/invitation/sections";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export function mergePatch(source: unknown, patch: unknown): unknown {
  if (!record(patch)) return structuredClone(patch);
  const next: Record<string, unknown> = record(source) ? structuredClone(source) : {};
  for (const [key, value] of Object.entries(patch)) next[key] = record(value) ? mergePatch(next[key], value) : structuredClone(value);
  return next;
}
const display = (value: unknown) => value === undefined ? "—" : JSON.stringify(value);
export function themeChanges(before: unknown, after: unknown, prefix = ""): VersionRecord["changes"] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (record(before) && record(after)) return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => themeChanges(before[key], after[key], prefix ? `${prefix}.${key}` : key));
  return [{ path: prefix, before: display(before), after: display(after) }];
}
export type RefinementContext = { content: Content; assetPlan: AssetPlan; mediaInfo: Record<string, ImageInfo> };
export function applyRefinement(source: Theme, rawPatch: unknown, context: RefinementContext) {
  const patch = ThemePatch.parse(rawPatch);
  const merged = mergePatch(source, patch) as Theme;
  const options: ValidateOptions = { locale: context.content.locale, hasHighQualityAsset: hasHeroPhoto(merged, context.assetPlan, context.mediaInfo) };
  if (patch.photos) {
    for (const placement of patch.photos) {
      const asset = context.assetPlan.assets.find((asset) => asset.id === placement.id && asset.role !== "unused" && asset.placement);
      if (!asset || !context.mediaInfo[placement.id]) throw new Error("Photo placements must use enabled project photo ids, never references");
      if (placement.section === "hero" && (asset.quality !== "high" || !heroGrade(context.mediaInfo[asset.id]))) throw new Error("Hero photo must have a high-quality source");
    }
  }
  const repaired = repairTheme(merged, options);
  const validated = validateTheme(repaired.value, options);
  if (!validated.ok) throw new Error(validated.errors.join("; "));
  if (populatedSections(context.content).some((section) => !validated.theme.layout.sectionOrder.includes(section))) throw new Error("Do not omit populated event sections");
  const changes = themeChanges(source, validated.theme);
  if (!changes.length) throw new Error("The patch does not change any rendered field");
  return { patch, theme: validated.theme, changes, adjustments: repaired.adjustments };
}
export type RefinedTheme = ReturnType<typeof applyRefinement> & Pick<VersionRecord, "model" | "elapsedMs" | "summary">;
