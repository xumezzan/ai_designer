/** Legacy studio records have no customer ownership. Keep the operator tool
 * available locally; never expose it as a tenant feature in a hosted build. */
export function legacyOperatorRoute(path: string): boolean {
  if (path === "/studio" || path.startsWith("/studio/")) return true;
  if (path.startsWith("/preview/") && !path.startsWith("/preview/demo/"))
    return true;
  if (path.startsWith("/art/") && !path.startsWith("/art/demo/")) return true;
  return [
    "/api/projects",
    "/api/generate",
    "/api/refine",
    "/api/approve",
    "/api/restore",
    "/api/plan-assets",
    "/api/qa",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Optimizer caches cannot revoke photographs immediately after unpublishing. */
export function privateImageSource(source: string): boolean {
  try {
    const pathname = new URL(source, "http://local.invalid").pathname;
    return ["/api/platform/media/", "/api/projects/", "/art/"].some((prefix) =>
      pathname.startsWith(prefix),
    );
  } catch {
    return true;
  }
}
