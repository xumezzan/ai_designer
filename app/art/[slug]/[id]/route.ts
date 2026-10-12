import { readGeneratedVisual } from "@/lib/artwork/generated";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  try {
    const visual = await readGeneratedVisual(slug, id);
    if (!visual) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(visual.data), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", ETag: `"${visual.record.sha256}"` } });
  } catch { return new Response("Artwork unavailable", { status: 500 }); }
}
