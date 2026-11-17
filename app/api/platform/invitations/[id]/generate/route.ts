import { z } from "zod";
import { json, readJson, requireUser, route } from "@/lib/platform/http";
import { platformAiService } from "@/lib/platform-ai/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return route(request, async () => {
    const user = await requireUser(request);
    const result = await platformAiService.generate(user.id, (await context.params).id, await readJson(request));
    return json(result, result.job.status === "running" ? 202 : 200);
  }, { mutation: true, scope: "invitation-ai", allowance: 12 });
}

export async function GET(request: Request, context: Context) {
  return route(request, async () => {
    const user = await requireUser(request);
    const query = new URL(request.url).searchParams;
    if (query.get("latest") === "1" && !query.has("requestId")) {
      return json({ generation: await platformAiService.getLatestGeneration(user.id, (await context.params).id) });
    }
    const requestId = z.string().uuid().parse(query.get("requestId"));
    return json(await platformAiService.getGeneration(user.id, (await context.params).id, requestId));
  });
}
