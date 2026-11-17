import { describe, expect, it } from "vitest";
import { applyAppearancePatch, restoreBeforeGeneration } from "./InvitationEditor";
import { createEmptyDraft } from "@/lib/platform/schema";
import { resolvePlatformDesignSelection } from "@/lib/platform-render/theme";
import { resolveStudioComposition, studioSelectionCompatibility } from "@/registry/studioTemplates";

const draft = { ...createEmptyDraft("editorial"), composition: resolveStudioComposition("editorial"), ornamentSetId: "botanical-engraving" as const };

describe("editor appearance edits", () => {
  it("retains every composition decision when changing a compatible palette or font", () => {
    const next = applyAppearancePatch(draft, { paletteId: "wine", fontPairId: "poetic" });
    expect(next.composition).toEqual(draft.composition);
    expect(next.ornamentSetId).toBe("botanical-engraving");
    expect(studioSelectionCompatibility(resolvePlatformDesignSelection(next))).toEqual([]);
  });

  it("preserves layout while choosing a readable accent for a sans serif font", () => {
    const next = applyAppearancePatch(draft, { fontPairId: "gallery" });
    expect(next.composition).toEqual({ ...draft.composition, typographyAccent: "uppercase-wide-tracking" });
    expect(studioSelectionCompatibility(resolvePlatformDesignSelection(next))).toEqual([]);
  });

  it("switches incompatible paper artwork to native rules on dark paper", () => {
    const next = applyAppearancePatch({ ...draft, ornamentSetId: "chinese-garden" }, { paletteId: "ink" });
    expect(next.ornamentSetId).toBe("editorial-rules");
    expect(next.composition).toEqual(draft.composition);
    expect(studioSelectionCompatibility(resolvePlatformDesignSelection(next))).toEqual([]);
  });
});


describe("quick design undo", () => {
  it("restores the old appearance while preserving facts, purpose and copy edited after generation", () => {
    const before = { ...createEmptyDraft("classic"), names: ["Азиз", "Малика"], greeting: "Старый текст" };
    const current = { ...draft, purpose: "greeting" as const, eventType: "birthday" as const,
      names: ["Алина"], title: "Для Алины", headline: "С днём рождения!", greeting: "Новые личные слова",
      story: "История, которую дописали после генерации", closing: "С теплом", enabledSections: ["opening", "greeting", "story", "closing"] as (typeof draft.enabledSections)[number][],
      date: { ...draft.date, day: "2027-08-11" }, venue: { name: "Новое место", address: "Новый адрес" },
    };
    const restored = restoreBeforeGeneration(current, before);
    expect(restored).toMatchObject({ templateId: "classic", paletteId: before.paletteId, fontPairId: before.fontPairId,
      purpose: "greeting", eventType: "birthday", names: ["Алина"], title: "Для Алины", headline: "С днём рождения!",
      greeting: "Новые личные слова", story: current.story, closing: "С теплом", date: current.date, venue: current.venue,
    });
    expect(restored.enabledSections).toEqual(current.enabledSections);
    expect(restored.composition).toBeUndefined();
    expect(current.composition).toEqual(draft.composition);
  });
});
