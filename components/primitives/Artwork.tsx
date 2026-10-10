import Image from "next/image";
import type { ArtworkId } from "@/registry/keys";
import { getArtwork } from "@/registry/artwork";

export function Artwork({ id, placement }: { id: ArtworkId; placement: "hero" | "flourish" }) {
  const artwork = getArtwork(id);
  if (!artwork) return null;
  const asset = artwork[placement];
  return <div className={`generated-art generated-art-${placement}`} aria-hidden="true">
    <Image src={asset.src} width={asset.width} height={asset.height} alt="" quality={90} priority={placement === "hero"}
      sizes={placement === "hero" ? "(max-width: 600px) 100vw, 576px" : "(max-width: 600px) 70vw, 320px"} />
  </div>;
}
