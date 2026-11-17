import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PlatformError } from "./errors";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, hashToken } from "./auth";
import { platformService } from "./service";

export function sessionToken(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
export async function requireUser(request: Request) {
  const user = await platformService.auth.userForSession(sessionToken(request));
  if (!user)
    throw new PlatformError(401, "UNAUTHENTICATED", "Войдите в аккаунт");
  return user;
}
export function assertSameOrigin(request: Request) {
  const reject = () => {
    throw new PlatformError(
      403,
      "INVALID_ORIGIN",
      "Запрос должен выполняться с этого сайта",
    );
  };
  const origin = request.headers.get("origin");
  if (!origin || origin === "null" || request.headers.get("sec-fetch-site") === "cross-site") reject();
  try {
    const internal = new URL(request.url);
    // Next can normalize request.url to localhost even when the browser used
    // 127.0.0.1. Host carries the actual HTTP authority; forwarded host does not.
    const destination = new URL(`${internal.protocol}//${request.headers.get("host") || internal.host}`);
    const source = new URL(origin!);
    if (!["http:", "https:"].includes(source.protocol) || source.username || source.password || source.pathname !== "/" || source.search || source.hash
      || destination.username || destination.password || destination.pathname !== "/" || destination.search || destination.hash
      || source.origin !== destination.origin) reject();
  } catch { reject(); }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function withSession(user: unknown, token: string) {
  const response = json({ user });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
export function clearSession() {
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function readBody(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes)
    throw new PlatformError(
      413,
      "BODY_TOO_LARGE",
      "Размер запроса превышает лимит",
    );
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) {
        await reader.cancel();
        throw new PlatformError(
          413,
          "BODY_TOO_LARGE",
          "Размер запроса превышает лимит",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function readJson(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new PlatformError(415, "JSON_REQUIRED", "Требуется JSON");
  const body = await readBody(request);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new PlatformError(400, "INVALID_JSON", "Некорректный JSON");
  }
}

const rateBuckets = new Map<string, { count: number; reset: number }>();
function limit(request: Request, scope: string, allowance: number) {
  const now = Date.now();
  // Upstream deployment must sanitize forwarded headers. This local guard is
  // deliberately complemented by persistent per-email login throttling.
  const address =
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "local";
  // Do not key this by a caller-supplied cookie: rotating fake cookies must not
  // reset the anonymous request allowance.
  const key = hashToken(`${scope}:${address}`);
  if (rateBuckets.size > 5000)
    for (const [key, bucket] of rateBuckets)
      if (bucket.reset < now) rateBuckets.delete(key);
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.reset < now) {
    if (rateBuckets.size >= 10000 && !bucket)
      throw new PlatformError(
        429,
        "RATE_LIMITED",
        "Слишком много запросов. Повторите через минуту",
      );
    bucket = { count: 0, reset: now + 60_000 };
    rateBuckets.set(key, bucket);
  }
  if (++bucket.count > allowance)
    throw new PlatformError(
      429,
      "RATE_LIMITED",
      "Слишком много запросов. Повторите через минуту",
    );
}
export async function route(
  request: Request,
  handler: () => Promise<Response>,
  options: { mutation?: boolean; scope?: string; allowance?: number } = {},
) {
  try {
    if (options.mutation) assertSameOrigin(request);
    if (options.scope) limit(request, options.scope, options.allowance || 60);
    return await handler();
  } catch (error) {
    if (error instanceof PlatformError)
      return json(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    if (error instanceof ZodError)
      return json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Проверьте поля формы",
            fields: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        400,
      );
    // Never send exception messages, local paths, session hashes or request bodies.
    console.error(
      "Platform request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Не удалось выполнить запрос. Попробуйте позднее",
        },
      },
      500,
    );
  }
}
