import path from "node:path";
import sharp from "sharp";
import type { Content } from "@/lib/schema/content";
import type { AssetPlan } from "@/lib/schema/assetPlan";
import { directAsset, type DirectedAsset, type ImageInfo } from "./crop";

export function photoFilename(slug: string, src: string) {
  const prefix = `/api/projects/${slug}/media/`;
  const filename = src.startsWith(prefix) ? src.slice(prefix.length) : "";
  if (!/^[a-f0-9-]{36}\.webp$/.test(filename)) throw new Error("Photo must belong to this project's media store");
  return filename;
}
export async function photoInfo(directory: string, content: Content): Promise<Record<string, ImageInfo>> {
  const entries = await Promise.all(content.media.map(async (media) => {
    const filename = photoFilename(content.slug, media.src);
    const metadata = await sharp(path.join(directory, "media", filename), { limitInputPixels: 40000000 }).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Photo dimensions are missing");
    return [media.id, { width: metadata.width, height: metadata.height }] as const;
  }));
  return Object.fromEntries(entries);
}
export async function readDirectedPhotos(content: Content, plan: AssetPlan, directory = path.join(process.cwd(), "projects", content.slug)) {
  const info = await photoInfo(directory, content);
  const photos: DirectedAsset[] = [];
  for (const asset of plan.assets) {
    const media = content.media.find((media) => media.id === asset.id);
    if (!media || !info[asset.id]) continue;
    const directed = directAsset(asset, media.src, info[asset.id], plan.unifiedTreatment);
    if (directed) photos.push(directed);
  }
  return photos.sort((a, b) => a.asset.placement!.index - b.asset.placement!.index);
}
