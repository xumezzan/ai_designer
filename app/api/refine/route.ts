import { projectStore, StudioError } from "@/lib/studio/store";
import { failure, jsonBody, mutationRequest } from "@/lib/studio/http";
import { refineTheme } from "@/lib/ai/refineTheme";
import { checkGenerated } from "@/lib/qa/service";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    mutationRequest(request);
    const { slug, conceptId, fromVersion, instruction, revision, planRevision, generationRevision } = await jsonBody(request);
    if (typeof instruction !== "string" || !instruction.trim() || instruction.length > 2000) throw new StudioError("Опишите правку: от 1 до 2000 символов.");
    if (slug === "demo") throw new StudioError("Создайте свой проект для доработки дизайна.", 403);
    const project = await projectStore.read(slug);
    if (project.revision !== revision || project.planRevision !== planRevision || project.generationRevision !== generationRevision) throw new StudioError("Проект изменился. Обновите страницу перед правкой.", 409);
    if (!project.generation?.concepts.some((concept) => concept.id === conceptId)) throw new StudioError("Выберите вариант из текущей серии.", 404);
    const source = await projectStore.version(slug, conceptId, fromVersion);
    const result = await refineTheme(source, instruction, project);
    const saved = await projectStore.saveRefinement({ slug, conceptId, fromVersion, instruction, revision, planRevision, generationRevision, source, result });
    return Response.json(await checkGenerated(saved, [conceptId]));
  } catch (error) { return failure(error); }
}
