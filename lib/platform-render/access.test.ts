import { describe, expect, it } from "vitest";
import { legacyOperatorRoute, privateImageSource } from "./access";

describe("legacy operator boundary", () => {
  it("blocks legacy project details, files, generation and non-demo previews", () => {
    for (const route of [
      "/studio",
      "/studio/private",
      "/api/projects",
      "/api/projects/customer/media/private.jpg",
      "/api/projects/customer/qa/a/1/page.png",
      "/api/generate",
      "/api/approve",
      "/preview/customer/a/1",
      "/art/customer/asset.webp",
    ])
      expect(legacyOperatorRoute(route), route).toBe(true);
  });
  it("preserves demos, public snapshots and owner-checked platform APIs", () => {
    for (const route of [
      "/",
      "/dashboard",
      "/templates",
      "/preview/demo/a/1",
      "/art/demo/asset.webp",
      "/api/platform/invitations",
      "/i/invite-123",
    ])
      expect(legacyOperatorRoute(route), route).toBe(false);
  });
  it("prevents optimizer caching of revocable customer media", () => {
    expect(privateImageSource("/api/platform/media/id")).toBe(true);
    expect(
      privateImageSource(
        "http://localhost/api/projects/private/media/photo.webp",
      ),
    ).toBe(true);
    expect(privateImageSource("/art/private/art.webp")).toBe(true);
    expect(privateImageSource("/artwork/suzani-atelier/hero-v1.webp")).toBe(
      false,
    );
  });
});
