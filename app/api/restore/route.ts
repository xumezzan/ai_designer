import { projectStore } from "@/lib/studio/store";
import { failure, jsonBody, mutationRequest } from "@/lib/studio/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    mutationRequest(request);
    const { slug, conceptId, version, revision, planRevision, generationRevision } = await jsonBody(request);
    return Response.json(await projectStore.restoreVersion(slug, conceptId, version, revision, planRevision, generationRevision));
  } catch (error) { return failure(error); }
}
