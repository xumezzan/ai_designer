import type { CompositionId } from "@/registry/keys";
import type { DirectedAsset } from "@/lib/assets/crop";

/** Authored web experiences need live code and supplied media, not a cover bitmap. */
export const NATIVE_COMPOSITIONS: readonly CompositionId[] = ["cinematic", "portrait-story", "keepsake", "vow", "editorial-story"];
export function isNativeComposition(id: CompositionId) { return NATIVE_COMPOSITIONS.includes(id); }

/** Text can occupy an explicitly empty part of a protected crop. Otherwise it
 * sits below the photograph. Never assume the couple's faces are centred. */
export function portraitTextZone(photo: DirectedAsset): "top" | "bottom" | "outside" {
  if (photo.crop.mode === "whole" || photo.viewportShare < .85) return "outside";
  const { safeArea } = photo.asset;
  const top = (safeArea.y - photo.crop.y) / photo.crop.h;
  const bottom = 1 - (safeArea.y + safeArea.h - photo.crop.y) / photo.crop.h;
  if (bottom >= .65) return "bottom";
  if (top >= .65) return "top";
  return "outside";
}
