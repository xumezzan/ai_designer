import type { Theme } from "@/lib/schema/theme";
import { isNativeComposition } from "@/lib/invitation/reference";
import { designSpecContext } from "@/lib/design/spec";

export const MAX_RECENT_DESIGNS = 12;

/** Only renderer decisions, never event facts, names, filenames or references. */
export interface DesignIdentity {
  composition: string;
  typography: string;
  material: string;
  focal: string;
  graphic: string;
  spec?: Omit<ReturnType<typeof designSpecContext>, "mask_type"> & { mask_type: string };
}

export class DesignSimilarityError extends Error {}

const filler = new Set("a an the and or of with for to in on at one original image artwork illustration invitation digital cover portrait scene accent design create elegant premium luxury luxurious text no letters names dates numbers black white cream beige gold golden silver red green blue pink sage ivory champagne muted dark light colour color background".split(" "));
function artworkLanguage(description: string) {
  const words = (description.normalize("NFKC").toLowerCase().replace(/#[\da-f]{6}/gi, "").match(/[a-z]{3,}/g) ?? []).filter((word) => !filler.has(word));
  return [...new Set(words)].sort().slice(0, 120).join(" ");
}

export function designIdentity(theme: Theme, visualPlanned = false, artworkDescription?: string): DesignIdentity {
  const composition = theme.layout.composition;
  const native = isNativeComposition(composition);
  const visual = !native && (visualPlanned || Boolean(theme.generatedVisual));
  const photos = theme.photos ?? [];
  const photoRoles = photos.map(({ section, position }) => `${section}:${["hero", "greeting", "footer"].includes(section) ? "before" : position}`).sort();
  const flow = ["letter", "botanical"].includes(composition) ? theme.layout.nameFlow : "natural";
  if (theme.studioTemplate?.composition) {
    const marker = theme.studioTemplate;
    const tokens = marker.composition!;
    const variants = tokens.sectionVariants;
    const has = (section: Theme["layout"]["sectionOrder"][number]) => theme.layout.sectionOrder.includes(section);
    const visibleVariants = [has("countdown") ? variants.countdown : null, has("timeline") ? variants.program : null, has("venue") ? variants.venue : null, has("rsvp") ? variants.rsvp : null, photos.length > 1 ? variants.gallery : null];
    const decor = tokens.decorConfig;
    return {
      // The preset name alone cannot distinguish the same visible blocks.
      composition: `studio:${JSON.stringify([tokens.heroLayout, visibleVariants])}`,
      typography: `${theme.typeSet}:${tokens.typographyAccent}`,
      material: `studio:${tokens.surfaceStyle}:${tokens.spacingScale}`,
      focal: JSON.stringify(photos.length ? [tokens.photoShape, photoRoles] : null),
      graphic: decor.density === "none" || decor.opacity === 0 ? "none" : `studio:${marker.ornamentSetId}:${decor.placement}:${decor.density}`,
    };
  }
  if (theme.designSpec) {
    const spec = theme.designSpec;
    const decisions = designSpecContext(spec);
    // Every editorial hero contains authored native art or its generated replacement.
    const mask = decisions.mask_type;
    const seal = spec.composition_rules.decorations.wax_seal;
    const foil = spec.composition_rules.decorations.foil_lines;
    const visibleSeal = seal.enabled && (seal.position !== "rsvp_badge" || theme.layout.sectionOrder.includes("rsvp"));
    const artwork = spec.graphics_generation.needed ? `generated:${spec.graphics_generation.placement === "hero_background" ? "scene" : "accent"}:${artworkLanguage(artworkDescription || spec.graphics_generation.prompt)}` : "native";
    return {
      composition,
      typography: `${spec.typography.heading_font}:${spec.typography.body_font}`,
      material: `editorial:${decisions.paper_texture}:${decisions.paper_tone}`,
      focal: JSON.stringify([decisions.hero_alignment, decisions.card_framing, mask, decisions.graphics_placement, photoRoles]),
      graphic: artwork.startsWith("generated:") ? artwork : JSON.stringify([spec.archetype, visibleSeal ? [seal.symbol, seal.position] : null, foil.enabled ? foil.style : null]),
      spec: { ...decisions, mask_type: mask },
    };
  }
  // Native scenery does not respond to arbitrary texture/ornament labels.
  const texture = composition === "organic-paper" ? "cotton-paper" :
    composition === "cinematic" ? "deep-velvet" :
    composition === "portrait-story" ? "photographic" : composition === "immersive" ? "scene-artwork" : theme.surface.texture;
  const finishing = native || composition === "immersive" ? "native" :
    theme.finishing.type === "blind-emboss" || theme.foil.enabled ? theme.finishing.type : "none";
  const ornament = native ? `native:${composition}` : theme.artwork !== "none" ? theme.artwork :
    visual ? `generated:${composition === "immersive" ? "scene" : "accent"}:${artworkDescription ? artworkLanguage(artworkDescription) : ""}` :
    theme.ornament.placement.length ? theme.ornament.pack : "none";
  return {
    composition,
    typography: theme.typeSet,
    material: `${theme.materialSet}:${texture}:${finishing}`,
    focal: JSON.stringify([flow, visual && composition !== "immersive" ? theme.layout.visualPlacement : null, photos.length ? [photos.length > 1 ? theme.layout.photoArrangement : "single", photoRoles] : null]),
    graphic: ornament,
  };
}

const axes = ["composition", "typography", "material", "focal", "graphic"] as const;
function graphicDiffers(a: string, b: string) {
  if (!a.startsWith("generated:") || !b.startsWith("generated:")) return a !== b;
  const [, kindA, languageA] = a.split(":");
  const [, kindB, languageB] = b.split(":");
  if (kindA !== kindB) return true;
  if (!languageA || !languageB) return false;
  const wordsA = new Set(languageA.split(" "));
  const wordsB = new Set(languageB.split(" "));
  const intersection = [...wordsA].filter((word) => wordsB.has(word)).length;
  return intersection / new Set([...wordsA, ...wordsB]).size < .65;
}
export function differingDesignAxes(a: DesignIdentity, b: DesignIdentity) {
  return axes.filter((axis) => axis === "graphic" ? graphicDiffers(a.graphic, b.graphic) : a[axis] !== b[axis]);
}

/** Artwork descriptions stay local; only the strategy is sent across projects. */
export function designContext(identity: DesignIdentity): DesignIdentity {
  return { ...identity, graphic: identity.graphic.startsWith("generated:") ? identity.graphic.split(":").slice(0, 2).join(":") : identity.graphic };
}

/** Palette, motion, copy and new asset ids cannot make a cloned layout unique.
 * Checking before image generation also avoids paying for a rejected design. */
export function assertDistinctDesigns(candidates: DesignIdentity[], previous: DesignIdentity[]) {
  for (const candidate of candidates) {
    if (candidate.spec && previous.some(({ spec }) => spec && candidate.spec!.archetype === spec.archetype && candidate.spec!.mask_type === spec.mask_type && candidate.spec!.paper_tone === spec.paper_tone)) {
      throw new DesignSimilarityError("The archetype + visible media mask + dominant paper-tone family combination repeats a recent design. Choose a different combination; individual archetypes may repeat. Tiny hex edits and invisible mask choices do not count.");
    }
    if (previous.some((identity) => differingDesignAxes(candidate, identity).length < 2)) {
      throw new DesignSimilarityError("The design repeats a recent invitation. Change at least TWO visible axes: composition, typography, material, focal arrangement or graphic language. Palette, motion, event copy and metadata do not count. Stay faithful to the brief and references.");
    }
  }
}
