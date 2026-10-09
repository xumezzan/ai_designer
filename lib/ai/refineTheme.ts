import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Theme } from "@/lib/schema/theme";
import { ThemePatch } from "@/lib/schema/versions";
import { applyRefinement, type RefinementContext, type RefinedTheme } from "@/lib/versions/refine";
import { StudioError } from "@/lib/studio/store";
import { seriesTool } from "./generateSeries";
import { refineThemePrompt } from "./prompts/refineTheme";
import { populatedSections } from "@/lib/invitation/sections";

type JsonSchema = Record<string, unknown>;
function optionalObject(schema: JsonSchema): JsonSchema {
  if (schema.type !== "object") return schema; // array entries remain complete
  return { ...schema, required: [], properties: Object.fromEntries(Object.entries(schema.properties as Record<string, JsonSchema>).map(([key, value]) => [key, optionalObject(value)])) };
}
export function refinementTool(): Anthropic.Messages.Tool {
  const series = seriesTool([]).input_schema as JsonSchema;
  const root = series.properties as Record<string, JsonSchema>;
  const style = root.style.properties as Record<string, JsonSchema>;
  const variant = (root.variants.items as JsonSchema).properties as Record<string, JsonSchema>;
  const photos = structuredClone(variant.photos);
  photos.minItems = 0; photos.maxItems = 40;
  const photoProperties = (photos.items as JsonSchema).properties as Record<string, JsonSchema>;
  photoProperties.id = { type: "string", minLength: 1, maxLength: 100 };
  const patch = { type: "object", additionalProperties: false, properties: {
    palette: optionalObject(style.palette), typeSet: style.typeSet, materialSet: style.materialSet, artwork: style.artwork,
    foil: optionalObject(style.foil), ornament: optionalObject({ ...style.ornament, properties: { ...(style.ornament.properties as JsonSchema), placement: variant.ornamentPlacement } }),
    layout: optionalObject(variant.layout), photos, motion: optionalObject(style.motion),
  } };
  return { name: "emit_theme_patch", description: "Return only explicitly requested changes as a small partial theme patch. Empty patch means unsupported/no applicable change. Preserve all other fields.", input_schema: { type: "object", required: ["patch", "summary"], additionalProperties: false, properties: { patch, summary: { type: "string", minLength: 1, maxLength: 500 } } } };
}
const Output = z.object({ patch: ThemePatch, summary: z.string().min(1).max(500) }).strict();
export async function refineTheme(source: Theme, instruction: string, context: RefinementContext, client?: Anthropic): Promise<RefinedTheme> {
  if (!instruction.trim() || instruction.length > 2000) throw new StudioError("Опишите правку: от 1 до 2000 символов.");
  if (!client && !process.env.ANTHROPIC_API_KEY) throw new StudioError("Добавьте ANTHROPIC_API_KEY в .env.local и перезапустите сервер.", 503);
  const sdk = client ?? new Anthropic({ timeout: 60000, maxRetries: 0 });
  const start = Date.now();
  const input = { theme: source, instruction, locale: context.content.locale,
    populatedSections: populatedSections(context.content),
    enabledPhotos: context.assetPlan.assets.filter((asset) => asset.role !== "unused" && asset.placement && context.mediaInfo[asset.id]).map((asset) => ({ id: asset.id, quality: asset.quality, ...context.mediaInfo[asset.id] })) };
  let correction = "";
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await sdk.messages.create({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 4096, system: refineThemePrompt, tools: [refinementTool()], tool_choice: { type: "tool", name: "emit_theme_patch" }, messages: [{ role: "user", content: `${JSON.stringify(input)}${correction}` }] });
      try {
        const tools = response.content.filter((block) => block.type === "tool_use" && block.name === "emit_theme_patch");
        if (response.stop_reason === "max_tokens" || tools.length !== 1 || tools[0].type !== "tool_use") throw new Error("Emit one complete emit_theme_patch call");
        const output = Output.parse(tools[0].input);
        if (!Object.keys(output.patch).length) throw new StudioError(`Изменение не применено: ${output.summary}`, 422);
        return { ...applyRefinement(source, output.patch, context), summary: output.summary, model: response.model, elapsedMs: Date.now() - start };
      } catch (error) {
        if (error instanceof StudioError) throw error;
        if (attempt === 1) throw new StudioError("AI дважды вернул некорректную правку. Исходная версия сохранена. Уточните описание и повторите.", 502);
        correction = `\nPrevious patch failed: ${(error as Error).message.slice(0, 1500)}. Fix only these errors; keep the edit partial.`;
      }
    }
  } catch (error) {
    if (error instanceof StudioError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new StudioError("Ключ Anthropic отклонён. Проверьте .env.local и перезапустите сервер.", 502);
    if (error instanceof Anthropic.RateLimitError) throw new StudioError("Лимит Anthropic исчерпан. Повторите правку позднее.", 429);
    throw new StudioError("Anthropic не ответил. Исходная и выбранная версии сохранены. Повторите правку.", 502);
  }
  throw new Error("Unreachable");
}
