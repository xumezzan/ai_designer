import { platformService } from "@/lib/platform/service";
import { PlatformError } from "@/lib/platform/errors";
import { json, route } from "@/lib/platform/http";
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return route(request, async () => {
    const invitation = await platformService.getPublicInvitation(
      (await context.params).slug,
    );
    if (!invitation)
      throw new PlatformError(
        404,
        "INVITATION_NOT_FOUND",
        "Приглашение не найдено",
      );
    return json({ invitation });
  });
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
