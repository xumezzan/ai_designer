import { platformService } from "@/lib/platform/service";
import { json, requireUser, route } from "@/lib/platform/http";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(request, async () => {
    const user = await requireUser(request);
    return json({
      responses: await platformService.listRsvps(
        user.id,
        (await context.params).id,
      ),
    });
  });
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
