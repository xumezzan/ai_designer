import { platformService } from "@/lib/platform/service";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PlatformError } from "@/lib/platform/errors";
import { json, readBody, readJson, route } from "@/lib/platform/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return route(
    request,
    async () => {
      const slug = (await context.params).slug;
      const nativeForm =
        request.headers.get("content-type")?.split(";")[0] ===
        "application/x-www-form-urlencoded";
      if (!nativeForm)
        return json(
          await platformService.submitRsvp(slug, await readJson(request)),
        );
      const redirect = (outcome: "saved" | "error") => {
        const target = new URL(`/i/${encodeURIComponent(slug)}`, request.url);
        target.searchParams.set("rsvp", outcome);
        const response = NextResponse.redirect(target, 303);
        response.headers.set("Cache-Control", "no-store");
        return response;
      };
      try {
        const fields = new URLSearchParams(
          new TextDecoder().decode(await readBody(request, 16 * 1024)),
        );
        const input = Object.fromEntries(fields.entries());
        await platformService.submitRsvp(slug, {
          ...input,
          guestCount:
            input.status === "yes" ? Number(input.guestCount || 1) : 1,
          email: input.email || undefined,
          message: input.message || undefined,
          editToken: input.editToken || undefined,
        });
        return redirect("saved");
      } catch (error) {
        if (error instanceof PlatformError || error instanceof ZodError)
          return redirect("error");
        throw error;
      }
    },
    { mutation: true, scope: "rsvp", allowance: 30 },
  );
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
