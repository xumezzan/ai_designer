import { platformService } from "@/lib/platform/service";
import { json, route, sessionToken } from "@/lib/platform/http";
export async function GET(request: Request) {
  return route(request, async () =>
    json({
      user: await platformService.auth.userForSession(sessionToken(request)),
    }),
  );
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
