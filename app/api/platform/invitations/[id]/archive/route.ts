import { z } from "zod";
import { platformService } from "@/lib/platform/service";
import { json, readJson, requireUser, route } from "@/lib/platform/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(
    request,
    async () => {
      const user = await requireUser(request);
      const data = request.headers
        .get("content-type")
        ?.includes("application/json")
        ? await readJson(request)
        : {};
      const { expectedUpdatedAt } = z
        .object({ expectedUpdatedAt: z.string().datetime().optional() })
        .strict()
        .parse(data);
      return json({
        invitation: await platformService.archiveInvitation(
          user.id,
          (await context.params).id,
          expectedUpdatedAt,
        ),
      });
    },
    { mutation: true, scope: "invitation-write" },
  );
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
