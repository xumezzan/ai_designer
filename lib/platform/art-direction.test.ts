import { describe, expect, it } from "vitest";
import { MaterialArtDirectionSchema } from "./art-direction";
import { createEmptyDraft, InvitationDraftSchema, publicSnapshotContent } from "./schema";
import { ArtDirectionSchema } from "@/lib/platform-ai/schema";
import { applyInvitationDesign, invitationDesign } from "@/lib/platform-design/schema";
import { resolveStudioComposition } from "@/registry/studioTemplates";

const concept = { title: "  Лунный сад  ", scene: "night-garden", layout: "immersive" } as const;
const artwork = { id: "019ca999-9999-7999-8999-999999999999", src: "/api/platform/media/019ca999-9999-7999-8999-999999999999" };
const nativePlan = { templateId: "editorial", paletteId: "ivory", fontPairId: "editorial", ornamentSetId: "editorial-rules", composition: resolveStudioComposition("editorial"), summary: "Шёлк, редакционная композиция и мягкий свет" } as const;

describe("bounded material art direction", () => {
  it("keeps old drafts valid and accepts unfinished concepts without pretending to have artwork", () => {
    expect(InvitationDraftSchema.parse(createEmptyDraft())).not.toHaveProperty("artDirection");
    const draft = InvitationDraftSchema.parse({ ...createEmptyDraft("editorial"), artDirection: concept });
    expect(draft.artDirection).toEqual({ ...concept, title: "Лунный сад" });
    expect(draft.artwork).toBeUndefined();
  });

  it("rejects unsupported scenes, layouts, long titles and injected URLs or event facts", () => {
    for (const patch of [{ scene: "custom" }, { layout: "free-css" }, { title: "a".repeat(101) }, { artwork: "https://example.test/image.png" }, { names: ["Injected"] }]) {
      expect(MaterialArtDirectionSchema.safeParse({ ...concept, ...patch }).success).toBe(false);
    }
  });

  it("requires a new material plan to request actual artwork while legacy native plans remain readable", () => {
    expect(ArtDirectionSchema.safeParse(nativePlan).success).toBe(true);
    expect(ArtDirectionSchema.safeParse({ ...nativePlan, artDirection: concept }).success).toBe(false);
    expect(ArtDirectionSchema.safeParse({ ...nativePlan, artDirection: concept, artworkPrompt: "Original layered moonlit foliage with a quiet central reading field." }).success).toBe(true);
  });

  it("publishes material media for a greeting while keeping hidden event facts absent", () => {
    const content = publicSnapshotContent({ ...createEmptyDraft("editorial"), purpose: "greeting", artDirection: { ...concept, title: "Лунный сад" }, artwork, artworkWide: artwork,
      date: { day: "2027-07-01", time: "17:00", timezone: "Asia/Tashkent", showCountdown: true }, venue: { name: "Private place", address: "Private address" }, timeline: [{ time: "17:00", title: "Private programme" }],
    });
    expect(content).toMatchObject({ artDirection: { ...concept, title: "Лунный сад" }, artwork, artworkWide: artwork, date: { day: "", time: "", showCountdown: false }, venue: { name: "", address: "" }, timeline: [] });
    expect(content.enabledSections).not.toContain("rsvp");
  });

  it("restores scene and its artwork together without changing current purpose, headline or copy; old versions clear it", () => {
    const previous = { ...createEmptyDraft("editorial"), artDirection: { ...concept, title: "Лунный сад" }, artwork };
    const current = { ...createEmptyDraft("modern"), purpose: "greeting" as const, headline: "С днём рождения!", names: ["Амира"], greeting: "Текущие пожелания", story: "Личная история" };
    const restored = applyInvitationDesign(current, invitationDesign(previous));
    expect(restored).toMatchObject({ templateId: "editorial", artDirection: previous.artDirection, artwork, purpose: "greeting", headline: current.headline, names: current.names, greeting: current.greeting, story: current.story });
    const legacy = applyInvitationDesign(restored, invitationDesign(createEmptyDraft("classic")));
    expect(legacy).not.toHaveProperty("artDirection");
    expect(legacy).not.toHaveProperty("artwork");
    expect(legacy.purpose).toBe("greeting");
  });
});
