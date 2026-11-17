import { z } from "zod";
import { platformService } from "@/lib/platform/service";
import { InvitationDraftSchema } from "@/lib/platform/schema";
import { json, readJson, requireUser, route } from "@/lib/platform/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return route(request, async () => {
    const user = await requireUser(request);
    return json({
      invitation: await platformService.getInvitation(
        user.id,
        (await context.params).id,
      ),
    });
  });
}
export async function PATCH(request: Request, context: Context) {
  return route(
    request,
    async () => {
      const user = await requireUser(request);
      const { draft, expectedUpdatedAt } = z
        .object({
          draft: InvitationDraftSchema,
          expectedUpdatedAt: z.string().datetime().optional(),
        })
        .strict()
        .parse(await readJson(request));
      return json({
        invitation: await platformService.updateInvitation(
          user.id,
          (await context.params).id,
          draft,
          expectedUpdatedAt,
        ),
      });
    },
    { mutation: true, scope: "invitation-write" },
  );
}
export async function DELETE(request: Request, context: Context) {
  return route(
    request,
    async () => {
      const user = await requireUser(request);
      await platformService.deleteInvitation(
        user.id,
        (await context.params).id,
      );
      return json({ ok: true });
    },
    { mutation: true, scope: "invitation-write" },
  );
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
