import { projectStore } from "@/lib/studio/store";
import { failure, jsonBody, mutationRequest } from "@/lib/studio/http";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { return Response.json(await projectStore.read((await params).slug), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return failure(error); }
}
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    mutationRequest(request);
    const { slug } = await params;
    const { content, revision } = await jsonBody(request);
    return Response.json(await projectStore.update(slug, content, revision));
  } catch (error) { return failure(error); }
}
