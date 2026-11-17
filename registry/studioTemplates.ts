import { Theme, type Palette } from "@/lib/schema/theme";
import type { Content } from "@/lib/schema/content";
import {
  StudioSelection,
  StudioComposition,
  STUDIO_COMPOSITION_JSON_SCHEMA,
  type StudioTemplateId,
  type StudioPaletteId,
  type StudioFontPairId,
  type StudioOrnamentSetId,
} from "@/lib/schema/studioTemplate";
import { SECTION_IDS } from "./keys";
import { moodPalettes, moodProfiles } from "./moodProfiles";

/** Reviewed pigments, shared by the editor, compiler and model inventory.
 * Both live text colours pass 4.5:1 on the paper and raised surface. */
export const studioPalettes: Record<StudioPaletteId, Palette & { name: string }> = {
  ivory: { name: "Слоновая кость", bg: "#F2ECE2", surface: "#F8F3EA", ink: "#2B2724", muted: "#655A50", accent: "#744437", accentAlt: "#A47550" },
  sage: { name: "Шалфей", bg: "#DADED0", surface: "#F0F1E7", ink: "#24362C", muted: "#4D5D50", accent: "#53684B", accentAlt: "#8D7954" },
  rose: { name: "Пыльная роза", bg: "#ECDADE", surface: "#F4E9E9", ink: "#3D2830", muted: "#6D5158", accent: "#844855", accentAlt: "#A27369" },
  champagne: { name: "Шампань", bg: "#E3D5B8", surface: "#F0E7D6", ink: "#312B22", muted: "#635745", accent: "#805A2E", accentAlt: "#9A7244" },
  terracotta: { name: "Терракота", bg: "#D3A086", surface: "#F0C7AA", ink: "#30271F", muted: "#4F382D", accent: "#7C382D", accentAlt: "#A34D31" },
  ink: { name: "Чернила", bg: "#222833", surface: "#303847", ink: "#F3EEE4", muted: "#CDD1DA", accent: "#D0BB8D", accentAlt: "#B5BBCF" },
  wine: { name: "Винный", bg: "#432C37", surface: "#543844", ink: "#F5EEE4", muted: "#DCCCD1", accent: "#D5B383", accentAlt: "#C79C9B" },
  slate: { name: "Сланец", bg: "#2F3E45", surface: "#3A4C52", ink: "#F4EEE4", muted: "#CBD6D5", accent: "#D0B486", accentAlt: "#98B1B2" },
  cobalt: { name: "Кобальт", bg: "#364785", surface: "#475C9F", ink: "#F5EFE4", muted: "#DFE4F3", accent: "#ECC678", accentAlt: "#BFCBE8" },
  clay: { name: "Глина", bg: "#DCCABB", surface: "#F0E4D7", ink: "#332A29", muted: "#615349", accent: "#795140", accentAlt: "#A57960" },
  forest: { name: "Лесной", bg: "#243C32", surface: "#335043", ink: "#F0EFE3", muted: "#CEDACD", accent: "#CCB689", accentAlt: "#ACBA9B" },
  cinnabar: { name: "Киноварь", bg: "#F8F4EC", surface: "#FFFAF1", ink: "#352D2A", muted: "#65564D", accent: "#991E25", accentAlt: "#B18445" },
  ...moodPalettes,
};

/** Each id resolves to a complete, licensed, locale-checked registry typeset.
 * We never let a request replace the faces, sizes, leading or weights. */
export const studioFontPairs: Record<StudioFontPairId, { name: string; description: string }> = {
  editorial: { name: "Редакционная", description: "Cormorant Garamond и Golos Text: выразительная антиква и спокойные подписи." },
  ceremony: { name: "Торжественная", description: "Cormorant Garamond и EB Garamond: лёгкая антиква и тёплый книжный текст." },
  poetic: { name: "Поэтическая", description: "Prata и Golos Text: чёткий контраст штрихов и простые читаемые детали." },
  modernist: { name: "Современная", description: "Unbounded и Golos Text: смелые широкие буквы и компактные подписи." },
  gallery: { name: "Галерейная", description: "Tenor Sans и Golos Text: тихая геометрия и ясная иерархия." },
  "modern-editorial": { name: "Modern Editorial", description: "Cormorant Garamond и Inter." },
  "botanical-haute": { name: "Botanical Haute", description: "Prata и Manrope." },
  "velvet-noir": { name: "Velvet Noir", description: "Bodoni Moda и Montserrat." },
};

