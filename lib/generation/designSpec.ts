import { DesignSpec } from "@/lib/schema/designSpec";
import { Theme } from "@/lib/schema/theme";
import { compileDesignSpec } from "@/lib/design/spec";
import type { Content } from "@/lib/schema/content";
import type { DirectedAsset } from "@/lib/assets/crop";
import { populatedSections, canonicalSectionOrder } from "@/lib/invitation/sections";
import { artDirection, composeSeries } from "./series";
import { z } from "zod";
import { BriefFacts } from "@/lib/studio/briefFacts";

export const DesignSpecificationOutput = z.object({
  facts: BriefFacts.nullable(), design_spec: DesignSpec,
  photos: Theme.shape.photos.unwrap(),
}).strict();

/** Grounded facts and supplied photo placement stay outside the design JSON. */
export function composeSpecification(rawSpec: unknown, rawPhotos: unknown, content: Content, photos: DirectedAsset[]) {
  const spec = DesignSpec.parse(rawSpec);
  const placements = Theme.shape.photos.unwrap().parse(rawPhotos);
  const order = canonicalSectionOrder([...populatedSections(content), ...placements.map((photo) => photo.section)]);
  const base = Theme.parse({
    meta: { name: spec.design_title, mood: [spec.archetype], rationale: spec.similarity_defense.slice(0, 400) },
    palette: { bg: spec.canvas.background_color, surface: spec.canvas.background_color, ink: spec.canvas.text_color_primary, muted: spec.canvas.text_color_muted, accent: spec.canvas.accent_color, accentAlt: spec.canvas.accent_color },
    typeSet: "editorial", materialSet: "paper", artwork: "none", foil: { enabled: false, color: spec.canvas.accent_color },
    ornament: { pack: "none", density: "light", placement: [], color: "accent" },
    layout: { preset: "scroll-narrative", composition: spec.component_manifest.hero_layout_component, hero: "typographic", sectionOrder: order },
    motion: { preset: "drift", ambient: "none" }, photos: placements,
  });
  const theme = compileDesignSpec(spec, base);
  const intent = {
    visualKind: spec.graphics_generation.placement === "hero_background" ? "scene" as const : "accent" as const,
    summary: spec.design_title, cues: [spec.archetype, spec.canvas.paper_texture, spec.composition_rules.card_framing],
    avoid: ["CGI", "3D render", "digital art look", "glossy stock photo"], referenceNotes: "",
    artworkPrompt: spec.graphics_generation.prompt || "Native authored editorial stationery with live typography; no generated image requested.",
  };
  const style = { name: theme.meta.name, mood: theme.meta.mood, rationale: theme.meta.rationale,
    ...artDirection(theme), artwork: theme.artwork, intent };
  return composeSeries({ mode: "cohesive", style, variants: [{ name: theme.meta.name, rationale: theme.meta.rationale,
    designSpec: theme.designSpec, layout: theme.layout, ornamentPlacement: [], photos: placements }] }, content.locale, photos, spec.graphics_generation.needed);
}
