import Anthropic from "@anthropic-ai/sdk";
import type { Content } from "@/lib/schema/content";
import type { DirectedAsset } from "@/lib/assets/crop";
import { composeSeries, type GeneratedSeries } from "@/lib/generation/series";
import { StudioError } from "@/lib/studio/store";
import { SECTION_IDS, COMPOSITION_IDS, ORNAMENT_PACK_IDS, TYPE_SET_IDS } from "@/registry/keys";
import { generateSeriesPrompt } from "./prompts/generateSeries";
import { populatedSections } from "@/lib/invitation/sections";
import { generateVisual } from "./generateVisual";
import { VariantCount } from "@/lib/schema/variantCount";
import { SURFACE_TEXTURES, SURFACE_BORDERS, FINISHING_TYPES, DISPLAY_SCALES } from "@/lib/schema/theme";

export type DesignReference = { base64: string };
const string = { type: "string" };
const enumeration = (values: readonly string[]) => ({ type: "string", enum: values });
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const array = (items: unknown, minItems = 0, maxItems = 40) => ({ type: "array", items, minItems, maxItems });
export function seriesTool(photos: DirectedAsset[], variantCount = 5): Anthropic.Messages.Tool {
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
    mode: enumeration(["cohesive", "exploration"]),
    style: object({ name: { ...string, minLength: 1, maxLength: 100 }, mood: array({ ...string, minLength: 1, maxLength: 60 }, 1, 4), rationale: { ...string, minLength: 1, maxLength: 400 },
      intent: object({ summary: { ...string, minLength: 1, maxLength: 500 }, cues: array({ ...string, minLength: 1, maxLength: 160 }, 1, 6), avoid: array({ ...string, minLength: 1, maxLength: 160 }, 0, 6), referenceNotes: { ...string, maxLength: 800 }, artworkPrompt: { ...string, minLength: 1, maxLength: 2400 } }),
      ...identity, artwork: enumeration(["none", "suzani-atelier"]),
    }),
    variants: array(object({ direction: { anyOf: [{ type: "null" }, { ...object(identity), required: ["palette", "typeSet"] }] }, name: { ...string, minLength: 1, maxLength: 100 }, rationale: { ...string, minLength: 1, maxLength: 400 },
      layout: object({ preset: enumeration(["scroll-narrative", "card-stack"]), composition: enumeration(COMPOSITION_IDS), hero: enumeration(["typographic", "ornament-frame", "full-photo"]), photoArrangement: enumeration(["row", "stack", "offset"]), visualPlacement: enumeration(["band", "side-left", "side-right", "medallion", "inset"]), nameFlow: enumeration(["natural", "stacked"]), sectionOrder: array(enumeration(SECTION_IDS), 2, 8) }),
      ornamentPlacement: array(enumeration(["divider", "corners", "hero-frame", "watermark"]), 0, 2),
      photos: array(object({ id: photos.length ? enumeration(photos.map((photo) => photo.asset.id)) : { ...string, maxLength: 0 }, section: enumeration(SECTION_IDS), index: { type: "integer", minimum: 0, maximum: 40 }, position: enumeration(["before", "after"]) }), photos.length, photos.length),
    }), variantCount, variantCount),
  }) as Anthropic.Messages.Tool["input_schema"] };
}
export async function generateSeries(content: Content, photos: DirectedAsset[], references: DesignReference[], client?: Anthropic, options: { createVisual?: boolean } = {}): Promise<GeneratedSeries> {
  const countResult = VariantCount.safeParse(content.variantCount ?? 5);
  if (!countResult.success) throw new StudioError("Выберите количество вариантов от 1 до 5.");
  const variantCount = countResult.data;
  if (!content.brief?.trim()) throw new StudioError("Опишите желаемый стиль в поле «Пожелания к дизайну».");
  if (!client && !process.env.ANTHROPIC_API_KEY) throw new StudioError("Добавьте ANTHROPIC_API_KEY в .env.local и перезапустите сервер, чтобы создавать варианты.", 503);
  if (options.createVisual && !process.env.OPENAI_API_KEY?.trim()) throw new StudioError("Добавьте OPENAI_API_KEY в .env.local и перезапустите сервер для создания нового визуала.", 503);
  const start = Date.now();
  const sdk = client ?? new Anthropic({ timeout: 90000, maxRetries: 0 });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const sections = populatedSections(content);
  const context = { locale: content.locale, eventType: content.eventType, brief: content.brief, variantCount, createVisual: Boolean(options.createVisual), populatedSections: sections,
    photos: photos.map((photo) => ({ id: photo.asset.id, subject: photo.asset.subject, quality: photo.asset.quality, width: photo.info.width, height: photo.info.height, currentSection: photo.asset.placement?.section, crop: photo.crop.label })) };
  const blocks: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: JSON.stringify(context) }, ...references.flatMap((ref, index): Anthropic.Messages.ContentBlockParam[] => [{ type: "text", text: `Style reference ${index + 1}; do not place it as an event photo.` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: ref.base64 } }])];
  let correction = "";
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await sdk.messages.create({ model, max_tokens: 12288, system: generateSeriesPrompt(variantCount), tools: [seriesTool(photos, variantCount)], tool_choice: { type: "tool", name: "emit_design_series" }, messages: [{ role: "user", content: [...blocks, { type: "text", text: `Create exactly ${variantCount} compositions in the mode appropriate to the brief.${correction}` }] }] });
      try {
        const tool = response.content.filter((block) => block.type === "tool_use" && block.name === "emit_design_series");
        if (response.stop_reason === "max_tokens" || tool.length !== 1 || tool[0].type !== "tool_use") throw new Error("Emit one complete emit_design_series tool call");
        const input = tool[0].input as { style?: { generatedVisual?: unknown } };
        if (input.style?.generatedVisual) throw new Error("Never invent a server-issued generatedVisual reference");
        const result = composeSeries(input, content.locale, photos, Boolean(options.createVisual));
        if (result.themes.length !== variantCount) throw new Error(`Return exactly ${variantCount} compositions`);
        if (result.themes.some((theme) => sections.some((section) => !theme.layout.sectionOrder.includes(section)))) throw new Error("Include every populated supplied section in every variant");
        if (options.createVisual) {
          if (!result.style.intent) throw new Error("Include an artwork prompt in the design intent");
          if (new Set(result.themes.map((theme) => theme.layout.visualPlacement)).size < Math.min(3, variantCount)) throw new Error(`Use at least ${Math.min(3, variantCount)} distinct artwork placements across the variants`);
          const visual = await generateVisual(result.style, references);
          const ref = { id: visual.record.id, sha256: visual.record.sha256, width: visual.record.width, height: visual.record.height, isolated: visual.record.isolated };
          result.style.generatedVisual = ref;
          result.themes = result.themes.map((theme) => ({ ...theme, generatedVisual: ref, artwork: "none" }));
          result.style.artwork = "none";
          return { ...result, visual, model: response.model, elapsedMs: Date.now() - start, references: references.length };
        }
        return { ...result, model: response.model, elapsedMs: Date.now() - start, references: references.length };
      } catch (error) {
        if (error instanceof StudioError) throw error;
        if (attempt === 1) throw new StudioError("AI дважды вернул некорректные варианты. Предыдущие дизайны сохранены. Повторите генерацию.", 502);
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
