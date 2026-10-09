import { projectStore } from "@/lib/studio/store";
import { failure } from "@/lib/studio/http";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; filename: string }> }) {
  try {
    const { slug, filename } = await params;
    const bytes = await projectStore.media(slug, filename);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return failure(error); }
}
