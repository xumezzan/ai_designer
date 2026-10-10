import { failure, jsonBody, mutationRequest } from "@/lib/studio/http";
import { checkVersion } from "@/lib/qa/service";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    mutationRequest(request);
    const { slug, conceptId, version, revision, planRevision, generationRevision } = await jsonBody(request);
    return Response.json(await checkVersion({ slug, conceptId, version, revision, planRevision, generationRevision }));
  } catch (error) { return failure(error); }
}
