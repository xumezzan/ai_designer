import { projectStore } from "@/lib/studio/store";
import { failure } from "@/lib/studio/http";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; conceptId: string; version: string; file: string }> }) {
  try {
    const { slug, conceptId, version, file } = await params;
    const bytes = await projectStore.qaEvidence(slug, conceptId, version, file);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return failure(error); }
}
