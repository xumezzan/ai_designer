import Image from "next/image";
import type { CSSProperties } from "react";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { Content } from "@/lib/schema/content";

const subjects = {
  ru: { couple: "Совместный портрет", person: "Портрет", group: "Групповой снимок", venue: "Место проведения события", detail: "Детали события", landscape: "Пейзаж места встречи" },
  "uz-latn": { couple: "Juftlik portreti", person: "Portret", group: "Guruh surati", venue: "Tadbir joyi", detail: "Tadbir tafsilotlari", landscape: "Uchrashuv joyi manzarasi" },
  en: { couple: "Portrait of the couple", person: "Portrait", group: "Group photograph", venue: "Event venue", detail: "Event details", landscape: "Landscape at the event location" },
};
export function DirectedImage({ photo, locale }: { photo: DirectedAsset; locale: Content["locale"] }) {
  const share = photo.viewportShare * 100;
  return <figure className="directed-photo" data-photo-id={photo.asset.id} data-quality={photo.asset.quality} data-crop={photo.crop.mode} data-ratio={photo.crop.label}
    data-treatment={photo.treatment} style={{ "--photo-ratio": String(photo.crop.ratio), "--photo-limit": `min(100%, ${photo.pixelWidth}px, ${share}vw, ${share * photo.crop.ratio}svh)` } as CSSProperties}>
    <Image src={photo.src} width={photo.info.width} height={photo.info.height} unoptimized alt={subjects[locale][photo.asset.subject]} loading={photo.asset.placement?.section === "hero" ? "eager" : "lazy"}
      style={{ objectFit: photo.crop.mode === "whole" ? "contain" : "cover", objectPosition: `${photo.asset.focal[0] * 100}% ${photo.asset.focal[1] * 100}%` }} />
  </figure>;
}
