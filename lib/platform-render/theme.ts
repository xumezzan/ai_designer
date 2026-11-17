import type { InvitationDraft } from "@/lib/platform/schema";
import type { StudioSelection } from "@/lib/schema/studioTemplate";
import {
  studioPalettes,
  studioTemplates,
  studioTemplateTheme,
} from "@/registry/studioTemplates";
import type { Theme } from "@/lib/schema/theme";

type PlatformAppearance = Pick<InvitationDraft,
  "templateId" | "paletteId" | "fontPairId" | "composition" | "ornamentSetId" | "purpose"
>;

/** Older saved IDs keep their exact type and colour semantics. New drafts use
 * the canonical registry IDs without lossy remapping. */
export function resolvePlatformDesignSelection(draft: PlatformAppearance): StudioSelection {
  // These two art-directed wedding experiences contain ceremonial copy and
  // invitation controls. Greeting mode uses the neutral editorial composition.
  const templateId = draft.purpose === "greeting" &&
    (draft.templateId === "heritage" || draft.templateId === "sculpted-garden")
      ? "editorial" : draft.templateId;
  const descriptor = studioTemplates.find(({ id }) => id === templateId);
  if (!descriptor) throw new Error("This collection uses its dedicated platform renderer");
  const paletteId = draft.paletteId === "midnight" ? "ink" : draft.paletteId;
  const fontPairId = draft.fontPairId === "classic" || draft.fontPairId === "romantic"
    ? "ceremony" : draft.fontPairId === "modern" ? "gallery" : draft.fontPairId;
  return {
    templateId: descriptor.id,
    paletteId,
    fontPairId,
    ornamentSetId: draft.ornamentSetId ?? descriptor.ornamentSetId,
    ...(draft.composition ? { composition: draft.composition } : {}),
  };
}

/** Layouts stay authored. Customer choices can only select from the existing
 * audited colour and type registries, never supply arbitrary CSS tokens. */
export function platformTheme(
  draft: PlatformAppearance,
): Theme & { studioTemplate: NonNullable<Theme["studioTemplate"]> } {
  const selection = resolvePlatformDesignSelection(draft);
  if (selection.composition) {
    // Parametric choices use the same registry compatibility checks as the
    // original studio generator, preserving the supplied composition exactly.
    const theme = studioTemplateTheme(selection);
    return { ...theme, studioTemplate: theme.studioTemplate! };
  }
  const descriptor = studioTemplates.find(({ id }) => id === selection.templateId)!;
  const theme = studioTemplateTheme({
    templateId: descriptor.id,
    paletteId: descriptor.defaultPaletteId,
    fontPairId: descriptor.defaultFontPairId,
    ornamentSetId: descriptor.ornamentSetId,
  });
  const { bg, surface, ink, muted, accent, accentAlt } = studioPalettes[selection.paletteId];
  const palette = { bg, surface, ink, muted, accent, accentAlt };
  return {
    ...theme,
    palette,
    typeSet: selection.fontPairId,
    studioTemplate: { ...theme.studioTemplate!, paletteId: selection.paletteId, fontPairId: selection.fontPairId, ornamentSetId: selection.ornamentSetId },
    foil: { ...theme.foil, color: palette.accent },
  };
}
