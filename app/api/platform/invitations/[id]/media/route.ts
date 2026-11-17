import { platformService } from "@/lib/platform/service";
import { PlatformError } from "@/lib/platform/errors";
import { json, readBody, requireUser, route } from "@/lib/platform/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return route(
    request,
    async () => {
      const user = await requireUser(request);
      const id = (await context.params).id;
      await platformService.getInvitation(user.id, id);
      if (
        !request.headers.get("content-type")?.startsWith("multipart/form-data;")
      )
        throw new PlatformError(
          415,
          "FORM_REQUIRED",
          "Требуется форма с изображением",
        );
      const bytes = await readBody(request, 8 * 1024 * 1024 + 64 * 1024);
      let form: FormData;
      try {
        form = await new Request(request.url, {
          method: "POST",
          headers: { "Content-Type": request.headers.get("content-type")! },
          body: bytes as BodyInit,
        }).formData();
      } catch {
        throw new PlatformError(
          400,
          "INVALID_FORM",
          "Не удалось прочитать изображение",
        );
      }
      const file = form.get("file");
      if (!(file instanceof File))
        throw new PlatformError(400, "FILE_REQUIRED", "Выберите изображение");
      return json(
        {
          media: await platformService.uploadMedia(
            user.id,
            id,
            Buffer.from(await file.arrayBuffer()),
          ),
        },
        201,
      );
    },
    { mutation: true, scope: "media-upload", allowance: 20 },
  );
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
