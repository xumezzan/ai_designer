import sharp from "sharp";
import { projectStore, StudioError } from "@/lib/studio/store";
import { mutationRequest, jsonBody, failure } from "@/lib/studio/http";
import { readDirectedPhotos } from "@/lib/assets/read";
import { generateSeries } from "@/lib/ai/generateSeries";

export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    mutationRequest(request);
    const { slug, revision, planRevision, generationRevision } = await jsonBody(request);
    if (slug === "demo") throw new StudioError("Создайте свой проект для генерации вариантов.", 403);
    const project = await projectStore.read(slug);
    if (project.revision !== revision || project.planRevision !== planRevision || project.generationRevision !== generationRevision) throw new StudioError("Проект изменился. Обновите страницу перед генерацией.", 409);
    if (!project.content.brief?.trim()) throw new StudioError("Опишите желаемый стиль в поле «Пожелания к дизайну».");
    if (!project.visionConfigured) throw new StudioError("Добавьте ANTHROPIC_API_KEY в .env.local и перезапустите сервер.", 503);
    const photos = await readDirectedPhotos(project.content, project.assetPlan);
    const references = await Promise.all(project.content.refs.map(async (src) => {
      const filename = src.split("/").at(-1)!;
      const input = await projectStore.media(slug, filename);
      const data = await sharp(input).resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true }).flatten({ background: "#f3f0e9" }).jpeg({ quality: 80 }).toBuffer();
      return { base64: data.toString("base64") };
    }));
    const result = await generateSeries(project.content, photos, references);
    const saved = await projectStore.saveGeneration(slug, result, revision, planRevision, generationRevision);
    return Response.json(saved);
  } catch (error) { return failure(error); }
}
