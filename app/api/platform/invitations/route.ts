import { z } from "zod";
import { platformService } from "@/lib/platform/service";
import { InvitationDraftSchema } from "@/lib/platform/schema";
import { json, readJson, requireUser, route } from "@/lib/platform/http";
export async function GET(request: Request) {
  return route(request, async () => {
    const user = await requireUser(request);
    return json({
      invitations: await platformService.listInvitations(user.id),
    });
  });
}
export async function POST(request: Request) {
  return route(
    request,
    async () => {
      const user = await requireUser(request);
      const { draft } = z
        .object({ draft: InvitationDraftSchema })
        .strict()
        .parse(await readJson(request));
      return json(
        { invitation: await platformService.createInvitation(user.id, draft) },
        201,
      );
    },
    { mutation: true, scope: "invitation-write" },
  );
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