export type StudioStyleTag = "light" | "dark" | "serif" | "sans" | "minimal" | "floral" | "geometric" | "luxury" | "editorial";
/** Tags describe reusable assets, not a whitelist owned by any template. */
export const studioPaletteTags: Record<StudioPaletteId, readonly StudioStyleTag[]> = {
  ivory: ["light", "minimal", "editorial"], sage: ["light", "floral"], rose: ["light", "floral", "luxury"],
  champagne: ["light", "luxury"], terracotta: ["light", "geometric"], ink: ["dark", "minimal", "luxury"],
  wine: ["dark", "luxury"], slate: ["dark", "minimal"], cobalt: ["dark", "geometric"],
  clay: ["light", "minimal"], forest: ["dark", "floral"], cinnabar: ["light", "luxury"],
  "modern-editorial": ["light", "minimal", "editorial"],
  "botanical-haute": ["light", "floral", "luxury"],
  "velvet-noir": ["dark", "luxury", "editorial"],
};
export const studioFontPairTags: Record<StudioFontPairId, readonly StudioStyleTag[]> = {
  editorial: ["serif", "editorial", "luxury"], ceremony: ["serif", "luxury"], poetic: ["serif", "editorial"],
  modernist: ["sans", "geometric"], gallery: ["sans", "minimal", "editorial"],
  "modern-editorial": ["serif", "minimal", "editorial"],
  "botanical-haute": ["serif", "floral", "luxury"],
  "velvet-noir": ["serif", "editorial", "luxury"],
};
export const studioOrnamentCompatibility: Record<StudioOrnamentSetId, {
  tags: readonly StudioStyleTag[];
  paletteTags: readonly StudioStyleTag[];
  fontTags: readonly StudioStyleTag[];
}> = {
  "editorial-rules": { tags: ["minimal", "editorial"], paletteTags: ["light", "dark"], fontTags: ["serif", "sans"] },
  "botanical-engraving": { tags: ["floral", "editorial"], paletteTags: ["light", "dark"], fontTags: ["serif", "sans"] },
  "classic-monogram": { tags: ["luxury", "serif"], paletteTags: ["light", "dark"], fontTags: ["serif", "sans"] },
  "graphic-ribbon": { tags: ["geometric"], paletteTags: ["light", "dark"], fontTags: ["serif", "sans"] },
  "corporate-grid": { tags: ["minimal", "geometric"], paletteTags: ["light", "dark"], fontTags: ["serif", "sans"] },
  "deco-lines": { tags: ["geometric", "luxury"], paletteTags: ["light", "dark"], fontTags: ["serif", "sans"] },
  // These supplied watercolours have a light paper ground; unlike native SVG,
  // recolouring them would destroy their edges. Keep that real asset constraint.
  "chinese-garden": { tags: ["floral", "luxury"], paletteTags: ["light"], fontTags: ["serif", "sans"] },
};

const styleTags: Record<StudioTemplateId, readonly StudioStyleTag[]> = {
  editorial: ["editorial", "serif"], botanical: ["floral", "light"], classic: ["luxury", "serif"],
  modern: ["geometric", "sans"], corporate: ["minimal", "sans"], nocturne: ["dark", "luxury"], heritage: ["floral", "luxury"],
};

export interface StudioTemplateDescriptor {
  id: StudioTemplateId;
  name: string;
  description: string;
  eventTypes: readonly Content["eventType"][];
  paletteIds: readonly StudioPaletteId[];
  fontPairIds: readonly StudioFontPairId[];
  ornamentSetId: StudioOrnamentSetId;
  defaultPaletteId: StudioPaletteId;
  defaultFontPairId: StudioFontPairId;
}

