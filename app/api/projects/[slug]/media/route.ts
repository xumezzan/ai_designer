import { projectStore, StudioError } from "@/lib/studio/store";
import { failure, jsonBody, mutationRequest } from "@/lib/studio/http";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    mutationRequest(request);
    const { slug } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new StudioError("Выберите изображение для загрузки.");
    return Response.json(await projectStore.upload(slug, String(form.get("revision")), String(form.get("kind")), file));
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    mutationRequest(request);
    const { slug } = await params;
    const { revision, src } = await jsonBody(request);
    return Response.json(await projectStore.removeMedia(slug, revision, src));
  } catch (error) { return failure(error); }
}
