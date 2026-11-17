import { BriefFacts, applyBriefFacts } from "@/lib/studio/briefFacts";
import Anthropic from "@anthropic-ai/sdk";
import type { Content } from "@/lib/schema/content";
import type { DirectedAsset } from "@/lib/assets/crop";
import { composeSeries, type GeneratedSeries } from "@/lib/generation/series";
import { StudioError } from "@/lib/studio/store";
import { SECTION_IDS, COMPOSITION_IDS, ORNAMENT_PACK_IDS, TYPE_SET_IDS } from "@/registry/keys";
import { generateSeriesPrompt } from "./prompts/generateSeries";
import { populatedSections } from "@/lib/invitation/sections";
import { generateVisual } from "./generateVisual";
import { isNativeComposition } from "@/lib/invitation/reference";
import { VariantCount } from "@/lib/schema/variantCount";
import { SURFACE_TEXTURES, SURFACE_BORDERS, FINISHING_TYPES, DISPLAY_SCALES } from "@/lib/schema/theme";
import { assertDistinctDesigns, designContext, designIdentity, DesignSimilarityError, MAX_RECENT_DESIGNS, type DesignIdentity } from "@/lib/generation/diversity";
import { availableDesignComponents } from "@/lib/design/spec";
import { composeSpecification, DesignSpecificationOutput } from "@/lib/generation/designSpec";
import { designSpecToolSchema } from "./tools/designSpec";
import { hauteDesignPrompt } from "./prompts/hauteDesign";
import { StudioSelection, STUDIO_COMPOSITION_JSON_SCHEMA } from "@/lib/schema/studioTemplate";
import { composeStudioTemplate, StudioTemplateOutput } from "@/lib/generation/studioTemplate";
import { studioTemplates, studioTemplateCatalog } from "@/registry/studioTemplates";
import { studioTemplatePrompt } from "./prompts/studioTemplate";