/** Style directions and legacy recipes. The short lists remain manual picker
 * suggestions; parametric compositions use asset tags across all directions. */
export const studioTemplates: readonly StudioTemplateDescriptor[] = [
  { id: "editorial", name: "Editorial", description: "Фотоистория: крупные имена, центральный портрет, журнальные поля и тонкие правила.", eventTypes: ["wedding", "engagement", "anniversary", "other"], paletteIds: ["ivory", "rose", "champagne"], fontPairIds: ["editorial", "ceremony"], ornamentSetId: "editorial-rules", defaultPaletteId: "ivory", defaultFontPairId: "editorial" },
  { id: "botanical", name: "Ботаника", description: "Лист гербария: оригинальная гравюрная ветвь, мягкая бумага и камерная вертикальная история.", eventTypes: ["wedding", "engagement", "anniversary", "birthday", "other"], paletteIds: ["sage", "ivory", "forest"], fontPairIds: ["ceremony", "poetic"], ornamentSetId: "botanical-engraving", defaultPaletteId: "sage", defaultFontPairId: "ceremony" },
  { id: "classic", name: "Классика", description: "Церемониальное письмо: инициалы, печать, тонкая рамка и тёплая металлическая отделка.", eventTypes: ["anniversary", "wedding", "engagement", "other"], paletteIds: ["champagne", "ivory", "rose"], fontPairIds: ["ceremony", "poetic"], ornamentSetId: "classic-monogram", defaultPaletteId: "champagne", defaultFontPairId: "ceremony" },
  { id: "modern", name: "Современный", description: "Графический плакат: крупная типографика, контрастная лента и энергичная композиция даты.", eventTypes: ["birthday", "corporate", "other"], paletteIds: ["terracotta", "cobalt", "clay"], fontPairIds: ["modernist", "gallery"], ornamentSetId: "graphic-ribbon", defaultPaletteId: "terracotta", defaultFontPairId: "modernist" },
  { id: "corporate", name: "Чистый", description: "Деловая сетка: название события, время, расписание и маршрут с ясной иерархией.", eventTypes: ["corporate", "other"], paletteIds: ["ivory", "slate", "ink"], fontPairIds: ["gallery", "modernist"], ornamentSetId: "corporate-grid", defaultPaletteId: "ivory", defaultFontPairId: "gallery" },
  { id: "nocturne", name: "Ноктюрн", description: "Вечерняя афиша: глубокая поверхность, монументальная дата и строгая геометрия ар-деко.", eventTypes: ["wedding", "engagement", "anniversary", "birthday", "corporate", "other"], paletteIds: ["ink", "wine", "forest"], fontPairIds: ["poetic", "editorial"], ornamentSetId: "deco-lines", defaultPaletteId: "ink", defaultFontPairId: "poetic" },
  { id: "heritage", name: "Chinese Heritage", description: "Церемониальная веб-история: красный конверт, бумага цвета слоновой кости, ветви сливы, фонари и горный пейзаж. Живые имена и факты, календарь и ответ гостя.", eventTypes: ["wedding", "engagement", "anniversary", "other"], paletteIds: ["cinnabar", "ivory", "champagne"], fontPairIds: ["ceremony", "editorial"], ornamentSetId: "chinese-garden", defaultPaletteId: "cinnabar", defaultFontPairId: "ceremony" },
];

interface NativeOrnamentSet {
  name: string;
  source: "authored-native" | "owner-supplied-artwork";
  elements: readonly string[];
  styleBible: {
    technique: string;
    paletteConstraint: string;
    light: string;
    detail: string;
    avoid: readonly string[];
    referenceHandling: string;
  };
}

const referenceHandling = "References describe mood, temperature and visual density only. Never copy their imagery, lettering, names or composition. Native SVG/CSS elements are the current reusable library; no curated bitmap pack is claimed. Any future raster addition needs family review before entering the library.";
const avoid = ["generated text or page layouts", "stock clipart", "mixed illustration techniques", "CGI or glossy 3D", "decorations behind live text"];

