import { platformService } from "@/lib/platform/service";
import { readJson, route, withSession } from "@/lib/platform/http";
export async function POST(request: Request) {
  return route(
    request,
    async () => {
      const { user, sessionToken } = await platformService.auth.register(
        await readJson(request),
      );
      return withSession(user, sessionToken);
    },
    { mutation: true, scope: "register", allowance: 10 },
  );
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
