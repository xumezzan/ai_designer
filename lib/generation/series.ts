import { DesignSeries, type Generation } from "@/lib/schema/generation";
import type { Theme } from "@/lib/schema/theme";
import type { DirectedAsset } from "@/lib/assets/crop";
import { heroGrade } from "@/lib/assets/crop";
import { repairTheme, validateTheme, type Locale } from "@/lib/theme/validate";
import type { GeneratedVisual } from "@/lib/schema/visual";

export function composeSeries(raw: unknown, locale: Locale, photos: DirectedAsset[], visualPlanned = false) {
  const series = DesignSeries.parse(raw);
  if (new Set(series.variants.map((variant) => JSON.stringify({
    composition: variant.layout.composition,
    // Stacked is already built into these presets and adds no visible variety.
    nameFlow: ["letter", "botanical"].includes(variant.layout.composition) ? variant.layout.nameFlow : "natural",
    visual: series.style.generatedVisual || visualPlanned ? variant.layout.visualPlacement : undefined,
    photos: photos.length ? [variant.layout.photoArrangement, variant.photos] : undefined,
    ornament: series.style.ornament.pack !== "none" ? variant.ornamentPlacement : undefined,
    order: variant.layout.sectionOrder,
  }))).size !== 5) throw new Error("Use five distinct visible compositions within the SAME style; invisible artwork/photo choices do not count");
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
    const theme = {
      palette: common.palette, typeSet: style.typeSet, materialSet: style.materialSet, artwork: style.artwork, generatedVisual: style.generatedVisual, foil: style.foil, motion: style.motion,
      meta: { name: variant.name, mood: style.mood, rationale: variant.rationale },
      ornament: { ...style.ornament, placement: variant.ornamentPlacement }, layout: variant.layout, photos: placements,
    };
    const validated = validateTheme(theme, { locale, hasHighQualityAsset: placements.some((photo) => photo.section === "hero") });
    if (!validated.ok) throw new Error(validated.errors.join("; "));
    return validated.theme;
  });
  return { themes, style: { ...style, palette: common.palette }, adjustments: repaired.adjustments };
}
export type GeneratedSeries = ReturnType<typeof composeSeries> & Pick<Generation, "model" | "elapsedMs" | "references"> & { visual?: GeneratedVisual };

export function sharedStyleSignature(theme: Theme) {
  return JSON.stringify({ palette: theme.palette, typeSet: theme.typeSet, materialSet: theme.materialSet, artwork: theme.artwork, generatedVisual: theme.generatedVisual, foil: theme.foil, motion: theme.motion, ornament: { pack: theme.ornament.pack, density: theme.ornament.density, color: theme.ornament.color } });
}