/** Native code assets and explicitly supplied owner artwork live locally.
 * These bibles are library contracts, never request-time image prompts. */
export const studioOrnamentSets: Record<StudioOrnamentSetId, NativeOrnamentSet> = {
  "editorial-rules": { name: "Редакционные правила", source: "authored-native", elements: ["hairline-rule", "journal-index", "portrait-mat"], styleBible: { technique: "Native fine editorial rules and photographic passepartout; real HTML typography.", paletteConstraint: "Use only the selected palette's muted and accent pigments; at most one accent in a spread.", light: "Flat print lighting with a restrained contact shadow under the photograph.", detail: "Thin rules, generous unprinted fields, one focal photograph.", avoid, referenceHandling } },
  "botanical-engraving": { name: "Ботаническая гравюра", source: "authored-native", elements: ["engraved-branch", "specimen-mark", "botanical-divider"], styleBible: { technique: "Original monochrome SVG botanical engraving; consistent fine ink strokes.", paletteConstraint: "Selected sage, ivory or forest family; engravings use one palette pigment.", light: "Soft side light on matte cotton paper.", detail: "One branch and a small recurring separator, quiet leaf and seed details.", avoid: [...avoid, "floral wreaths around every section", "watercolour mixed with engraving"], referenceHandling } },
  "classic-monogram": { name: "Классический вензель", source: "authored-native", elements: ["live-monogram", "wax-seal", "ceremonial-rule"], styleBible: { technique: "Live initials, authored wax seal and fine stationary frame; restrained print craft.", paletteConstraint: "Ivory, champagne or rose paper; one warm brass accent, no bright yellow gold.", light: "Consistent soft upper-left light and short paper contact shadows.", detail: "One seal, measured double rules, no elaborate coat of arms.", avoid: [...avoid, "invented logos or heraldry", "metal on all text"], referenceHandling } },
  "graphic-ribbon": { name: "Графическая лента", source: "authored-native", elements: ["abstract-band", "date-disc", "offset-marker"], styleBible: { technique: "Original CSS/SVG geometric ribbon with clean flat print edges.", paletteConstraint: "Terracotta, cobalt or clay; a single bold accent against the authored base.", light: "Matte screen-print surface; avoid simulated glossy objects.", detail: "One large graphic gesture, open spaces and clear event facts.", avoid: [...avoid, "confetti in every section", "multiple unrelated shapes"], referenceHandling } },
  "corporate-grid": { name: "Деловая сетка", source: "authored-native", elements: ["grid-rule", "programme-index", "fact-label"], styleBible: { technique: "Native editorial grid, numerical programme labels and quiet typographic rules.", paletteConstraint: "Ivory, slate or ink; use only approved palette values, never invent brand colours.", light: "Even neutral lighting; no theatrical atmosphere.", detail: "Functional lines align event title, time, schedule and location.", avoid: [...avoid, "ornamental flowers or seals", "decorative motion around schedule"], referenceHandling } },
  "deco-lines": { name: "Линии ар-деко", source: "authored-native", elements: ["deco-fan", "stepped-rule", "night-date-frame"], styleBible: { technique: "Original restrained SVG art-deco geometry and native letterforms.", paletteConstraint: "Ink, wine or forest; one pale metallic accent and readable warm text.", light: "Low, warm directional light with quiet dark surfaces.", detail: "A single stepped or fan motif and a monumental date; no repeated borders.", avoid: [...avoid, "neon glow", "sparkles or perpetual large moving layers"], referenceHandling } },
  "chinese-garden": { name: "Китайский сад", source: "owner-supplied-artwork", elements: ["plum-branch", "hanging-lantern", "mountain-landscape", "red-envelope"], styleBible: { technique: "Watercolour artwork extracted from the owner's supplied invitation and stored as local WebP assets; an authored CSS paper envelope and live HTML typography complete the composition.", paletteConstraint: "Cinnabar, ivory or champagne paper with one deep red accent and restrained warm brass linework.", light: "Soft upper-left light, matte paper and short contact shadows under the envelope.", detail: "A ceremonial envelope opening and a calm vertical story; supplied plum branches, lanterns and mountains frame clear text fields.", avoid: [...avoid, "invented Chinese writing", "perpetual falling petals", "decorative reference photographs"], referenceHandling: "The owner explicitly supplied their own HTML invitation for reusable design implementation. Its decorative artwork is retained locally with provenance; event names, dates, copy and guest photographs are never imported into customer invitations. No new image generation is claimed." } },
};

