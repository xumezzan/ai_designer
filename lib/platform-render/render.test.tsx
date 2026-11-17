import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createEmptyDraft,
  publicSnapshotContent,
  TEMPLATE_IDS,
  PALETTE_IDS,
  FONT_PAIR_IDS,
  type InvitationDraft,
} from "@/lib/platform/schema";
import { Content } from "@/lib/schema/content";
import { STUDIO_SECTION_VARIANTS } from "@/lib/schema/studioTemplate";
import { Theme } from "@/lib/schema/theme";
import {
  StudioTemplateInvitation,
  type StudioTemplateTheme,
} from "@/components/layouts/StudioTemplateInvitation";
import { PublicRsvp } from "@/components/platform/PublicRsvp";
import { InvitationCanvas } from "@/components/platform/InvitationCanvas";
import { resolveStudioComposition, studioPalettes } from "@/registry/studioTemplates";
import { platformContent } from "./content";
import { platformTheme, resolvePlatformDesignSelection } from "./theme";
import { createPlatformDemo } from "./demo";
import { InvitationDraftSchema } from "@/lib/platform/schema";

function populatedDraft(): InvitationDraft {
  return {
    ...createEmptyDraft(),
    names: ["Азиз", "Малика"],
    title: "Свадьба Азиза и Малики",
    greeting: "Дорогие друзья!",
    story: "Наша история началась весной.",
    date: {
      day: "2027-05-20",
      time: "18:30",
      timezone: "Asia/Tashkent",
      showCountdown: true,
    },
  };
}

