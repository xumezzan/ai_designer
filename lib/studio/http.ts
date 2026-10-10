import { StudioError } from "./store";

export function mutationRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let sameHost = false;
    try {
      const source = new URL(origin);
      sameHost = ["http:", "https:"].includes(source.protocol) && source.host === (request.headers.get("host") ?? new URL(request.url).host);
    } catch { /* Opaque or malformed origins are rejected. */ }
    if (!sameHost) throw new StudioError("Откройте студию с того же адреса и повторите действие.", 403);
  }
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > 16 * 1024 * 1024) throw new StudioError("Файл слишком большой. Максимум — 15 МБ.", 413);
}
export async function jsonBody(request: Request) {
  const text = await request.text();
  if (text.length > 160000) throw new StudioError("Анкета слишком большая.", 413);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object");
    return value;
  } catch { throw new StudioError("Не удалось прочитать анкету. Обновите страницу и повторите."); }
}
export function failure(error: unknown) {
  if (error instanceof StudioError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Studio storage error", error);
  return Response.json({ error: "Не удалось прочитать или сохранить файлы проекта. Проверьте доступ к папке projects и повторите." }, { status: 500 });
}
