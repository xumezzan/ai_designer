import Anthropic from "@anthropic-ai/sdk";
import { AssetPlan, type AssetPlan as Plan } from "@/lib/schema/assetPlan";
import { SECTION_IDS } from "@/registry/keys";
import { StudioError } from "@/lib/studio/store";
import { heroGrade, type ImageInfo } from "@/lib/assets/crop";
import { assetDirectorPrompt } from "./prompts/planAssets";

export type VisionPhoto = ImageInfo & { id: string; base64: string };
export function assetTool(ids: string[]): Anthropic.Messages.Tool {
  const unit = { type: "number", minimum: 0, maximum: 1 };
  return {
    name: "emit_asset_plan", description: "Return photographic art direction for every supplied photo id. Preserve all important subjects, report visual quality, choose safe crops and placements, and select one unified treatment. Never invent ids or event facts.",
    input_schema: {
      type: "object", required: ["assets", "unifiedTreatment"], additionalProperties: false,
      properties: {
        unifiedTreatment: { type: "string", enum: ["warm-film", "desaturate", "bw", "none"] },
        assets: { type: "array", minItems: ids.length, maxItems: ids.length, items: {
          type: "object", additionalProperties: false,
          required: ["id", "role", "subject", "focal", "safeArea", "allowedRatios", "treatment", "quality", "issues", "maxViewportShare", "placement"],
          properties: {
            id: { type: "string", enum: ids },
            role: { type: "string", enum: ["hero", "portrait", "story", "gallery", "backdrop", "unused"] },
            subject: { type: "string", enum: ["couple", "person", "group", "venue", "detail", "landscape"] },
            focal: { type: "array", items: unit, minItems: 2, maxItems: 2 },
            safeArea: { type: "object", required: ["x", "y", "w", "h"], additionalProperties: false, properties: { x: unit, y: unit, w: { ...unit, exclusiveMinimum: 0 }, h: { ...unit, exclusiveMinimum: 0 } } },
            allowedRatios: { type: "array", minItems: 1, items: { type: "string", enum: ["3:4", "4:5", "1:1", "3:2", "16:9"] } },
            treatment: { type: "string", enum: ["none", "warm-film", "duotone", "desaturate", "bw"] },
            quality: { type: "string", enum: ["high", "usable", "low"] },
            issues: { type: "array", items: { type: "string", enum: ["soft-focus", "low-res", "harsh-flash", "mixed-white-balance", "busy-background", "watermark", "cluttered-edges"] } },
            maxViewportShare: { type: "number", minimum: .15, maximum: 1 },
            placement: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["section", "index"], properties: { section: { type: "string", enum: SECTION_IDS }, index: { type: "integer", minimum: 0, maximum: 40 } } }] },
            note: { type: "string", maxLength: 1000 },
          },
        } },
      },
    },
  };
}
function parsePlan(raw: unknown, photos: VisionPhoto[]): Plan {
  const plan = AssetPlan.parse(raw);
  if (plan.assets.length !== photos.length || plan.assets.some((asset) => !photos.some((photo) => photo.id === asset.id))) throw new Error("Return every assigned id exactly once");
  for (const asset of plan.assets) {
    const source = photos.find((photo) => photo.id === asset.id)!;
    if ((asset.role === "hero" || asset.placement?.section === "hero") && !heroGrade(source)) throw new Error("Source resolution cannot be a hero");
  }
  if (plan.assets.filter((asset) => asset.placement?.section === "hero").length > 1) throw new Error("Only one hero per batch");
  return plan;
}
async function analyzeBatch(photos: VisionPhoto[], client: Anthropic) {
  const content: Anthropic.Messages.ContentBlockParam[] = photos.flatMap((photo) => [
    { type: "text" as const, text: `Photo id: ${photo.id}. Original normalized dimensions: ${photo.width}x${photo.height}.` },
    { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: photo.base64 } },
  ]);
  let correction = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await client.messages.create({ model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6", max_tokens: 8192, system: assetDirectorPrompt,
      tools: [assetTool(photos.map((photo) => photo.id))], tool_choice: { type: "tool", name: "emit_asset_plan" },
      messages: [{ role: "user", content: [...content, { type: "text", text: `Analyze these photos and emit one complete plan.${correction}` }] }],
    });
    const blocks = message.content.filter((block) => block.type === "tool_use" && block.name === "emit_asset_plan");
    try {
      if (blocks.length !== 1 || blocks[0].type !== "tool_use" || message.stop_reason === "max_tokens") throw new Error("Emit one complete emit_asset_plan tool call");
      return parsePlan(blocks[0].input, photos);
    } catch (error) {
      if (attempt === 1) throw new StudioError("Модель дважды вернула некорректные настройки фото. Повторите анализ или настройте вручную.", 502);
      correction = ` Previous response was invalid: ${(error as Error).message.slice(0, 1500)}. Correct these issues.`;
    }
  }
  throw new Error("Unreachable");
}
export async function planAssets(photos: VisionPhoto[], client?: Anthropic): Promise<Plan> {
  if (!photos.length) throw new StudioError("Загрузите хотя бы одну фотографию.");
  if (!client && !process.env.ANTHROPIC_API_KEY) throw new StudioError("Автоанализ не настроен. Добавьте ANTHROPIC_API_KEY в .env.local и перезапустите сервер. Ручные настройки доступны.", 503);
  const sdk = client ?? new Anthropic({ timeout: 60000, maxRetries: 0 });
  const batches = Array.from({ length: Math.ceil(photos.length / 8) }, (_, index) => photos.slice(index * 8, (index + 1) * 8));
  const plans: Plan[] = [];
  try {
    for (let offset = 0; offset < batches.length; offset += 3) {
      const results = await Promise.all(batches.slice(offset, offset + 3).map((batch) => analyzeBatch(batch, sdk)));
      plans.push(...results);
    }
  } catch (error) {
    if (error instanceof StudioError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new StudioError("Ключ Anthropic отклонён. Проверьте ANTHROPIC_API_KEY и перезапустите сервер.", 502);
    if (error instanceof Anthropic.RateLimitError) throw new StudioError("Лимит запросов Anthropic исчерпан. Повторите анализ позднее.", 429);
    throw new StudioError("Сервис анализа фотографий не ответил. Повторите запрос или настройте фото вручную.", 502);
  }
  const assets = plans.flatMap((plan) => plan.assets).map((asset, index) => ({ ...asset, placement: asset.placement ? { ...asset.placement, index } : null }));
  // Keep one hero across batches; other high-quality shots become greeting portraits.
  let hero = false;
  for (const asset of assets) {
    if (asset.placement?.section === "hero") {
      if (hero) { asset.role = "portrait"; asset.placement.section = "greeting"; }
      hero = true;
    }
    if (asset.quality === "low") asset.maxViewportShare = Math.min(asset.maxViewportShare, .35);
  }
  return AssetPlan.parse({ assets, unifiedTreatment: plans[0].unifiedTreatment });
}
