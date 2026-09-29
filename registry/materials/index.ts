/**
 * Materials (SPEC §6.2) — procedural only: feTurbulence grain, layered
 * gradients for foil sheen, SVG masks for deckle edges. No raster textures.
 * Rules: grain is always multi-layer (coarse + fine at different opacities);
 * shadows are long, soft, low-opacity and tinted toward the background; foil
 * applies to one element per page (enforced by the renderer).
 */
import type { MaterialSetId } from "../keys";

export interface MaterialSet {
  id: MaterialSetId;
  name: string;
  description: string;
  /** CSS custom properties set on the invitation root. */
  vars: Record<string, string>;
  /** Inline SVG filter defs the components reference by id. */
  svgFilter: string;
}

function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Coarse paper/fibre layer — large, soft structure. */
const grainCoarse = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'>" +
    "<filter id='gc'><feTurbulence type='fractalNoise' baseFrequency='0.32' numOctaves='2' stitchTiles='stitch'/>" +
    "<feColorMatrix type='saturate' values='0'/></filter>" +
    "<rect width='320' height='320' filter='url(#gc)' opacity='0.55'/></svg>",
);

/** Fine grain layer — sits over the coarse one at a different opacity. */
const grainFine = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'>" +
    "<filter id='gf'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/>" +
    "<feColorMatrix type='saturate' values='0'/></filter>" +
    "<rect width='320' height='320' filter='url(#gf)' opacity='0.4'/></svg>",
);

/** Ragged deckle edge as a luminance mask for the outermost surface. */
const deckleMask = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none'>" +
    "<filter id='dk'><feTurbulence type='fractalNoise' baseFrequency='0.04 0.09' numOctaves='3' seed='7'/>" +
    "<feDisplacementMap in='SourceGraphic' scale='12'/></filter>" +
    "<rect x='6' y='6' width='88' height='88' fill='white' filter='url(#dk)'/></svg>",
);

export const materialSets: Partial<Record<MaterialSetId, MaterialSet>> = {
  paper: {
    id: "paper",
    name: "Cotton paper",
    description:
      "Warm cotton stock: two-layer grain, long tinted shadows, soft vignette, foil sheen physics, deckle edge.",
    vars: {
      "--grain": grainCoarse,
      "--grain-fine": grainFine,
      "--grain-opacity": "0.45",
      "--grain-fine-opacity": "0.3",
      "--vignette":
        "radial-gradient(130% 110% at 50% 20%, transparent 52%, color-mix(in srgb, var(--ink) 9%, transparent) 100%)",
      // Long, soft, low-opacity, tinted toward the background hue — never rgba(0,0,0,.1).
      "--shadow-soft":
        "0 30px 60px -30px color-mix(in srgb, var(--ink) 14%, transparent), 0 12px 24px -18px color-mix(in srgb, var(--ink) 8%, transparent)",
      // Luminance modulation only; the metal colour comes from --foil-color.
      "--foil-sheen":
        "linear-gradient(105deg, rgba(255,255,255,0) 12%, rgba(255,255,255,0.55) 32%, rgba(255,255,255,0) 48%, rgba(255,255,255,0.35) 68%, rgba(255,255,255,0) 88%), conic-gradient(from 200deg at 40% 55%, rgba(255,255,255,0.18), rgba(0,0,0,0.12), rgba(255,255,255,0.2), rgba(0,0,0,0.1), rgba(255,255,255,0.18))",
      "--deckle-mask": deckleMask,
      "--deckle-filter": "url(#paper-edge)",
    },
    svgFilter:
      "<svg xmlns='http://www.w3.org/2000/svg' width='0' height='0'><defs>" +
      "<filter id='paper-edge'><feTurbulence type='fractalNoise' baseFrequency='0.035 0.07' numOctaves='3' seed='11' result='n'/>" +
      "<feDisplacementMap in='SourceGraphic' in2='n' scale='10' xChannelSelector='R' yChannelSelector='G'/>" +
      "</filter></defs></svg>",
  },
};

export function getMaterialSet(id: MaterialSetId): MaterialSet | undefined {
  return materialSets[id];
}
