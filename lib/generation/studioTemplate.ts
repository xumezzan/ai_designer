import { z } from "zod";
import { StudioComposition, StudioSelection, StudioTemplate } from "@/lib/schema/studioTemplate";
import { Theme } from "@/lib/schema/theme";
import type { Content } from "@/lib/schema/content";
import type { DirectedAsset } from "@/lib/assets/crop";
import { BriefFacts } from "@/lib/studio/briefFacts";
import { canonicalSectionOrder, populatedSections } from "@/lib/invitation/sections";
import { studioTemplates, studioTemplateTheme } from "@/registry/studioTemplates";
import { resolveMoodProfile } from "@/registry/moodProfiles";
import { artDirection, composeSeries } from "./series";

export const StudioTemplateOutput = z.object({
  facts: BriefFacts.nullable(),
  // New model output must resolve a composition. Legacy stored/manual selections
  // still use StudioSelection directly and retain the original authored recipe.
  selection: StudioSelection.extend({ composition: StudioComposition }),
  rationale: z.string().trim().min(1).max(400),
  photos: Theme.shape.photos.unwrap(),
}).strict();

/** Resolve bounded model decisions through the registered, editable renderer. */
export function composeStudioTemplate(rawSelection: unknown, rawPhotos: unknown, rationale: string, content: Content, photos: DirectedAsset[]) {
  const parsed = StudioSelection.parse(rawSelection);
  const selection = parsed.composition ? resolveMoodProfile(parsed)?.selection ?? parsed : parsed;
  const choices = content.studioDesign;
  if (choices?.templateId && choices.templateId !== "auto" && choices.templateId !== selection.templateId) {
    throw new Error("Preserve the owner's explicitly selected templateId");
  }
  if (choices?.paletteId && choices.paletteId !== "auto" && choices.paletteId !== selection.paletteId) {
    throw new Error("Preserve the owner's explicitly selected paletteId");
  }
  const template = studioTemplates.find((candidate) => candidate.id === selection.templateId)!;
  const explicitTemplate = choices?.templateId && choices.templateId !== "auto";
  if (!explicitTemplate && !selection.composition && !template.eventTypes.includes(content.eventType)) {
    throw new Error("Choose a template whose eventTypes supports the supplied eventType");
  }
  // Compatibility is validated by the registry before composition or storage.
  const base = studioTemplateTheme(selection);
  const placements = Theme.shape.photos.unwrap().parse(rawPhotos);
  const sectionOrder = canonicalSectionOrder([...populatedSections(content), ...placements.map((photo) => photo.section)]);
  const { templateId, ...tokens } = selection;
  const marker = StudioTemplate.parse({ id: templateId, revision: 1, ...tokens });
  const result = composeSeries({
    mode: "cohesive",
    style: { name: base.meta.name, mood: base.meta.mood, rationale, ...artDirection(base), artwork: base.artwork, studioTemplate: marker },
    variants: [{ name: base.meta.name, rationale, studioTemplate: marker, layout: { ...base.layout, sectionOrder }, ornamentPlacement: base.ornament.placement, photos: placements }],
  }, content.locale, photos);
  return {
    ...result,
    themes: result.themes.map((theme) => Theme.parse({ ...theme, studioTemplate: marker })),
    style: { ...result.style, studioTemplate: marker },
  };
}