export type DesignReference = { base64: string };
const string = { type: "string" };
const enumeration = (values: readonly string[]) => ({ type: "string", enum: values });
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const array = (items: unknown, minItems = 0, maxItems = 40) => ({ type: "array", items, minItems, maxItems });
const nullableFact = (value: unknown) => ({ anyOf: [{ type: "null" }, object({ value, source: { ...string, minLength: 1, maxLength: 1000 } })] });
function legacySeriesTool(photos: DirectedAsset[], variantCount = 1): Anthropic.Messages.Tool {
  const hex = { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" };
  const identity = {
    palette: object({ bg: hex, surface: hex, ink: hex, muted: hex, accent: hex, accentAlt: hex }), typeSet: enumeration(TYPE_SET_IDS), materialSet: enumeration(["paper", "glass"]),
    foil: object({ enabled: { type: "boolean" }, color: hex }), ornament: object({ pack: enumeration(ORNAMENT_PACK_IDS), density: enumeration(["light", "medium"]), color: enumeration(["accent", "accentAlt", "muted"]) }),
    atmosphere: object({ grainIntensity: { type: "number", minimum: 0, maximum: .15 }, ambientGlow: { ...string, minLength: 1, maxLength: 500 }, vignetteStrength: { type: "number", minimum: 0, maximum: .8 } }),
    surface: object({ texture: enumeration(SURFACE_TEXTURES), borderStyle: enumeration(SURFACE_BORDERS) }),
    finishing: object({ type: enumeration(FINISHING_TYPES), sheenAngle: { type: "number", minimum: 0, maximum: 360 } }),
    typographyScale: object({ displayScale: enumeration(DISPLAY_SCALES), headlineTracking: { ...string, pattern: "^-?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:em|px)$" }, metaTracking: { ...string, pattern: "^-?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:em|px)$" } }),
    motion: object({ preset: enumeration(["still", "unfold", "drift"]), ambient: enumeration(["none", "dust", "petals"]) }),
  };
  return { name: "emit_design_series", description: `Create exactly ${variantCount} invitations. Exploration gives each variant an independent bounded material, finishing, typography, ornament and motion identity. Different colors alone cannot distinguish a design. Place all enabled photo ids exactly once; never invent assets or event facts.`, input_schema: object({
    facts: { anyOf: [{ type: "null" }, object({
      eventType: nullableFact(enumeration(["wedding", "anniversary", "birthday", "corporate", "engagement", "other"])),
      hosts: nullableFact(array({ ...string, minLength: 1, maxLength: 100 }, 1, 12)),
      headline: nullableFact({ ...string, minLength: 1, maxLength: 200 }),
      day: nullableFact({ ...string, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
      venue: nullableFact({ ...string, minLength: 1, maxLength: 200 }),
      venueAddress: nullableFact({ ...string, minLength: 1, maxLength: 1000 }),
      venueNote: nullableFact({ ...string, minLength: 1, maxLength: 1000 }),
      venueMapUrl: nullableFact({ ...string, pattern: "^https?://", maxLength: 2048 }),
      greeting: nullableFact({ ...string, minLength: 1, maxLength: 10000 }),
      wishes: nullableFact({ ...string, minLength: 1, maxLength: 10000 }),
      timeline: nullableFact(array(object({ time: { ...string, pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" }, title: { ...string, minLength: 1, maxLength: 200 }, note: { ...string, maxLength: 1000 } }), 1, 40)),
      closing: nullableFact({ ...string, minLength: 1, maxLength: 1000 }),
      dressCode: nullableFact(object({ title: { ...string, minLength: 1, maxLength: 200 }, note: { ...string, maxLength: 1000 } })),
    })] },
    mode: enumeration(["cohesive", "exploration"]),
    style: object({ name: { ...string, minLength: 1, maxLength: 100 }, mood: array({ ...string, minLength: 1, maxLength: 60 }, 1, 4), rationale: { ...string, minLength: 1, maxLength: 400 },
      intent: object({ visualKind: enumeration(["accent", "scene"]), summary: { ...string, minLength: 1, maxLength: 500 }, cues: array({ ...string, minLength: 1, maxLength: 160 }, 1, 6), avoid: array({ ...string, minLength: 1, maxLength: 160 }, 0, 6), referenceNotes: { ...string, maxLength: 800 }, artworkPrompt: { ...string, minLength: 1, maxLength: 2400 } }),
      ...identity, artwork: enumeration(["none", "suzani-atelier"]),
    }),
    variants: array(object({ direction: { anyOf: [{ type: "null" }, { ...object(identity), required: ["palette", "typeSet"] }] }, name: { ...string, minLength: 1, maxLength: 100 }, rationale: { ...string, minLength: 1, maxLength: 400 },
      layout: object({ preset: enumeration(["scroll-narrative", "card-stack"]), composition: enumeration(COMPOSITION_IDS), hero: enumeration(["typographic", "ornament-frame", "full-photo"]), photoArrangement: enumeration(["row", "stack", "offset"]), visualPlacement: enumeration(["band", "side-left", "side-right", "medallion", "inset"]), nameFlow: enumeration(["natural", "stacked"]), sectionOrder: array(enumeration(SECTION_IDS), 2, SECTION_IDS.length) }),
      ornamentPlacement: array(enumeration(["divider", "corners", "hero-frame", "watermark"]), 0, 2),
      photos: array(object({ id: photos.length ? enumeration(photos.map((photo) => photo.asset.id)) : { ...string, maxLength: 0 }, section: enumeration(SECTION_IDS), index: { type: "integer", minimum: 0, maximum: 40 }, position: enumeration(["before", "after"]) }), photos.length, photos.length),
    }), variantCount, variantCount),
  }) as Anthropic.Messages.Tool["input_schema"] };
}
export function seriesTool(photos: DirectedAsset[], variantCount = 1, structuredDesign = false): Anthropic.Messages.Tool {
  const legacy = legacySeriesTool(photos, variantCount);
  if (!structuredDesign) return legacy;
  const properties = legacy.input_schema.properties as Record<string, Record<string, unknown>>;
  const variants = properties.variants;
  const variant = (variants.items as { properties: Record<string, unknown> }).properties;
  return { name: "emit_design_series", description: "Emit one exact haute editorial design specification, grounded facts and supplied photo placements. Design decisions must be supported by the component inventory.",
    input_schema: object({ facts: properties.facts, design_spec: designSpecToolSchema(), photos: variant.photos }) as Anthropic.Messages.Tool["input_schema"] };
}

export function studioTemplateTool(photos: DirectedAsset[]): Anthropic.Messages.Tool {
  const legacy = legacySeriesTool(photos, 1);
  const properties = legacy.input_schema.properties as Record<string, Record<string, unknown>>;
  const variant = (properties.variants.items as { properties: Record<string, unknown> }).properties;
  const ids = StudioSelection.pick({ templateId: true, paletteId: true, fontPairId: true, ornamentSetId: true });
  const selection = object({ ...Object.fromEntries(Object.entries(ids.shape).map(([key, schema]) => [key, enumeration(schema.options)])), composition: STUDIO_COMPOSITION_JSON_SCHEMA });
  return {
    name: "emit_design_series",
    description: "Compose one editable invitation using a style preset, cross-compatible palette/font/decor IDs and complete bounded composition tokens. Resolve the brief into distinct hero, spacing and section variants. Preserve grounded event facts and supplied photos; no image generation.",
    input_schema: object({ facts: properties.facts, selection, rationale: { ...string, minLength: 1, maxLength: 400 }, photos: variant.photos }) as Anthropic.Messages.Tool["input_schema"],
  };
}

export async function generateSeries(content: Content, photos: DirectedAsset[], references: DesignReference[], client?: Anthropic, options: { createVisual?: boolean; recentDesigns?: DesignIdentity[]; structuredDesign?: boolean; curatedTemplates?: boolean } = {}): Promise<GeneratedSeries> {
  const countResult = VariantCount.safeParse(content.variantCount ?? 1);
  if (!countResult.success) throw new StudioError("Выберите количество вариантов от 1 до 5.");
  const variantCount = countResult.data;
  if (options.structuredDesign && variantCount !== 1) throw new StudioError("Новая дизайн-спецификация создаёт одно приглашение за запрос.");
  if (options.curatedTemplates && variantCount !== 1) throw new StudioError("Авторский шаблон создаёт одно приглашение за запрос.");
  if (options.curatedTemplates && !content.brief?.trim() && content.studioDesign?.templateId && content.studioDesign.templateId !== "auto") {
    const template = studioTemplates.find((item) => item.id === content.studioDesign!.templateId)!;
    const paletteId = content.studioDesign.paletteId === "auto" ? template.defaultPaletteId : content.studioDesign.paletteId;
    const placements = photos.map(({ asset }) => ({ id: asset.id, section: asset.placement!.section, index: asset.placement!.index, position: "before" as const }));
    const result = composeStudioTemplate({ templateId: template.id, paletteId, fontPairId: template.defaultFontPairId, ornamentSetId: template.ornamentSetId }, placements, template.description, content, photos);
    return { ...result, model: "authored-template-v1", elapsedMs: 0, references: references.length };
  }
  if (!content.brief?.trim()) throw new StudioError("Опишите желаемый стиль в поле «Пожелания к дизайну».");
  if (!client && !process.env.ANTHROPIC_API_KEY) throw new StudioError("Добавьте ANTHROPIC_API_KEY в .env.local и перезапустите сервер, чтобы создавать варианты.", 503);
  const start = Date.now();
  const sdk = client ?? new Anthropic({ timeout: 90000, maxRetries: 0 });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const suppliedContent = applyBriefFacts(content);
  const sections = populatedSections(suppliedContent);
  const recentDesigns = (options.recentDesigns ?? []).slice(0, MAX_RECENT_DESIGNS);
  const context = { locale: content.locale, eventType: suppliedContent.eventType, brief: content.brief, variantCount, createVisual: !options.curatedTemplates && Boolean(options.createVisual), populatedSections: sections,
    recentDesigns: recentDesigns.map(designContext),
    ...(options.curatedTemplates ? { studioTemplates: studioTemplateCatalog(), studioDesign: content.studioDesign ?? { templateId: "auto", paletteId: "auto" } } : options.structuredDesign ? { availableComponents: availableDesignComponents() } : {}),
    knownFacts: { hosts: suppliedContent.hosts.some((host) => host.name.trim()), headline: Boolean(suppliedContent.headline?.trim()), day: Boolean(suppliedContent.date.start || suppliedContent.date.day), venue: Boolean(suppliedContent.venue.name.trim()), venueAddress: Boolean(suppliedContent.venue.address.trim()), venueNote: Boolean(suppliedContent.venue.note?.trim()), venueMapUrl: Boolean(suppliedContent.venue.mapUrl), greeting: Boolean(suppliedContent.greeting?.trim()), wishes: Boolean(suppliedContent.wishes?.trim()), timeline: Boolean(suppliedContent.timeline.length), closing: Boolean(suppliedContent.closing?.trim()), dressCode: Boolean(suppliedContent.dressCode) },
    photos: photos.map((photo) => ({ id: photo.asset.id, subject: photo.asset.subject, quality: photo.asset.quality, width: photo.info.width, height: photo.info.height, currentSection: photo.asset.placement?.section, placementPinned: Boolean(photo.asset.placementPinned), crop: photo.crop.label })) };
  const blocks: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: JSON.stringify(context) }, ...references.flatMap((ref, index): Anthropic.Messages.ContentBlockParam[] => [{ type: "text", text: `Style reference ${index + 1}; do not place it as an event photo.` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: ref.base64 } }])];
  let correction = "";
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await sdk.messages.create({ model, max_tokens: variantCount === 1 ? 8192 : 12288, system: options.curatedTemplates ? studioTemplatePrompt : options.structuredDesign ? hauteDesignPrompt : generateSeriesPrompt(variantCount), tools: [options.curatedTemplates ? studioTemplateTool(photos) : seriesTool(photos, variantCount, Boolean(options.structuredDesign))], tool_choice: { type: "tool", name: "emit_design_series" }, messages: [{ role: "user", content: [...blocks, { type: "text", text: `Create exactly ${variantCount} compositions in the mode appropriate to the brief.${correction}` }] }] });
      try {
        const tool = response.content.filter((block) => block.type === "tool_use" && block.name === "emit_design_series");
        if (response.stop_reason === "max_tokens" || tool.length !== 1 || tool[0].type !== "tool_use") throw new Error("Emit one complete emit_design_series tool call");
        const input = (options.curatedTemplates ? StudioTemplateOutput.parse(tool[0].input) : options.structuredDesign ? DesignSpecificationOutput.parse(tool[0].input) : tool[0].input) as { style?: { generatedVisual?: unknown } };
        if (input.style?.generatedVisual) throw new Error("Never invent a server-issued generatedVisual reference");
        const { facts: rawFacts, ...design } = input as typeof input & { facts?: unknown };
        const facts = rawFacts == null ? undefined : BriefFacts.parse(rawFacts);
        const interpreted = applyBriefFacts(content, facts);
        const needed = populatedSections(interpreted);
        const specInput = input as typeof input & { design_spec?: unknown; photos?: unknown };
        const curatedInput = input as typeof input & { selection?: unknown; rationale?: string; photos?: unknown };
        const result = options.curatedTemplates
          ? composeStudioTemplate(curatedInput.selection, curatedInput.photos, curatedInput.rationale!, interpreted, photos)
          : options.structuredDesign
          ? composeSpecification(specInput.design_spec, specInput.photos, interpreted, photos)
          : composeSeries(design, content.locale, photos, Boolean(options.createVisual));
        if (result.themes.length !== variantCount) throw new Error(`Return exactly ${variantCount} compositions`);
        if (result.themes.some((theme) => needed.some((section) => !theme.layout.sectionOrder.includes(section)))) throw new Error("Include every populated supplied section in every variant");
        if (options.curatedTemplates) {
          // An explicit family remains the owner's choice; automatic selection
          // must not keep returning a recent composition with different copy.
          if (!content.studioDesign?.templateId || content.studioDesign.templateId === "auto") {
            assertDistinctDesigns(result.themes.map((theme) => designIdentity(theme)), recentDesigns);
          }
          return { ...result, facts, model: response.model, elapsedMs: Date.now() - start, references: references.length };
        }
        const spec = result.themes[0].designSpec;
        const needsGraphic = options.structuredDesign ? Boolean(spec?.graphics_generation.needed) : Boolean(options.createVisual);
        if (needsGraphic && !options.createVisual) throw new Error("Graphics creation was not selected; choose graphics_generation.needed=false and use native decoration.");
        assertDistinctDesigns(result.themes.map((theme) => designIdentity(theme, needsGraphic, result.style.intent?.artworkPrompt)), recentDesigns);
        const nativeStory = result.themes.every((theme) => isNativeComposition(theme.layout.composition));
        if (needsGraphic && !nativeStory) {
          if (!options.structuredDesign && result.style.intent?.visualKind === "scene" && result.themes.some((theme) => theme.layout.composition !== "immersive")) throw new Error("A scene visual requires immersive composition; do not shrink it to a small ornament");
          if (!result.style.intent) throw new Error("Include an artwork prompt in the design intent");
          if (new Set(result.themes.map((theme) => theme.layout.visualPlacement)).size < Math.min(3, variantCount)) throw new Error(`Use at least ${Math.min(3, variantCount)} distinct artwork placements across the variants`);
          const visual = await generateVisual(result.style, references);
          const ref = { id: visual.record.id, sha256: visual.record.sha256, width: visual.record.width, height: visual.record.height, isolated: visual.record.isolated, kind: visual.record.kind };
          result.style.generatedVisual = ref;
          result.themes = result.themes.map((theme) => ({ ...theme, generatedVisual: ref, artwork: "none" }));
          result.style.artwork = "none";
          return { ...result, visual, facts, model: response.model, elapsedMs: Date.now() - start, references: references.length };
        }
        return { ...result, facts, model: response.model, elapsedMs: Date.now() - start, references: references.length };
      } catch (error) {
        if (error instanceof StudioError) throw error;
        if (attempt === 1) throw new StudioError(error instanceof DesignSimilarityError
          ? "Новый дизайн слишком похож на недавние приглашения даже после повторной попытки. Предыдущие дизайны сохранены. Уточните композицию или художественное направление и повторите генерацию."
          : "AI дважды вернул некорректные варианты. Предыдущие дизайны сохранены. Повторите генерацию.", 502);
        correction = ` Previous output was invalid: ${(error as Error).message.slice(0, 2000)}. Fix these issues and preserve the requested cohesive or exploration mode.`;
      }
    }
  } catch (error) {
    if (error instanceof StudioError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new StudioError("Ключ Anthropic отклонён. Проверьте .env.local и перезапустите сервер.", 502);
    if (error instanceof Anthropic.RateLimitError) throw new StudioError("Лимит Anthropic исчерпан. Повторите генерацию позднее.", 429);
    throw new StudioError("Anthropic не ответил на запрос генерации. Предыдущие варианты сохранены. Повторите запрос.", 502);
  }
  throw new Error("Unreachable");
}
