import { json, readJson, requireUser, route } from "@/lib/platform/http";
import { DesignHistoryInputSchema } from "@/lib/platform-design/schema";
import { platformDesignService } from "@/lib/platform-design/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return route(request, async () => {
    const user = await requireUser(request);
    const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
    return json(await platformDesignService.list(user.id, (await context.params).id, cursor));
  });
}

export async function POST(request: Request, context: Context) {
  return route(request, async () => {
    const user = await requireUser(request);
    const input = DesignHistoryInputSchema.parse(await readJson(request));
    const invitationId = (await context.params).id;
    const invitation = input.action === "save"
      ? await platformDesignService.save(user.id, invitationId, input)
      : await platformDesignService.restore(user.id, invitationId, input);
    return json({ invitation });
  }, { mutation: true, scope: "invitation-design", allowance: 40 });
}
