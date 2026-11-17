import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvitationCanvas } from "@/components/platform/InvitationCanvas";
import { PublicRsvp } from "@/components/platform/PublicRsvp";
import { createEmptyDraft, InvitationDraftSchema } from "@/lib/platform/schema";
import { createPlatformDemo } from "./demo";

describe("Heritage customer builder integration", () => {
  it("creates an empty owned-data draft with the reference's default palette and script", () => {
    const draft = createEmptyDraft("heritage");
    expect(InvitationDraftSchema.safeParse(draft).success).toBe(true);
    expect(draft).toMatchObject({
      templateId: "heritage",
      paletteId: "cinnabar",
      fontPairId: "romantic",
      names: ["", ""],
      media: [],
    });
    expect(JSON.stringify(draft)).not.toMatch(/Эмма|Даниэль|Шанхай/);
  });

  it("routes the same editable draft through Heritage and uses the real response form", () => {
    const draft = createPlatformDemo("heritage", "ru");
    draft.enabledSections.push("rsvp");
    const html = renderToStaticMarkup(
      <InvitationCanvas
        draft={draft}
        embedded
        initialNow={0}
        rsvp={<PublicRsvp slug="test-heritage" locale="ru" />}
      />,
    ).replaceAll("\u00a0", " ");
    expect(html).toContain('data-studio-template="heritage"');
    expect(html).toContain('data-font-pair="romantic"');
    expect(html).toContain('data-studio-field="hosts.0.name">Алишер');
    expect(html).toContain('action="/api/platform/public/test-heritage/rsvp"');
    expect(html).not.toContain(draft.title);
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html.match(/<h1 /g)).toHaveLength(1);
  });

  it("never renders disabled guest details or private management labels", () => {
    const draft = createPlatformDemo("heritage", "uz-latn");
    draft.greeting = "PRIVATE GREETING";
    draft.story = "PRIVATE STORY";
    draft.venue.name = "PRIVATE VENUE";
    draft.title = "PRIVATE TITLE";
    draft.enabledSections = [];
    const html = renderToStaticMarkup(
      <InvitationCanvas draft={draft} embedded initialNow={0} />,
    );
    expect(html).not.toContain("PRIVATE");
    expect(html).not.toContain('id="venue"');
    expect(html).not.toContain('id="story"');
    expect(html).not.toContain('id="footer"');
    expect(html).toContain('lang="uz-Latn"');
  });
});
