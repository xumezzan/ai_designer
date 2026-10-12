import { DesignSeries, type Generation } from "@/lib/schema/generation";
import type { Theme } from "@/lib/schema/theme";
import type { DirectedAsset } from "@/lib/assets/crop";
import { heroGrade } from "@/lib/assets/crop";
import { repairTheme, validateTheme, type Locale } from "@/lib/theme/validate";
import type { GeneratedVisual } from "@/lib/schema/visual";

export function composeSeries(raw: unknown, locale: Locale, photos: DirectedAsset[], visualPlanned = false) {
  const series = DesignSeries.parse(raw);
  const mode = series.mode ?? "cohesive";
  if (mode === "cohesive" && series.variants.some((variant) => variant.direction)) throw new Error("Independent directions require exploration mode");
  if (mode === "exploration" && series.variants.some((variant) => !variant.direction)) throw new Error("Every exploration variant needs a complete palette and typeSet direction");
  if (new Set(series.variants.map((variant) => JSON.stringify({
    composition: variant.layout.composition,
    direction: mode === "exploration" ? variant.direction : undefined,
    // Stacked is already built into these presets and adds no visible variety.
    nameFlow: ["letter", "botanical"].includes(variant.layout.composition) ? variant.layout.nameFlow : "natural",
    visual: series.style.generatedVisual || visualPlanned ? variant.layout.visualPlacement : undefined,
    photos: photos.length ? [variant.layout.photoArrangement, variant.photos] : undefined,
    ornament: series.style.ornament.pack !== "none" ? variant.ornamentPlacement : undefined,
    order: variant.layout.sectionOrder,
  }))).size !== series.variants.length) throw new Error("Use distinct visible compositions within the SAME style; invisible artwork/photo choices do not count");
  const style = series.style;
  const sample = { ...style, meta: { name: style.name, mood: style.mood, rationale: style.rationale }, ornament: { ...style.ornament, placement: [] }, layout: series.variants[0].layout };
  const repaired = repairTheme(sample);
  // Repair the shared palette once, so contrast fixes cannot split a series into different styles.
  const common = repaired.value as Theme;
  const themes = series.variants.map((variant) => {
    const placements = variant.photos;
    if (placements.length !== photos.length || new Set(placements.map((photo) => photo.id)).size !== photos.length || placements.some((entry) => !photos.some((photo) => photo.asset.id === entry.id))) throw new Error("Place every supplied enabled photo id exactly once; do not place references or invent photos");
    for (const placement of placements) {
      const photo = photos.find((photo) => photo.asset.id === placement.id)!;
      if (placement.section === "hero" && (photo.asset.quality !== "high" || !heroGrade(photo.info))) throw new Error("Only high-quality source photos can be placed in hero");
      if (!variant.layout.sectionOrder.includes(placement.section)) throw new Error("Every photo section must appear in sectionOrder");
    }
    if (placements.filter((photo) => photo.section === "hero").length > 1) throw new Error("Only one photo may be placed in hero");
    const identity = mode === "exploration" ? variant.direction : undefined;
    const theme = {
      palette: identity?.palette ?? common.palette, typeSet: identity?.typeSet ?? style.typeSet, materialSet: identity?.materialSet ?? style.materialSet, artwork: style.artwork, generatedVisual: style.generatedVisual, foil: identity?.foil ?? style.foil, motion: identity?.motion ?? style.motion,
      atmosphere: identity?.atmosphere ?? style.atmosphere, surface: identity?.surface ?? style.surface, finishing: identity?.finishing ?? style.finishing, typographyScale: identity?.typographyScale ?? style.typographyScale,
      meta: { name: variant.name, mood: style.mood, rationale: variant.rationale },
      ornament: { ...(identity?.ornament ?? style.ornament), placement: variant.ornamentPlacement }, layout: variant.layout, photos: placements,
    };
    const options = { locale, hasHighQualityAsset: placements.some((photo) => photo.section === "hero") };
    const variationRepair = mode === "exploration" ? repairTheme(theme, options) : undefined;
    if (variationRepair) repaired.adjustments.push(...variationRepair.adjustments.map((adjustment) => `${variant.name}: ${adjustment}`));
    const candidate = variationRepair?.value ?? theme;
    const validated = validateTheme(candidate, options);
    if (!validated.ok) throw new Error(validated.errors.join("; "));
    return validated.theme;
  });
  if (mode === "exploration" && themes.length > 1) {
    const identity = (theme: Theme) => JSON.stringify([theme.palette, theme.typeSet, theme.materialSet, theme.surface, theme.finishing.type, theme.ornament.pack]);
    if (new Set(themes.map(identity)).size !== themes.length) throw new Error("Exploration directions must differ in visible identity, including materials and typography");
    const scene = (theme: Theme) => JSON.stringify([theme.layout.preset, theme.layout.composition, theme.surface.texture, theme.finishing.type, theme.ornament.pack]);
    if (new Set(themes.map(scene)).size !== themes.length) throw new Error("Exploration needs different compositions or material scenes; recoloring the same design is not enough");
  }
  return { ...(series.mode ? { mode } : {}), themes, style: { ...style, palette: common.palette }, adjustments: repaired.adjustments };
}
/** Canonical bounded overrides; server-issued artwork and photo safety never vary here. */
export function artDirection(theme: Theme) {
  return { palette: theme.palette, typeSet: theme.typeSet, materialSet: theme.materialSet, foil: theme.foil, motion: theme.motion, atmosphere: theme.atmosphere, surface: theme.surface, finishing: theme.finishing, typographyScale: theme.typographyScale, ornament: { pack: theme.ornament.pack, density: theme.ornament.density, color: theme.ornament.color } };
}
export type GeneratedSeries = ReturnType<typeof composeSeries> & Pick<Generation, "model" | "elapsedMs" | "references"> & { visual?: GeneratedVisual };

export function sharedStyleSignature(theme: Theme) {
  return JSON.stringify({ palette: theme.palette, typeSet: theme.typeSet, materialSet: theme.materialSet, artwork: theme.artwork, generatedVisual: theme.generatedVisual, foil: theme.foil, motion: theme.motion, atmosphere: theme.atmosphere, surface: theme.surface, finishing: theme.finishing, typographyScale: theme.typographyScale, ornament: { pack: theme.ornament.pack, density: theme.ornament.density, color: theme.ornament.color } });
}
