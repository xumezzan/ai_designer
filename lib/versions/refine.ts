import type { Theme } from "@/lib/schema/theme";
import { ThemePatch, type VersionRecord } from "@/lib/schema/versions";
import { repairTheme, validateTheme, type ValidateOptions } from "@/lib/theme/validate";
import type { Content } from "@/lib/schema/content";
import type { AssetPlan } from "@/lib/schema/assetPlan";
import { hasHeroPhoto } from "@/lib/assets/layout";
import { heroGrade, type ImageInfo } from "@/lib/assets/crop";
import { populatedSections } from "@/lib/invitation/sections";
import { compileDesignSpec } from "@/lib/design/spec";
import { DESIGN_ARCHETYPE_COMPONENTS, type DesignSpec } from "@/lib/schema/designSpec";
import { studioTemplateTheme } from "@/registry/studioTemplates";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export function mergePatch(source: unknown, patch: unknown): unknown {
  if (!record(patch)) return structuredClone(patch);
  const next: Record<string, unknown> = record(source) ? structuredClone(source) : {};
  for (const [key, value] of Object.entries(patch)) next[key] = record(value) ? mergePatch(next[key], value) : structuredClone(value);
  return next;
}
const display = (value: unknown) => value === undefined ? "—" : JSON.stringify(value);
export function themeChanges(before: unknown, after: unknown, prefix = ""): VersionRecord["changes"] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (record(before) && record(after)) return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => themeChanges(before[key], after[key], prefix ? `${prefix}.${key}` : key));
  return [{ path: prefix, before: display(before), after: display(after) }];
}
export type RefinementContext = { content: Content; assetPlan: AssetPlan; mediaInfo: Record<string, ImageInfo> };

function unchanged(category: string, value: unknown, source: unknown) {
  if (JSON.stringify(value) !== JSON.stringify(source)) throw new Error(`Editorial specifications do not support ${category}; use the corresponding designSpec field or create a new design`);
}
function fieldAt(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => record(current) ? current[key] : undefined, value);
}

