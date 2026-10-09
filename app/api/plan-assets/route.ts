import path from "node:path";
import sharp from "sharp";
import { projectStore, StudioError } from "@/lib/studio/store";
import { failure, jsonBody, mutationRequest } from "@/lib/studio/http";
import { planAssets } from "@/lib/ai/planAssets";
import { photoFilename } from "@/lib/assets/read";

export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    mutationRequest(request);
    const { slug, revision, planRevision } = await jsonBody(request);
    if (slug === "demo") throw new StudioError("Демо доступно только для просмотра.", 403);
    const project = await projectStore.read(slug);
    if (project.revision !== revision || project.planRevision !== planRevision) throw new StudioError("Проект изменился. Обновите страницу перед анализом.", 409);
    if (!process.env.ANTHROPIC_API_KEY) throw new StudioError("Автоанализ не настроен. Добавьте ANTHROPIC_API_KEY в .env.local и перезапустите сервер. Ручные настройки доступны.", 503);
    const photos = [];
    for (const media of project.content.media) {
      const filename = photoFilename(slug, media.src);
      const bytes = await sharp(path.join(process.cwd(), "projects", slug, "media", filename)).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).flatten({ background: "#f3f0e9" }).jpeg({ quality: 85 }).toBuffer();
      photos.push({ id: media.id, ...project.mediaInfo[media.id], base64: bytes.toString("base64") });
    }
    const assetPlan = await planAssets(photos);
    const current = await projectStore.read(slug);
    if (current.revision !== revision || current.planRevision !== planRevision) throw new StudioError("Проект изменился во время анализа. Обновите страницу и повторите.", 409);
    return Response.json({ assetPlan });
  } catch (error) { return failure(error); }
}
