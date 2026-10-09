import { projectStore } from "@/lib/studio/store";
import { failure, jsonBody, mutationRequest } from "@/lib/studio/http";

export const runtime = "nodejs";
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    mutationRequest(request);
    const { slug } = await params;
    const { assetPlan, revision, planRevision } = await jsonBody(request);
    return Response.json(await projectStore.updatePlan(slug, assetPlan, revision, planRevision));
  } catch (error) { return failure(error); }
}
