import { platformService } from "@/lib/platform/service";
import { route, sessionToken } from "@/lib/platform/http";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(request, async () => {
    const user = await platformService.auth.userForSession(
      sessionToken(request),
    );
    const buffer = await platformService.getMedia(
      (await context.params).id,
      user?.id,
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  });
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
