import type { ArtworkId } from "../keys";

/** Generated art is versioned separately from live invitation typography. */
export const artworks = {
  "suzani-atelier": {
    hero: { src: "/artwork/suzani-atelier/hero-v1.webp", width: 1024, height: 1536 },
    texture: "/artwork/suzani-atelier/velvet-v1.webp",
    flourish: { src: "/artwork/suzani-atelier/flourish-v2.webp", width: 2172, height: 724 },
    vars: { "--art-texture": 'url("/artwork/suzani-atelier/velvet-v1.webp")', "--art-texture-size": "32rem" },
  },
} as const;

export function getArtwork(id: ArtworkId) { return id === "none" ? undefined : artworks[id]; }
