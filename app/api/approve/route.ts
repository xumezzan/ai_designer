import { projectStore } from "@/lib/studio/store";
import { failure, jsonBody, mutationRequest } from "@/lib/studio/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    mutationRequest(request);
    const { slug, conceptId, version, revision, planRevision, generationRevision, approvalRevision } = await jsonBody(request);
    return Response.json(await projectStore.approveVersion(slug, conceptId, version, revision, planRevision, generationRevision, approvalRevision));
  } catch (error) { return failure(error); }
}
