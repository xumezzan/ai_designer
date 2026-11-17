import { describe, expect, it } from "vitest";
import { invitationDraftFromBrief } from "./AiBriefWizard";
import { createEmptyDraft, InvitationDraftSchema } from "@/lib/platform/schema";
import { resolveStudioComposition } from "@/registry/studioTemplates";

const form: Parameters<typeof invitationDraftFromBrief>[0] = {
  eventType: "birthday", purpose: "greeting", headline: "С днём рождения!",
  firstName: " Алина ", secondName: "", day: "", time: "", timezone: "Asia/Tashkent",
  venue: "", address: "", brief: "Тёплый свет, мягкая бумага и воздушная композиция",
};

describe("AI brief facts", () => {
  it("creates a one-recipient greeting without inventing event facts or guest sections", () => {
    const draft = invitationDraftFromBrief(form, "ru");
    expect(InvitationDraftSchema.safeParse(draft).success).toBe(true);
    expect(draft).toMatchObject({ templateId: "editorial", purpose: "greeting", names: ["Алина"], headline: "С днём рождения!", date: { day: "", time: "" }, venue: { name: "", address: "" } });
    expect(draft.enabledSections).toEqual(["opening", "greeting", "story", "closing"]);
  });

  it("retains the persisted composition, type and palette when facts are saved for a retry", () => {
    const existing = { ...createEmptyDraft("modern"), purpose: "greeting" as const,
      composition: resolveStudioComposition("modern"), ornamentSetId: "graphic-ribbon" as const,
      paletteId: "cobalt" as const, fontPairId: "modernist" as const,
    };
    existing.composition.photoShape = "circle";
    const result = invitationDraftFromBrief({ ...form, firstName: "Малика" }, "uz-latn", existing);
    expect(result).toMatchObject({ templateId: "modern", paletteId: "cobalt", fontPairId: "modernist", ornamentSetId: "graphic-ribbon", names: ["Малика"], locale: "uz-latn" });
    expect(result.composition).toEqual(existing.composition);
    expect(existing.names).toEqual(["", ""]);
  });

  it("seeds invitation families by occasion and keeps optional fields empty", () => {
    const corporate = invitationDraftFromBrief({ ...form, purpose: "invitation", eventType: "corporate", headline: "", firstName: "Team Forum" }, "uz-latn");
    expect(corporate.templateId).toBe("corporate");
    expect(corporate.names).toEqual(["Team Forum"]);
    expect(corporate.enabledSections).toContain("rsvp");
    expect(corporate.date.day).toBe("");
    expect(invitationDraftFromBrief({ ...form, purpose: "invitation" }, "ru").templateId).toBe("modern");
  });
});