type AuthoredRecipe = Pick<Theme, "surface" | "atmosphere" | "finishing" | "typographyScale" | "layout" | "motion"> & { foil: boolean };
const sectionOrder = [...SECTION_IDS];
const recipe = (composition: Theme["layout"]["composition"], texture: Theme["surface"]["texture"], borderStyle: Theme["surface"]["borderStyle"], motion: Theme["motion"]["preset"], tracking: string, finishing: Theme["finishing"]["type"] = "none", foil = false): AuthoredRecipe => ({
  surface: { texture, borderStyle },
  atmosphere: { grainIntensity: texture === "cotton-paper" ? .035 : texture === "deep-velvet" ? .018 : .01, vignetteStrength: texture === "deep-velvet" ? .12 : 0 },
  finishing: { type: finishing, sheenAngle: 135 },
  typographyScale: { displayScale: "editorial", headlineTracking: tracking, metaTracking: ".12em" },
  layout: { preset: "scroll-narrative", composition, hero: "typographic", photoArrangement: "stack", visualPlacement: "inset", nameFlow: "natural", sectionOrder },
  motion: { preset: motion, ambient: "none" },
  foil,
});
const recipes: Record<StudioTemplateId, AuthoredRecipe> = {
  editorial: recipe("editorial-story", "cotton-paper", "none", "drift", "-.04em"),
  botanical: recipe("botanical", "cotton-paper", "none", "unfold", "-.025em"),
  classic: recipe("folio", "cotton-paper", "double-hairline", "unfold", "-.025em", "bronze-patina", true),
  modern: recipe("ribbon", "smooth", "none", "drift", "-.04em"),
  corporate: recipe("letter", "smooth", "hairline", "still", "-.015em"),
  nocturne: recipe("cinematic", "deep-velvet", "none", "drift", "-.025em", "bronze-patina", true),
  heritage: recipe("folio", "cotton-paper", "none", "drift", "-.025em"),
};

/** Phone-first rhythm belongs to the template revision, never the selection.
 * The renderer consumes these four variables after the shared theme variables. */
const spacing: Record<StudioTemplateId, { section: string; hero: string; measure: string; fact: string }> = {
  editorial: { section: "88px", hero: "56px", measure: "38ch", fact: "24px" },
  botanical: { section: "80px", hero: "60px", measure: "34ch", fact: "24px" },
  classic: { section: "88px", hero: "64px", measure: "36ch", fact: "28px" },
  modern: { section: "72px", hero: "44px", measure: "38ch", fact: "20px" },
  corporate: { section: "64px", hero: "48px", measure: "48ch", fact: "20px" },
  nocturne: { section: "96px", hero: "64px", measure: "34ch", fact: "28px" },
  heritage: { section: "88px", hero: "72px", measure: "38ch", fact: "28px" },
};
export function studioTemplateCssVars(id: StudioTemplateId): Record<string, string> {
  const tokens = spacing[id];
  return { "--studio-section-space": tokens.section, "--studio-hero-space": tokens.hero, "--studio-copy-measure": tokens.measure, "--studio-fact-space": tokens.fact };
}

const compositionPreset = (
  heroLayout: StudioComposition["heroLayout"], photoShape: StudioComposition["photoShape"],
  surfaceStyle: StudioComposition["surfaceStyle"], spacingScale: StudioComposition["spacingScale"],
  typographyAccent: StudioComposition["typographyAccent"],
  sectionVariants: StudioComposition["sectionVariants"],
  placement: StudioComposition["decorConfig"]["placement"] = "dividers",
): StudioComposition => ({ heroLayout, photoShape, surfaceStyle, spacingScale, typographyAccent, sectionVariants, decorConfig: { placement, density: "subtle", opacity: .3 } });