describe("platform content boundary", () => {
  test("catalogue demos are bounded, schema-valid fictional content in both locales", () => {
    for (const templateId of TEMPLATE_IDS) {
      for (const locale of ["ru", "uz-latn"] as const) {
        const demo = createPlatformDemo(templateId, locale);
        expect(InvitationDraftSchema.safeParse(demo).success).toBe(true);
        expect(demo.templateId).toBe(templateId);
        expect(demo.locale).toBe(locale);
        expect(demo.media).toEqual([]);
        expect(demo.venue.mapUrl).toBeUndefined();
        expect(demo.enabledSections).not.toContain("rsvp");
        expect(Content.safeParse(platformContent(demo)).success).toBe(true);
      }
    }
  });

  test("keeps names as the wedding identity and never enables a legacy RSVP destination", () => {
    const content = platformContent(populatedDraft(), "aziz-malika");
    expect(content.slug).toBe("aziz-malika");
    expect(content.headline).toBeUndefined();
    expect(content.wishes).toBeUndefined();
    expect(content.rsvp).toBeUndefined();
    expect(content.hosts.map(({ name }) => name)).toEqual(["Азиз", "Малика"]);
    expect(new Date(content.date.start).toISOString()).toBe(
      "2027-05-20T13:30:00.000Z",
    );
    expect(Content.safeParse(content).success).toBe(true);
  });

  test("a day without a time has no invented midnight or countdown", () => {
    const draft = populatedDraft();
    draft.date.time = "";
    const content = platformContent(draft);
    expect(content.date).toEqual({
      start: "",
      day: "2027-05-20",
      timezone: "Asia/Tashkent",
      showCountdown: false,
    });
  });

  test("a single-host birthday renders the host and keeps its management title private", () => {
    const draft = {
      ...populatedDraft(),
      eventType: "birthday" as const,
      names: ["Малика"],
      title: "Private birthday draft, do not publish this title",
    };
    const content = platformContent(draft);
    expect(content.headline).toBeUndefined();
    const rendered = renderToStaticMarkup(
      <StudioTemplateInvitation
        content={content}
        theme={platformTheme(draft)}
        initialNow={0}
        embedded
      />,
    );
    expect(rendered).toContain('data-studio-field="hosts.0.name">Малика');
    expect(rendered).not.toContain(draft.title);
    expect(rendered).not.toContain('data-studio-field="hosts.1.name"');
  });

  test("hidden event details stay out of the shared renderer", () => {
    const draft = populatedDraft();
    draft.enabledSections = [];
    const content = platformContent(draft);
    expect(content.greeting).toBeUndefined();
    expect(content.venue.name).toBe("");
    expect(content.date.start).toBe("");
    expect(content.date.day).toBeUndefined();
  });

  test("each bounded palette/font choice preserves its authored composition", () => {
    for (const templateId of TEMPLATE_IDS.filter((id) => id !== "sculpted-garden")) {
      for (const paletteId of PALETTE_IDS) {
        for (const fontPairId of FONT_PAIR_IDS) {
          const theme = platformTheme({ templateId, paletteId, fontPairId });
          expect(Theme.safeParse(theme).success).toBe(true);
          expect(theme.studioTemplate.id).toBe(templateId);
          expect(theme.typeSet).toBe(
            {
              editorial: "editorial",
              classic: "ceremony",
              modern: "gallery",
              romantic: "ceremony",
              ceremony: "ceremony",
              poetic: "poetic",
              modernist: "modernist",
              gallery: "gallery",
              "modern-editorial": "modern-editorial",
              "botanical-haute": "botanical-haute",
              "velvet-noir": "velvet-noir",
            }[fontPairId],
          );
        }
      }
    }
  });

  test("preserves a persisted composition and exact canonical colour/type decisions", () => {
    const draft: InvitationDraft = {
      ...populatedDraft(), templateId: "modern", paletteId: "cobalt", fontPairId: "modernist",
      ornamentSetId: "graphic-ribbon", composition: resolveStudioComposition("modern"),
    };
    draft.composition!.heroLayout = "split-editorial";
    const restored = InvitationDraftSchema.parse(JSON.parse(JSON.stringify(draft)));
    const theme = platformTheme(restored);
    expect(theme.studioTemplate.composition).toEqual(draft.composition);
    expect(theme.studioTemplate.ornamentSetId).toBe("graphic-ribbon");
    expect(theme.palette.bg).toBe(studioPalettes.cobalt.bg);
    expect(theme.typeSet).toBe("modernist");
    expect(resolvePlatformDesignSelection({ ...draft, paletteId: "midnight", fontPairId: "modern" })).toMatchObject({ paletteId: "ink", fontPairId: "gallery" });
    expect(Theme.safeParse(theme).success).toBe(true);
    const rendered = renderToStaticMarkup(<InvitationCanvas draft={restored} initialNow={0} embedded />);
    expect(rendered).toContain('data-studio-composition="parametric"');
    expect(rendered).toContain('data-hero-layout="split-editorial"');
  });

  test("optional additions do not migrate old drafts or introduce a public headline", () => {
    const legacy = InvitationDraftSchema.parse(populatedDraft());
    expect(legacy).not.toHaveProperty("purpose");
    expect(legacy).not.toHaveProperty("composition");
    expect(platformContent(legacy).headline).toBeUndefined();
    expect(InvitationDraftSchema.safeParse({ ...legacy, headline: "x".repeat(201) }).success).toBe(false);
    expect(InvitationDraftSchema.safeParse({ ...legacy, composition: { heroLayout: "arbitrary-css" } }).success).toBe(false);
  });

  test("a composed opening uses a real uploaded photo once without fabricated dimensions, crops or quality grades", () => {
    const first = { id: "235b9385-be33-4273-ac62-1c8be0d4bfa1", src: "/api/platform/media/235b9385-be33-4273-ac62-1c8be0d4bfa1" };
    const second = { id: "79de237c-e5f6-4d56-a00b-f60c55c9070a", src: "/api/platform/media/79de237c-e5f6-4d56-a00b-f60c55c9070a" };
    const draft: InvitationDraft = { ...populatedDraft(), templateId: "editorial", composition: resolveStudioComposition("editorial"), media: [first, second] };
    const rendered = renderToStaticMarkup(<InvitationCanvas draft={draft} embedded initialNow={0} />);
    expect(rendered).toContain('data-has-photo="true"');
    expect(rendered).toContain(`data-photo-id="${first.id}" data-crop="whole"`);
    expect(rendered.match(new RegExp(`src="${first.src}"`, "g"))).toHaveLength(1);
    expect(rendered.match(new RegExp(`src="${second.src}"`, "g"))).toHaveLength(1);
    expect(rendered).not.toContain('data-quality="high"');
    expect(rendered).not.toContain('class="studio-composition-native-mark"');
    expect(rendered).toContain('object-fit:contain');
    expect(rendered).not.toMatch(/<img[^>]*\s(?:width|height)="/);
  });
});

describe("congratulatory website rendering", () => {
  test("every collection renders greeting copy without event facts or guest controls in both locales", () => {
    for (const templateId of TEMPLATE_IDS) for (const locale of ["ru", "uz-latn"] as const) {
      const draft: InvitationDraft = {
        ...populatedDraft(), templateId, locale, purpose: "greeting", eventType: "birthday",
        names: ["Малика"], headline: "Этот день — для тебя", title: "private-management-title",
        story: "Пусть сбываются мечты.", closing: "С теплом и любовью",
        venue: { name: "private-location", address: "private-address" },
        timeline: [{ time: "19:00", title: "private-programme" }],
        dressCode: { title: "private-dress", swatches: ["#AABBCC"] },
        enabledSections: ["opening", "greeting", "story", "date", "venue", "timeline", "dressCode", "rsvp", "closing"],
      };
      const content = platformContent(draft);
      expect(Content.safeParse(content).success).toBe(true);
      expect(content.date).toMatchObject({ start: "", showCountdown: false });
      expect(content.date.day).toBeUndefined();
      const rendered = renderToStaticMarkup(<InvitationCanvas draft={draft} initialNow={0} rsvp={<form>private-response-control</form>} />);
      expect(rendered).toContain("Этот день");
      expect(rendered.replace(/\u00a0/g, " ")).toContain(locale === "ru" ? "С днём рождения" : "Tugʻilgan kuningiz muborak");
      for (const absent of ["private-", "2027-05-20", "18:30", "19:00", "#AABBCC", "<dialog", "<form", 'id="venue"', 'id="rsvp"', 'id="countdown"', 'id="timeline"', "Приглашение", "приглашение", "гости", "Taklifnoma", "taklif", "mehmonlar"]) {
        expect(rendered, `${templateId}/${locale}: ${absent}`).not.toContain(absent);
      }
      const selected = templateId === "heritage" || templateId === "sculpted-garden" ? "editorial" : templateId;
      expect(rendered).toContain(`data-studio-template="${selected}"`);
      expect([...rendered.matchAll(/data-template-role="([^"]+)"/g)].map((match) => match[1])).toEqual(["hero", "greeting", "story", "footer"]);
    }
  });

  test("shared renderer also suppresses stale event facts and supplied RSVP/guest slots for greeting content", () => {
    const draft = populatedDraft();
    const content = { ...platformContent(draft), purpose: "greeting" as const, venue: { name: "private-venue", address: "private-address" }, timeline: [{ time: "19:00", title: "private-timeline" }] };
    const rendered = renderToStaticMarkup(<StudioTemplateInvitation content={content} theme={platformTheme(draft)} guest="private-guest" initialNow={0} additionalSections={{ rsvp: <form>private-rsvp</form> }} />);
    expect(rendered).not.toContain("private-");
    expect(rendered).not.toContain("2027");
    expect(rendered).not.toContain("Приглашение");
    expect(rendered).not.toContain("До встречи");
    expect(rendered.replace(/\u00a0/g, " ")).toContain("С любовью");
  });
});

describe("authored renderer platform extension", () => {
  test.each([
    ["story-first", true, ["hero", "greeting", "story", "countdown", "venue", "timeline", "rsvp", "footer"]],
    ["event-first", true, ["hero", "countdown", "venue", "timeline", "greeting", "story", "rsvp", "footer"]],
    ["event-first", false, ["hero", "countdown", "venue", "timeline", "story", "rsvp", "footer"]],
    ["programme-first", true, ["hero", "greeting", "story", "countdown", "timeline", "venue", "rsvp", "footer"]],
  ] as const)("keeps opening, story and response in the %s preset with greeting=%s", (sectionOrder, hasGreeting, roles) => {
    const draft: InvitationDraft = {
      ...populatedDraft(), templateId: "editorial",
      composition: { ...resolveStudioComposition("editorial"), sectionOrder },
      greeting: hasGreeting ? "Дорогие друзья!" : "",
      enabledSections: [...populatedDraft().enabledSections, "story"],
      timeline: [{ time: "18:30", title: "Встреча гостей" }],
      venue: { name: "Сад", address: "Ташкент", mapUrl: "https://example.com/map" },
    };
    const rendered = renderToStaticMarkup(<InvitationCanvas draft={draft} initialNow={0} embedded rsvp={<section id="rsvp">Ответ</section>} />);
    expect([...rendered.matchAll(/data-template-role="([^"]+)"/g)].map((match) => match[1])).toEqual(roles);
    expect(rendered).toContain(`href="#${roles[1]}"`);
  });

  test.each([0, 1, 2])("renders authored story, gallery, dress-code and wishes variants (%i)", (index) => {
    const variants = STUDIO_SECTION_VARIANTS;
    const composition = resolveStudioComposition("editorial");
    const photos = ["ba578ad2-e61d-46fa-8198-0908e3ccd971", "415aeffa-f10f-4061-bfb2-4f3dd76c58c6", "ef4cdd71-d73d-45e6-bd37-60909727961f"];
    const draft = publicSnapshotContent(InvitationDraftSchema.parse({
      ...populatedDraft(),
      templateId: "editorial",
      composition: {
        ...composition,
        sectionVariants: {
          ...composition.sectionVariants,
          story: variants.story[index],
          gallery: variants.gallery[index],
          dressCode: variants.dressCode[index],
          wishes: variants.wishes[index],
        },
      },
      dressCode: { title: "Праздничный наряд", swatches: ["#AABBCC"] },
      wishes: "Счастья нашей семье.\n\nПусть праздник запомнится всем.",
      enabledSections: ["opening", "greeting", "story", "dressCode", "wishes", "closing"],
      media: photos.map((id) => ({ id, src: `/api/platform/media/${id}` })),
    }));
    const rendered = renderToStaticMarkup(<InvitationCanvas draft={draft} initialNow={0} embedded />);
    for (const section of ["story", "dressCode", "wishes"] as const) {
      expect(rendered).toContain(`data-template-role="${section}" data-section-variant="${variants[section][index]}"`);
    }
    expect(rendered).toContain(`class="platform-gallery" data-gallery-variant="${variants.gallery[index]}"`);
    expect(rendered.includes('role="region"')).toBe(variants.gallery[index] === "filmstrip");
    expect(rendered).toContain("Счастья нашей семье.");
    expect(rendered).toContain("Пусть праздник запомнится всем.");
    expect(rendered).toContain("Наша история началась весной.");
    for (const id of photos) expect(rendered.split(`src="/api/platform/media/${id}"`)).toHaveLength(2);
  });

  test.each(TEMPLATE_IDS)("publishes independent wishes for %s and removes private wishes from disabled blocks", (templateId) => {
    const draft: InvitationDraft = {
      ...populatedDraft(), templateId, wishes: "Gʻamxoʻrlik uchun rahmat.",
      locale: "uz-latn", enabledSections: ["opening", "story", "wishes", "closing"],
    };
    const published = publicSnapshotContent(draft);
    const rendered = renderToStaticMarkup(<InvitationCanvas draft={published} initialNow={0} embedded />);
    expect(rendered).toContain('id="wishes"');
    expect(rendered).toContain("Gʻamxoʻrlik");
    const hidden = publicSnapshotContent({ ...draft, enabledSections: ["opening", "story"] });
    expect(hidden).not.toHaveProperty("wishes");
    expect(renderToStaticMarkup(<InvitationCanvas draft={hidden} initialNow={0} embedded />)).not.toContain("Gʻamxoʻrlik");
  });

  test("places story after greeting and platform RSVP before the farewell without a legacy form", () => {
    const draft = populatedDraft();
    const rendered = renderToStaticMarkup(
      <StudioTemplateInvitation
        content={platformContent(draft)}
        theme={platformTheme(draft)}
        initialNow={0}
        embedded
        additionalSections={{
          story: <section id="story">История</section>,
          rsvp: <section id="rsvp">Ответ</section>,
        }}
      />,
    );
    const roles = [...rendered.matchAll(/data-template-role="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(roles).toEqual([
      "hero",
      "greeting",
      "story",
      "countdown",
      "rsvp",
      "footer",
    ]);
    expect(rendered).not.toContain("https://form");
    expect(rendered.match(/id="rsvp"/g)).toHaveLength(1);
  });

  test("without a greeting, the first scroll target leads to the story and disabled farewell is absent", () => {
    const draft = createEmptyDraft();
    const rendered = renderToStaticMarkup(
      <StudioTemplateInvitation
        content={platformContent(draft)}
        theme={platformTheme(draft)}
        initialNow={0}
        embedded
        additionalSections={{ story: <section id="story">История</section> }}
        closingEnabled={false}
      />,
    );
    expect(rendered).toContain('href="#story"');
    expect(rendered).not.toContain('id="footer"');
  });

  test("the unchanged default renderer retains its standard farewell", () => {
    const draft = createEmptyDraft();
    const theme = platformTheme(draft) as StudioTemplateTheme;
    const rendered = renderToStaticMarkup(
      <StudioTemplateInvitation
        content={platformContent(draft)}
        theme={theme}
        initialNow={0}
        embedded
      />,
    );
    expect(rendered).toContain('href="#footer"');
    expect(rendered).toContain('id="footer"');
    expect(rendered).not.toContain('data-template-role="story"');
  });

  test("public response supports both locales with native labels and a POST action", () => {
    for (const locale of ["ru", "uz-latn"] as const) {
      const rendered = renderToStaticMarkup(
        <PublicRsvp slug="aziz-malika" locale={locale} />,
      );
      expect(rendered).toContain('method="post"');
      expect(rendered).toContain(
        'action="/api/platform/public/aziz-malika/rsvp"',
      );
      expect(rendered).toContain('name="name"');
      expect(rendered).toContain('name="guestCount"');
      expect(rendered.match(/name="status"/g)).toHaveLength(3);
      expect(rendered).not.toContain('name="email"');
    }
  });
});
