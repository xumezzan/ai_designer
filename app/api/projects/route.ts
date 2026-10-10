import { projectStore } from "@/lib/studio/store";
import { failure, jsonBody, mutationRequest } from "@/lib/studio/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    mutationRequest(request);
    const content = await jsonBody(request);
    return Response.json(await projectStore.create(content), { status: 201 });
  } catch (error) { return failure(error); }
}