/** Defaults are explicit opt-in presets, never injected into persisted legacy markers. */
export const studioCompositionPresets: Record<StudioTemplateId, StudioComposition> = {
  editorial: compositionPreset("split-editorial", "sharp", "flat", "airy-gallery", "italic-serif-accent", { countdown: "date-led", program: "editorial-list", venue: "split", gallery: "editorial", rsvp: "split" }),
  botanical: compositionPreset("framed-arch", "arch", "soft-gradient", "airy-gallery", "classic-centered", { countdown: "tiles", program: "timeline", venue: "stacked", gallery: "grid", rsvp: "card" }, "corners"),
  classic: compositionPreset("minimal-card", "rounded", "bordered-hairline", "balanced", "classic-centered", { countdown: "date-led", program: "timeline", venue: "card", gallery: "editorial", rsvp: "card" }, "frame"),
  modern: compositionPreset("typographic-poster", "sharp", "flat", "compact-poster", "oversized-display", { countdown: "inline", program: "cards", venue: "split", gallery: "filmstrip", rsvp: "minimal" }, "background-pattern"),
  corporate: compositionPreset("minimal-card", "rounded", "elevated-card", "balanced", "uppercase-wide-tracking", { countdown: "inline", program: "editorial-list", venue: "card", gallery: "grid", rsvp: "split" }),
  nocturne: compositionPreset("fullscreen-cover", "pill", "glassmorphism", "balanced", "oversized-display", { countdown: "tiles", program: "cards", venue: "split", gallery: "filmstrip", rsvp: "minimal" }, "frame"),
  heritage: compositionPreset("framed-arch", "arch", "bordered-hairline", "airy-gallery", "classic-centered", { countdown: "date-led", program: "timeline", venue: "stacked", gallery: "editorial", rsvp: "card" }, "corners"),
};

export function resolveStudioComposition(id: StudioTemplateId, composition?: StudioComposition): StudioComposition {
  return StudioComposition.parse(composition ?? studioCompositionPresets[id]);
}

export function studioCompositionCssVars(composition: StudioComposition): Record<string, string> {
  const scale = {
    "compact-poster": { section: "48px", hero: "36px", measure: "40ch", fact: "18px" },
    balanced: { section: "76px", hero: "56px", measure: "40ch", fact: "24px" },
    "airy-gallery": { section: "108px", hero: "76px", measure: "36ch", fact: "32px" },
  }[composition.spacingScale];
  return {
    "--studio-section-space": scale.section, "--studio-hero-space": scale.hero,
    "--studio-copy-measure": scale.measure, "--studio-fact-space": scale.fact,
    "--studio-decor-opacity": String(composition.decorConfig.density === "none" ? 0 : composition.decorConfig.opacity),
  };
}

export function studioSelectionCompatibility(selection: StudioSelection): string[] {
  if (!selection.composition) return [];
  const ornament = studioOrnamentCompatibility[selection.ornamentSetId];
  const errors: string[] = [];
  if (selection.composition.decorConfig.density !== "none" && !ornament.paletteTags.some((tag) => studioPaletteTags[selection.paletteId].includes(tag))) {
    errors.push(`Ornament set ${selection.ornamentSetId} requires palette tags ${ornament.paletteTags.join("/")}`);
  }
  if (!ornament.fontTags.some((tag) => studioFontPairTags[selection.fontPairId].includes(tag))) {
    errors.push(`Ornament set ${selection.ornamentSetId} requires font tags ${ornament.fontTags.join("/")}`);
  }
  if (selection.composition.typographyAccent === "italic-serif-accent" && !studioFontPairTags[selection.fontPairId].includes("serif")) {
    errors.push("italic-serif-accent requires a serif font pair");
  }
  return errors;
}

/** Compatibility is enforced again by code, independent of model guidance.
 * Every invocation returns a fresh theme, so later fact/photo wiring is safe. */
