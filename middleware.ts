import { NextResponse, type NextRequest } from "next/server";
import {
  legacyOperatorRoute,
  privateImageSource,
} from "@/lib/platform-render/access";

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/_next/image" &&
    privateImageSource(request.nextUrl.searchParams.get("url") || "")
  ) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (
    process.env.NODE_ENV === "production" &&
    legacyOperatorRoute(request.nextUrl.pathname)
  ) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (
    request.nextUrl.pathname.startsWith("/i/") ||
    request.nextUrl.pathname.startsWith("/dashboard")
  )
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/studio/:path*",
    "/preview/:path*",
    "/art/:path*",
    "/api/:path*",
    "/i/:path*",
    "/dashboard/:path*",
    "/_next/image",
  ],
};