/** Old palette/style commands are translated to the exact renderer's source of truth. */
function refineDesignSpec(source: Theme, patch: ThemePatch, merged: Theme) {
  if (!source.designSpec) throw new Error("A partial designSpec can only refine an existing editorial specification");
  const translated: Record<string, unknown> = {};
  const adjustments: string[] = [];
  const set = (path: string[], value: unknown) => {
    const explicit = fieldAt(patch.designSpec, path);
    if (explicit !== undefined && JSON.stringify(explicit) !== JSON.stringify(value)) throw new Error(`Conflicting legacy and designSpec changes for ${path.join(".")}`);
    const prior = fieldAt(translated, path);
    if (prior !== undefined && JSON.stringify(prior) !== JSON.stringify(value)) throw new Error(`Conflicting legacy changes for ${path.join(".")}`);
    let target = translated;
    path.slice(0, -1).forEach((key) => { if (!record(target[key])) target[key] = {}; target = target[key] as Record<string, unknown>; });
    target[path.at(-1)!] = value;
  };
  const canvas = (key: string, value: string) => set(["canvas", key], value.toUpperCase());
  if (patch.palette) {
    if (patch.palette.bg) canvas("background_color", patch.palette.bg);
    else if (patch.palette.surface) canvas("background_color", patch.palette.surface);
    if (patch.palette.bg && patch.palette.surface && patch.palette.bg.toUpperCase() !== patch.palette.surface.toUpperCase()) adjustments.push("Editorial stationery uses one paper tone; palette.bg applies to the canvas and paper surface.");
    if (patch.palette.ink) canvas("text_color_primary", patch.palette.ink);
    if (patch.palette.muted) canvas("text_color_muted", patch.palette.muted);
    if (patch.palette.accent) canvas("accent_color", patch.palette.accent);
    if (patch.palette.accentAlt) {
      if (!source.designSpec.composition_rules.decorations.wax_seal.enabled) unchanged("palette.accentAlt without a visible wax seal", patch.palette.accentAlt, source.palette.accentAlt);
      else set(["composition_rules", "decorations", "wax_seal", "color"], patch.palette.accentAlt.toUpperCase());
    }
  }
  if (patch.typeSet) unchanged("typeSet (select heading_font/body_font instead)", patch.typeSet, source.typeSet);
  if (patch.materialSet) unchanged("materialSet (select paper_texture instead)", patch.materialSet, source.materialSet);
  if (patch.artwork) unchanged("artwork replacement", patch.artwork, source.artwork);
  if (patch.foil) {
    if (patch.foil.enabled !== undefined) set(["composition_rules", "decorations", "foil_lines", "enabled"], patch.foil.enabled);
    if (patch.foil.color) canvas("accent_color", patch.foil.color);
  }
  if (patch.atmosphere) {
    if (patch.atmosphere.grainIntensity !== undefined) set(["canvas", "noise_opacity"], patch.atmosphere.grainIntensity);
    if (patch.atmosphere.ambientGlow !== undefined) unchanged("atmosphere.ambientGlow", patch.atmosphere.ambientGlow, source.atmosphere.ambientGlow);
    if (patch.atmosphere.vignetteStrength !== undefined) unchanged("atmosphere.vignetteStrength", patch.atmosphere.vignetteStrength, source.atmosphere.vignetteStrength);
  }
  if (patch.surface) {
    if (patch.surface.texture) {
      if (patch.surface.texture === "smooth") set(["canvas", "paper_texture"], "smooth_vellum");
      else if (patch.surface.texture === "cotton-paper") set(["canvas", "paper_texture"], source.designSpec.canvas.paper_texture === "smooth_vellum" ? "cotton_deckle" : source.designSpec.canvas.paper_texture);
      else unchanged("surface.texture", patch.surface.texture, source.surface.texture);
    }
    if (patch.surface.borderStyle && patch.surface.borderStyle !== source.surface.borderStyle) {
      const framing = { "double-hairline": "double_fine_border", "frame-inset": "arch_portal", none: "floating_minimal" } as const;
      const key = patch.surface.borderStyle as keyof typeof framing;
      if (!framing[key]) throw new Error("Use designSpec.composition_rules.card_framing for the supported editorial frame treatments");
      set(["composition_rules", "card_framing"], framing[key]);
    }
  }
  if (patch.finishing) {
    if (patch.finishing.type && patch.finishing.type !== source.finishing.type) {
      if (patch.finishing.type === "gold-foil" || patch.finishing.type === "none") set(["composition_rules", "decorations", "foil_lines", "enabled"], patch.finishing.type === "gold-foil");
      else if (patch.finishing.type === "blind-emboss") { set(["composition_rules", "decorations", "foil_lines", "enabled"], false); set(["component_manifest", "rsvp_style"], "letterpress_form"); }
      else throw new Error("Editorial foil supports gold rules or blind letterpress; silver-chrome and bronze-patina require another design");
    }
    if (patch.finishing.sheenAngle !== undefined) unchanged("finishing.sheenAngle", patch.finishing.sheenAngle, source.finishing.sheenAngle);
  }
  if (patch.typographyScale) {
    if (patch.typographyScale.displayScale) unchanged("typographyScale.displayScale", patch.typographyScale.displayScale, source.typographyScale.displayScale);
    for (const [legacy, exact] of [["headlineTracking", "heading_tracking"], ["metaTracking", "meta_tracking"]] as const) {
      const token = patch.typographyScale[legacy];
      if (token !== undefined) {
        if (!token.endsWith("em")) throw new Error("Editorial tracking uses bounded em values, not pixel spacing");
        set(["typography", exact], `tracking-[${parseFloat(token)}em]`);
      }
    }
  }
  if (patch.ornament) Object.entries(patch.ornament).forEach(([key, value]) => unchanged(`ornament.${key}`, value, source.ornament[key as keyof Theme["ornament"]]));
  if (patch.layout) {
    if (patch.layout.preset) unchanged("layout.preset", patch.layout.preset, source.layout.preset);
    if (patch.layout.hero) unchanged("layout.hero", patch.layout.hero, source.layout.hero);
    if (patch.layout.nameFlow) unchanged("layout.nameFlow", patch.layout.nameFlow, source.layout.nameFlow);
    if (patch.layout.composition && patch.layout.composition !== source.layout.composition) {
      const archetype = Object.entries(DESIGN_ARCHETYPE_COMPONENTS).find(([, id]) => id === patch.layout!.composition)?.[0];
      if (!archetype) throw new Error("Editorial refinement can select only the five registered editorial archetypes");
      set(["archetype"], archetype);
      set(["component_manifest", "hero_layout_component"], patch.layout.composition);
    }
    if (patch.layout.visualPlacement && patch.layout.visualPlacement !== source.layout.visualPlacement) {
      const placement = { band: "hero_background", inset: "framed_illustration", "side-right": "floating_botanical" } as const;
      const key = patch.layout.visualPlacement as keyof typeof placement;
      if (!placement[key]) throw new Error("Use designSpec.graphics_generation.placement: hero_background, framed_illustration or floating_botanical");
      set(["graphics_generation", "placement"], placement[key]);
    }
  }
  if (patch.motion?.ambient) unchanged("motion.ambient", patch.motion.ambient, "none");
  const nextSpec = mergePatch(mergePatch(source.designSpec, translated), patch.designSpec ?? {}) as DesignSpec;
  const compiled = compileDesignSpec(nextSpec, merged);
  compiled.meta = structuredClone(source.meta);
  compiled.generatedVisual = source.generatedVisual;
  for (const key of ["text_color_primary", "text_color_muted"] as const) if (compiled.designSpec!.canvas[key] !== nextSpec.canvas[key]) adjustments.push(`Editorial contrast: ${key} ${nextSpec.canvas[key]} → ${compiled.designSpec!.canvas[key]} (minimum 4.5:1).`);
  return { theme: compiled, adjustments };
}

