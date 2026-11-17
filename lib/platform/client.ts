export class PlatformRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function platformRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/platform${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PlatformRequestError(
      result?.error?.message ||
        "Не удалось выполнить запрос. Повторите действие.",
      response.status,
      result?.error?.code,
    );
  }
  return result as T;
}
