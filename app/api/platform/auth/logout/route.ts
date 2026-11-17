import { platformService } from "@/lib/platform/service";
import { clearSession, route, sessionToken } from "@/lib/platform/http";
export async function POST(request: Request) {
  return route(
    request,
    async () => {
      await platformService.auth.logout(sessionToken(request));
      return clearSession();
    },
    { mutation: true },
  );
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