export function applyRefinement(source: Theme, rawPatch: unknown, context: RefinementContext) {
  const patch = ThemePatch.parse(rawPatch);
  let merged = mergePatch(source, patch) as Theme;
  if (source.studioTemplate) {
    const unsupported = Object.keys(patch).filter((key) => !["studioTemplate", "photos", "motion"].includes(key));
    if (unsupported.length) throw new Error("Авторский шаблон допускает только согласованные палитры, пары шрифтов, фотографии и включение движения. Для другой композиции выберите новый шаблон.");
    // Deep merge keeps every untouched composition token when an owner changes
    // a palette or one section variant in a later immutable version.
    const selection = (mergePatch(source.studioTemplate, patch.studioTemplate ?? {}) as NonNullable<Theme["studioTemplate"]>);
    const recipe = studioTemplateTheme({ templateId: selection.id, paletteId: selection.paletteId, fontPairId: selection.fontPairId, ornamentSetId: selection.ornamentSetId, ...(selection.composition ? { composition: selection.composition } : {}) });
    if (patch.motion?.ambient && patch.motion.ambient !== "none") throw new Error("Авторский шаблон использует свой набор движения.");
    const motion = patch.motion?.preset ?? source.motion.preset;
    if (motion !== "still" && motion !== recipe.motion.preset) throw new Error("Можно включить движение шаблона или отключить его.");
    merged = { ...recipe, meta: { ...structuredClone(source.meta), name: recipe.meta.name }, photos: patch.photos ?? structuredClone(source.photos), layout: { ...recipe.layout, sectionOrder: [...source.layout.sectionOrder] }, motion: { preset: motion, ambient: "none" } };
  } else if (patch.studioTemplate) throw new Error("Выбор палитры шаблона доступен после создания приглашения из каталога.");
  const specRefinement = source.designSpec || patch.designSpec ? refineDesignSpec(source, patch, merged) : undefined;
  if (specRefinement) merged = specRefinement.theme;
  const options: ValidateOptions = { locale: context.content.locale, hasHighQualityAsset: hasHeroPhoto(merged, context.assetPlan, context.mediaInfo) };
  if (patch.photos) {
    for (const placement of patch.photos) {
      const asset = context.assetPlan.assets.find((asset) => asset.id === placement.id && asset.role !== "unused" && asset.placement);
      if (!asset || !context.mediaInfo[placement.id]) throw new Error("Photo placements must use enabled project photo ids, never references");
      if (placement.section === "hero" && (asset.quality !== "high" || !heroGrade(context.mediaInfo[asset.id]))) throw new Error("Hero photo must have a high-quality source");
    }
  }
  const repaired = repairTheme(merged, options);
  const validated = validateTheme(repaired.value, options);
  if (!validated.ok) throw new Error(validated.errors.join("; "));
  if (populatedSections(context.content).some((section) => !validated.theme.layout.sectionOrder.includes(section))) throw new Error("Do not omit populated event sections");
  const changes = themeChanges(source, validated.theme);
  if (!changes.length) throw new Error("The patch does not change any rendered field");
  return { patch, theme: validated.theme, changes, adjustments: [...(specRefinement?.adjustments ?? []), ...repaired.adjustments] };
}
export type RefinedTheme = ReturnType<typeof applyRefinement> & Pick<VersionRecord, "model" | "elapsedMs" | "summary">;
