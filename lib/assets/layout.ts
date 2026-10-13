import type { Theme } from "@/lib/schema/theme";
import type { AssetPlan } from "@/lib/schema/assetPlan";
import { heroGrade, type DirectedAsset, type ImageInfo } from "./crop";

export function hasHeroPhoto(theme: Pick<Theme, "photos">, plan: AssetPlan, info: Record<string, ImageInfo>) {
  return plan.assets.some((asset) => asset.role !== "unused" && asset.placement && asset.quality === "high" && info[asset.id] && heroGrade(info[asset.id]) &&
    (theme.photos && !asset.placementPinned ? theme.photos.some((photo) => photo.id === asset.id && photo.section === "hero") : asset.placement.section === "hero"));
}
// A generated snapshot may outlive a photo removal or a change to its quality.
// Keep that project editable, without rewriting the immutable theme or inventing a photo.
export function availablePhotoLayout(theme: Theme, hasHero: boolean): Theme {
  return theme.photos && theme.layout.hero === "full-photo" && !hasHero
    ? { ...theme, layout: { ...theme.layout, hero: "typographic" } } : theme;
}
export function compositionPhotos(photos: DirectedAsset[], theme: Theme) {
  if (!theme.photos) return photos.map((photo) => ({ photo, position: ["hero", "greeting", "footer"].includes(photo.asset.placement?.section ?? "") ? "before" as const : "after" as const }));
  const placed = theme.photos.flatMap((placement) => {
    const photo = photos.find((photo) => photo.asset.id === placement.id);
    if (!photo) return [];
    const chosen = photo.asset.placementPinned ? photo.asset.placement : { section: placement.section, index: placement.index };
    if (!chosen || (chosen.section === "hero" && (photo.asset.quality !== "high" || !heroGrade(photo.info)))) return [];
    return [{ position: ["hero", "greeting", "footer"].includes(chosen.section) ? "before" as const : placement.position, photo: { ...photo, asset: { ...photo.asset, placement: chosen } } }];
  });
  // A host can add event photos after designing, without another generation.
  const known = new Set(theme.photos.map((placement) => placement.id));
  const added = photos.filter((photo) => !known.has(photo.asset.id)).map((photo) => ({ photo, position: ["hero", "greeting", "footer"].includes(photo.asset.placement?.section ?? "") ? "before" as const : "after" as const }));
  return [...placed, ...added].sort((a, b) => a.photo.asset.placement!.index - b.photo.asset.placement!.index);
}
