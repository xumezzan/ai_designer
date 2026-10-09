import type { Asset, AssetPlan } from "@/lib/schema/assetPlan";

export type ImageInfo = { width: number; height: number };
export type Crop = { x: number; y: number; w: number; h: number; ratio: number; mode: "crop" | "whole"; label: string };
export type DirectedAsset = { asset: Asset; src: string; info: ImageInfo; crop: Crop; treatment: Asset["treatment"]; viewportShare: number; pixelWidth: number };
export const ratios = ["3:4", "4:5", "1:1", "3:2", "16:9"] as const;
export const ratioValue = (ratio: string) => { const [w, h] = ratio.split(":").map(Number); return w / h; };
export function cropForRatio(info: ImageInfo, ratio: string, focal: Asset["focal"]): Crop {
  const sourceRatio = info.width / info.height;
  const target = ratioValue(ratio);
  const w = Math.min(1, target / sourceRatio);
  const h = Math.min(1, sourceRatio / target);
  return { x: (1 - w) * focal[0], y: (1 - h) * focal[1], w, h, ratio: target, mode: "crop", label: ratio };
}
export function preservesSafeArea(crop: Crop, safe: Asset["safeArea"]) {
  const epsilon = 1e-7;
  return crop.x <= safe.x + epsilon && crop.y <= safe.y + epsilon && crop.x + crop.w + epsilon >= safe.x + safe.w && crop.y + crop.h + epsilon >= safe.y + safe.h;
}
export function selectCrop(info: ImageInfo, asset: Asset): Crop {
  for (const ratio of asset.allowedRatios) {
    const crop = cropForRatio(info, ratio, asset.focal);
    if (preservesSafeArea(crop, asset.safeArea)) return crop;
  }
  return { x: 0, y: 0, w: 1, h: 1, ratio: info.width / info.height, mode: "whole", label: "original" };
}
export const heroGrade = (info: ImageInfo) => Math.min(info.width, info.height) >= 600 && Math.max(info.width, info.height) >= 1200;
export function directAsset(asset: Asset, src: string, info: ImageInfo, unified: AssetPlan["unifiedTreatment"]): DirectedAsset | null {
  if (asset.role === "unused" || !asset.placement) return null;
  if ((asset.role === "hero" || asset.placement.section === "hero") && (asset.quality !== "high" || !heroGrade(info))) return null;
  const crop = selectCrop(info, asset);
  const actuallyLow = asset.quality === "low" || Math.min(info.width, info.height) < 480;
  return { asset, src, info, crop, treatment: unified === "none" ? asset.treatment : unified, viewportShare: Math.min(asset.maxViewportShare, actuallyLow ? .35 : 1), pixelWidth: Math.floor(info.width * crop.w) };
}
export function unusedAsset(id: string, info: ImageInfo): Asset {
  return { id, role: "unused", subject: "detail", focal: [.5, .5], safeArea: { x: 0, y: 0, w: 1, h: 1 }, allowedRatios: [...ratios], treatment: "none", quality: Math.min(info.width, info.height) < 480 ? "low" : "usable", issues: Math.min(info.width, info.height) < 480 ? ["low-res"] : [], maxViewportShare: Math.min(info.width, info.height) < 480 ? .35 : .6, placement: null };
}
