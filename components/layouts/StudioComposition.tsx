import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { StudioComposition, StudioOrnamentSetId } from "@/lib/schema/studioTemplate";
import { EditorialBotanical } from "@/components/craft/EditorialMedia";
import { DecoFan } from "@/components/craft/DecoGeometry";

type PhotoShape = StudioComposition["photoShape"];

/** A silhouette may only hide pixels outside the director's protected area.
 * The image keeps its original crop, aspect ratio and focal point. */
export function safeStudioPhotoShape(photo: DirectedAsset, requested: PhotoShape): PhotoShape {
  if (requested === "sharp" || requested === "polaroid") return requested;
  const { safeArea: safe } = photo.asset;
  const { crop } = photo;
  const corners = [
    [(safe.x - crop.x) / crop.w, (safe.y - crop.y) / crop.h],
    [(safe.x + safe.w - crop.x) / crop.w, (safe.y - crop.y) / crop.h],
    [(safe.x - crop.x) / crop.w, (safe.y + safe.h - crop.y) / crop.h],
    [(safe.x + safe.w - crop.x) / crop.w, (safe.y + safe.h - crop.y) / crop.h],
  ];
  const ratio = crop.ratio;
  const fits = corners.every(([x, y]) => {
    if (x < 0 || x > 1 || y < 0 || y > 1) return false;
    if (requested === "circle") {
      // CSS circle(closest-side) is a real circle even on portrait photographs.
      const radius = Math.min(ratio, 1) / 2;
      return ((x - .5) * ratio) ** 2 + (y - .5) ** 2 <= radius ** 2;
    }
    if (requested === "arch") return y >= .4 || ((x - .5) / .5) ** 2 + ((y - .4) / .4) ** 2 <= 1;
    if (requested === "pill") {
      const radius = Math.min(ratio, 1) / 2;
      const px = x * ratio;
      const py = y;
      const cx = Math.max(radius, Math.min(ratio - radius, px));
      const cy = Math.max(radius, Math.min(1 - radius, py));
      return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2;
    }
    const px = x * ratio;
    // border-radius: 6% uses separate horizontal and vertical radii.
    const rx = ratio * .06;
    const ry = .06;
    const cx = Math.max(rx, Math.min(ratio - rx, px));
    const cy = Math.max(ry, Math.min(1 - ry, y));
    return ((px - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  });
  return fits ? requested : "sharp";
}

/** Registered motifs are independent of the style preset and contain no copy. */
function OrnamentMotif({ id }: { id: StudioOrnamentSetId }) {
  if (id === "botanical-engraving") return <EditorialBotanical />;
  if (id === "deco-lines") return <DecoFan />;
  if (id === "graphic-ribbon") return <svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M12 88 88 12h20L32 108H12V88Z" fill="currentColor" /><circle cx="83" cy="83" r="24" stroke="currentColor" strokeWidth="2" /></svg>;
  if (id === "corporate-grid") return <svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M10 10h100v100H10zM10 43h100M10 77h100M43 10v100M77 10v100" stroke="currentColor" strokeWidth="1" /></svg>;
  if (id === "classic-monogram") return <svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M10 60h30m40 0h30M40 60c10-24 25-22 20 0-5-22 10-24 20 0-10 24-25 22-20 0 5 22-10 24-20 0Z" stroke="currentColor" /><circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth=".6" /></svg>;
  if (id === "chinese-garden") return <Image className="studio-composition-plum" src="/artwork/chinese-heritage/plum-branch.webp" width={512} height={512} unoptimized alt="" aria-hidden="true" />;
  return <svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M10 88C25 87 21 26 47 25c27-1 9 64 41 63 14-1 19-29 22-41M10 102h100M10 15h100" stroke="currentColor" strokeWidth=".8" /></svg>;
}

export function StudioCompositionDecor({ composition, ornamentSetId, divider = false }: {
  composition: StudioComposition;
  ornamentSetId: StudioOrnamentSetId;
  divider?: boolean;
}) {
  const config = composition.decorConfig;
  if (config.density === "none" || config.opacity === 0 || (divider !== (config.placement === "dividers"))) return null;
  const count = config.placement === "corners" ? config.density === "rich" ? 4 : 2 : config.placement === "background-pattern" ? config.density === "rich" ? 6 : 3 : 1;
  return <div className="studio-composition-decor" data-decor-placement={config.placement} data-decor-density={config.density} data-ornament-set={ornamentSetId} style={{ "--studio-decor-opacity": config.opacity } as CSSProperties} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <span key={index}><OrnamentMotif id={ornamentSetId} /></span>)}
  </div>;
}

export function StudioCompositionHero({ composition, ornamentSetId, eyebrow, personal, title, titleKind, date, place, media, hasPhotos, actions }: {
  composition: StudioComposition;
  ornamentSetId: StudioOrnamentSetId;
  eyebrow: ReactNode;
  personal: ReactNode;
  title: ReactNode;
  titleKind: "headline" | "names";
  date: ReactNode;
  place: ReactNode;
  media: ReactNode;
  hasPhotos: boolean;
  actions: ReactNode;
}) {
  return <div className="studio-composition-opening" data-hero-layout={composition.heroLayout} data-title-kind={titleKind} data-has-photo={hasPhotos || undefined}>
    <StudioCompositionDecor composition={composition} ornamentSetId={ornamentSetId} />
    <div className="studio-composition-eyebrow">{eyebrow}{personal}</div>
    <div className="studio-composition-hero-grid">
      <div className="studio-composition-title">{title}</div>
      {hasPhotos ? <div className="studio-composition-hero-media">{media}</div> : <div className="studio-composition-native-mark" aria-hidden="true"><span /><span /><span /></div>}
    </div>
    <div className="studio-composition-hero-facts">{date}{place}</div>
    <div className="studio-composition-hero-actions">{actions}</div>
  </div>;
}