export function studioTemplateTheme(input: StudioSelection): Theme {
  const selection = StudioSelection.parse(input);
  const template = studioTemplates.find(({ id }) => id === selection.templateId)!;
  if (selection.composition) {
    const errors = studioSelectionCompatibility(selection);
    if (errors.length) throw new Error(errors.join("; "));
  } else {
    if (!template.paletteIds.includes(selection.paletteId)) throw new Error(`Palette ${selection.paletteId} is not available for template ${template.id}`);
    if (!template.fontPairIds.includes(selection.fontPairId)) throw new Error(`Font pair ${selection.fontPairId} is not available for template ${template.id}`);
    if (template.ornamentSetId !== selection.ornamentSetId) throw new Error(`Use ornament set ${template.ornamentSetId} for template ${template.id}`);
  }
  const { name: paletteName, ...palette } = studioPalettes[selection.paletteId];
  const { foil, ...authored } = recipes[template.id];
  return Theme.parse({
    ...authored,
    studioTemplate: { id: template.id, revision: 1, paletteId: selection.paletteId, fontPairId: selection.fontPairId, ornamentSetId: selection.ornamentSetId, ...(selection.composition ? { composition: selection.composition } : {}) },
    meta: { name: `${template.name} · ${paletteName}`, mood: [template.id], rationale: template.description },
    palette, typeSet: selection.fontPairId, materialSet: "paper", artwork: "none",
    foil: { enabled: foil, color: palette.accent },
    // The template renderer owns the named native pack and its placements.
    ornament: { pack: "none", density: "light", placement: [], color: "accent" },
    photos: [],
  });
}

/** JSON-only inventory; the model selects IDs while the code owns all recipes. */
export function studioTemplateCatalog() {
  return {
    revision: 1,
    compositionSchema: structuredClone(STUDIO_COMPOSITION_JSON_SCHEMA),
    moodProfiles: moodProfiles.map(({ id, name, description, selection }) => ({ id, name, description: description.ru, selection: structuredClone(selection) })),
    templates: studioTemplates.map((template) => ({ ...template, tags: [...styleTags[template.id]], compositionPreset: resolveStudioComposition(template.id), eventTypes: [...template.eventTypes], paletteIds: [...template.paletteIds], fontPairIds: [...template.fontPairIds] })),
    palettes: Object.fromEntries(Object.entries(studioPalettes).map(([id, palette]) => [id, { ...palette, tags: [...studioPaletteTags[id as StudioPaletteId]] }])) as Record<StudioPaletteId, Palette & { name: string; tags: StudioStyleTag[] }>,
    fontPairs: Object.fromEntries(Object.entries(studioFontPairs).map(([id, pair]) => [id, { ...pair, tags: [...studioFontPairTags[id as StudioFontPairId]] }])),
    ornamentSets: Object.fromEntries(Object.entries(studioOrnamentSets).map(([id, set]) => [id, { ...structuredClone(set), compatibility: structuredClone(studioOrnamentCompatibility[id as StudioOrnamentSetId]), styleBible: { ...structuredClone(set.styleBible), paletteConstraint: id === "chinese-garden" ? "Requires a light tagged palette when visible: supplied watercolour has a paper ground." : "Native SVG/CSS uses selected palette pigments and supports both light and dark tagged palettes." } }])),
    rules: ["Choose a style direction as a starting point, then explicitly compose the bounded layout tokens and individual section variants.", "With composition present, paletteIds/fontPairIds/ornamentSetId on templates are defaults and suggestions, not whitelists. Cross-template combinations use ornament compatibility tags against palette and font tags.", "italic-serif-accent requires a serif font pair. A visible chinese-garden ornament requires a light palette; density none disables decoration.", "Registered native assets and explicitly supplied owner artwork are reusable; no request-time image generation is part of this catalog.", "Preserve the canonical semantic section order, pinned photo positions and editable text, and omit empty optional facts.", "Translate distinct briefs into distinct hero, surface, spacing, type and section decisions; do not repeat one default combination for unrelated moods. Manual legacy recipes remain reusable."],
  };
}
