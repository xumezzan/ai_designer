import { describe, expect, it } from "vitest";
import { StudioSelection } from "@/lib/schema/studioTemplate";
import { validateTheme } from "@/lib/theme/validate";
import { getMoodProfile, moodProfiles, resolveMoodProfile } from "./moodProfiles";
import { studioSelectionCompatibility, studioTemplateCatalog, studioTemplateTheme } from "./studioTemplates";

describe("curated mood profiles", () => {
  it("gives each profile a distinct identity and an unambiguous design recipe", () => {
    expect(moodProfiles.length).toBeGreaterThanOrEqual(8);
    expect(moodProfiles.length).toBeLessThanOrEqual(12);
    expect(new Set(moodProfiles.map(({ id }) => id)).size).toBe(moodProfiles.length);
    expect(new Set(moodProfiles.map(({ className }) => className)).size).toBe(moodProfiles.length);
    for (const profile of moodProfiles) {
      expect(getMoodProfile(profile.id)).toBe(profile);
      expect(resolveMoodProfile(profile.selection)).toBe(profile);
    }
    expect(getMoodProfile("unknown")).toBeUndefined();
    expect(resolveMoodProfile({})).toBeUndefined();
  });

  it.each(moodProfiles)("compiles $name for Russian and Uzbek Latin", (profile) => {
    const selection = StudioSelection.parse(profile.selection);
    expect(studioSelectionCompatibility(selection)).toEqual([]);
    const theme = studioTemplateTheme(selection);
    for (const locale of ["ru", "uz-latn"] as const) {
      expect(profile.description[locale].trim()).not.toBe("");
      expect(validateTheme(theme, { locale })).toMatchObject({ ok: true });
    }
    expect(theme.studioTemplate?.composition).toEqual(profile.selection.composition);
  });

  it("makes the same approved selections available to the model", () => {
    expect(studioTemplateCatalog().moodProfiles.map(({ id, selection }) => ({ id, selection })))
      .toEqual(moodProfiles.map(({ id, selection }) => ({ id, selection })));
  });
});
