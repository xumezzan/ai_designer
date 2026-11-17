import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudioTemplateInvitation, type StudioTemplateTheme } from "./StudioTemplateInvitation";
import { ScrollNarrative } from "./ScrollNarrative";
import { Content } from "@/lib/schema/content";
import { directAsset, unusedAsset, type DirectedAsset } from "@/lib/assets/crop";
import { studioTemplates, studioTemplateTheme, resolveStudioComposition } from "@/registry/studioTemplates";
import { STUDIO_HERO_LAYOUTS, STUDIO_PHOTO_SHAPES, STUDIO_SECTION_VARIANTS, type StudioTemplateId, type StudioComposition } from "@/lib/schema/studioTemplate";
import { safeStudioPhotoShape } from "./StudioComposition";

const content = Content.parse({
  slug: "studio-template-test", locale: "ru", eventType: "wedding",
  hosts: [{ name: "София" }, { name: "Амир" }], greeting: "Разделите с нами этот день.\n\nБудем рады встрече.",
  date: { start: "2027-04-19T17:00:00+05:00" }, venue: { name: "Ботанический сад", address: "Ташкент", mapUrl: "https://example.com/map" },
  timeline: [{ time: "17:00", title: "Сбор гостей", note: "Встреча в саду" }, { time: "18:00", title: "Ужин" }],
  dressCode: { title: "Палитра вечера", note: "Мягкие природные оттенки", swatches: ["#A7AD95", "#BC926E"] },
  wishes: "Ваше присутствие — лучший подарок.", closing: "До встречи в саду",
  rsvp: { enabled: true, mode: "form", target: "https://example.com/rsvp", askGuestCount: true },
});
const themed = (id: StudioTemplateId): StudioTemplateTheme => {
  const descriptor = studioTemplates.find((entry) => entry.id === id)!;
  return studioTemplateTheme({ templateId: id, paletteId: descriptor.defaultPaletteId, fontPairId: descriptor.defaultFontPairId, ornamentSetId: descriptor.ornamentSetId }) as StudioTemplateTheme;
};
const markup = (id: StudioTemplateId, event = content, photos: DirectedAsset[] = [], theme = themed(id)) => renderToStaticMarkup(<StudioTemplateInvitation content={event} theme={theme} initialNow={Date.parse("2027-01-01T00:00:00Z")} photos={photos} guest="Мадина" embedded />);
const photoAt = (id: string, section: "hero" | "greeting" | "venue" | "footer", pinned = false) => {
  const info = { width: 1200, height: 1600 };
  return directAsset({ ...unusedAsset(id, info), role: "portrait", subject: "person", quality: "high", placementPinned: pinned, placement: { section, index: 0 }, maxViewportShare: .8 }, `/${id}.jpg`, info, "none")!;
};

// Heritage has its own composed renderer and routed integration coverage.
const sharedTemplates = studioTemplates.filter(({ id }) => id !== "heritage");

test("all shared compositions retain facts, semantic story order and server-rendered guest response", () => {
  for (const { id } of sharedTemplates) {
    const rendered = markup(id);
    expect(rendered.match(/<h1 /g)).toHaveLength(1);
    expect(rendered).toContain(`data-studio-template="${id}"`);
    expect(rendered).toContain('data-studio-field="hosts.0.name"');
    expect(rendered).toContain('data-studio-field="hosts.1.name"');
    for (const field of ["greeting", "venue.name", "venue.address", "dressCode.title", "dressCode.note", "wishes", "closing"]) expect(rendered).toContain(`data-studio-field="${field}"`);
    expect(rendered).toMatch(/datetime="2027-04-19T17:00:00\+05:00"/i);
    expect(rendered).toContain("Сбор гостей");
    expect(rendered.replace(/\u00a0/g, " ")).toContain("Встреча в саду");
    expect(rendered).toContain('action="https://example.com/rsvp"');
    expect(rendered).toContain('value="Мадина"');
    expect(rendered).toContain('name="attendance"');
    expect(rendered).toContain('name="guests"');
    expect(rendered).toContain('href="https://example.com/map"');
    expect(rendered).toContain("Google Calendar");
    expect([...rendered.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1])).toEqual(["hero", "greeting", "countdown", "venue", "timeline", "dressCode", "wishes", "rsvp", "footer"]);
  }
});

test("families differ in authored structure and graphic language, including a useful corporate first screen", () => {
  const openings = new Map(sharedTemplates.map(({ id }) => [id, markup(id).split('data-template-role="greeting"')[0]]));
  expect(openings.get("editorial")).toContain("studio-editorial-masthead");
  expect(openings.get("botanical")).toContain("studio-botanical-arch");
  expect(openings.get("botanical")).toContain("editorial-botanical");
  expect(openings.get("classic")).toContain("studio-classic-monogram");
  expect(openings.get("classic")).toContain("studio-classic-frame");
  expect(openings.get("modern")).toContain("studio-modern-band");
  expect(openings.get("modern")).toContain("studio-modern-mark");
  expect(openings.get("nocturne")).toContain("deco-fan");
  expect(openings.get("nocturne")).toContain("studio-nocturne-arch");
  const corporate = markup("corporate", { ...content, eventType: "corporate", headline: "Встреча команды" }, [photoAt("team", "hero")]);
  expect(corporate).toContain('data-studio-field="headline">Встреча команды');
  expect(corporate).toContain('class="studio-template-hosts"');
  expect(corporate).toContain('data-studio-field="hosts.0.name">София');
  expect(corporate.indexOf('data-studio-section="date"')).toBeLessThan(corporate.indexOf('data-photo-id="team"'));
  expect(corporate.indexOf('data-studio-field="venue.name"')).toBeLessThan(corporate.indexOf('data-photo-id="team"'));
  expect(corporate).not.toContain("editorial-botanical");
  expect(corporate).not.toContain("studio-classic-frame");
  expect(corporate).not.toContain("deco-fan");
  expect(corporate).toContain('data-motion="still"');
});

test("sparse drafts invent no facts or optional sections and still expose a readable opening and farewell", () => {
  const sparse = Content.parse({ slug: "draft", locale: "ru", eventType: "birthday", hosts: [{ name: "София" }], date: { start: "" }, venue: { name: "", address: "" } });
  for (const { id } of sharedTemplates) {
    const rendered = markup(id, sparse);
    expect([...rendered.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1])).toEqual(["hero", "footer"]);
    expect(rendered).not.toContain('data-studio-section="date"');
    expect(rendered).not.toContain('data-studio-field="venue.name"');
    expect(rendered).not.toContain('class="invitation-calendar"');
    expect(rendered).not.toContain('name="attendance"');
    expect(rendered).toContain('href="#footer"');
  }
});

test("event role headings follow corporate and birthday copy while a named guest keeps the personal greeting", () => {
  for (const [id, eventType, greeting, countdown, programme] of [
    ["corporate", "corporate", "Дорогие коллеги", "До встречи", "Программа встречи"],
    ["modern", "birthday", "Дорогие друзья", "До праздника", "План праздника"],
  ] as const) {
    const event = { ...content, eventType, headline: "Встречаемся вместе" };
    const rendered = renderToStaticMarkup(<StudioTemplateInvitation content={event} theme={themed(id)} initialNow={0} embedded />).replace(/\u00a0/g, " ");
    expect(rendered).toContain(greeting);
    expect(rendered).toContain(countdown);
    expect(rendered).toContain(programme);
    expect(rendered).toContain('class="studio-template-hosts"');
    const personal = markup(id, event);
    expect(personal).toContain('id="greeting-title" data-level="display-sm">Мадина');
  }
});

test("every enabled placed photograph is shown once, including pinned photo-only optional roles", () => {
  const photos = [photoAt("hero-portrait", "hero"), photoAt("private-letter", "greeting", true), photoAt("garden", "venue", true), photoAt("farewell", "footer")];
  const sparse = { ...content, greeting: undefined, venue: { name: "", address: "" }, rsvp: undefined };
  for (const { id } of sharedTemplates) {
    const theme = { ...themed(id), photos: [
      { id: "hero-portrait", section: "hero" as const, index: 0, position: "before" as const },
      { id: "hero-portrait", section: "hero" as const, index: 0, position: "after" as const },
      { id: "garden", section: "footer" as const, index: 1, position: "after" as const },
    ] };
    const rendered = markup(id, sparse, photos, theme);
    for (const photo of photos) expect(rendered.match(new RegExp(`data-photo-id="${photo.asset.id}"`, "g"))).toHaveLength(1);
    expect(rendered).toContain('id="greeting"');
    expect(rendered).toContain('id="venue"');
    expect(rendered).not.toContain('data-section="greeting"');
    expect(rendered).not.toContain('data-section="venue"');
    expect(rendered).toContain('data-photo-section="venue"');
    expect(rendered.indexOf('id="venue"')).toBeLessThan(rendered.indexOf('id="timeline"'));
    expect(rendered).toContain(`data-crop="${photos[0].crop.mode}"`);
  }
});

test("botanical photo silhouettes preserve protected regions and the asset director's chosen crop", () => {
  const protectedPhoto = photoAt("protected", "hero");
  expect(markup("botanical", content, [protectedPhoto])).toContain('data-studio-photo-mask="rectangular_passepartout"');
  const central = { ...protectedPhoto, asset: { ...protectedPhoto.asset, id: "central", safeArea: { x: .4, y: .4, w: .2, h: .2 } } };
  const rendered = markup("botanical", content, [central]);
  expect(rendered).toContain('data-studio-photo-mask="soft_arch"');
  expect(rendered).toContain(`data-crop="${central.crop.mode}"`);
  expect(rendered).toContain('object-position:50% 50%');
});

test("calendar survives a disabled RSVP and template dispatch ignores stale generated artwork", () => {
  expect(markup("editorial", { ...content, rsvp: undefined })).toContain('class="invitation-calendar"');
  const theme = { ...themed("corporate"), layout: { ...themed("corporate").layout, composition: "immersive" as const } };
  const rendered = renderToStaticMarkup(<ScrollNarrative content={content} theme={theme} initialNow={0} generatedVisual={{ src: "/old-generated-poster.png", width: 1024, height: 1536 }} embedded />);
  expect(rendered).toContain('data-studio-template="corporate"');
  expect(rendered).not.toContain("old-generated-poster.png");
});

const composedTheme = (composition: StudioComposition, id: StudioTemplateId = "editorial", ornamentSetId: StudioTemplateTheme["studioTemplate"]["ornamentSetId"] = "editorial-rules"): StudioTemplateTheme => studioTemplateTheme({ templateId: id, paletteId: "ivory", fontPairId: "editorial", ornamentSetId, composition }) as StudioTemplateTheme;

test("each parameterised opening has one editable title, facts, guest controls and a complete photo-free form", () => {
  for (const heroLayout of STUDIO_HERO_LAYOUTS) {
    const composition = { ...resolveStudioComposition("editorial"), heroLayout };
    const rendered = markup("editorial", content, [], composedTheme(composition));
    expect(rendered).toContain(`data-hero-layout="${heroLayout}"`);
    expect(rendered).toContain('data-studio-composition="parametric"');
    expect(rendered.match(/<h1 /g)).toHaveLength(1);
    for (const field of ["hosts.0.name", "hosts.1.name", "greeting", "venue.name", "venue.address", "wishes", "closing"]) expect(rendered).toContain(`data-studio-field="${field}"`);
    expect(rendered).toContain('class="studio-composition-native-mark"');
    expect(rendered).toContain('action="https://example.com/rsvp"');
    expect(rendered).toContain('href="https://example.com/map"');
    expect(rendered).toContain("Google Calendar");
    expect([...rendered.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1])).toEqual(["hero", "greeting", "countdown", "venue", "timeline", "dressCode", "wishes", "rsvp", "footer"]);
  }
});

test("section decisions compose independently, retaining one occurrence of each placed image and pinned semantic roles", () => {
  const pictures = [photoAt("cover", "hero"), photoAt("letter", "greeting", true), photoAt("location", "venue", true)];
  for (let index = 0; index < 3; index++) {
    const sectionVariants = Object.fromEntries(Object.entries(STUDIO_SECTION_VARIANTS).map(([key, values]) => [key, values[index]])) as StudioComposition["sectionVariants"];
    const composition = { ...resolveStudioComposition("editorial"), sectionVariants };
    const theme = composedTheme(composition);
    theme.photos = [{ id: "letter", section: "footer", index: 0, position: "after" }];
    const rendered = markup("editorial", content, pictures, theme);
    for (const picture of pictures) expect(rendered.match(new RegExp(`data-photo-id="${picture.asset.id}"`, "g"))).toHaveLength(1);
    expect(rendered).toContain('data-photo-section="greeting"');
    expect(rendered).toContain(`data-gallery-variant="${sectionVariants.gallery}"`);
    for (const key of ["countdown", "venue", "rsvp"] as const) expect(rendered).toContain(`data-template-role="${key}" data-section-variant="${sectionVariants[key]}"`);
    expect(rendered).toContain(`data-template-role="timeline" data-section-variant="${sectionVariants.program}"`);
    expect(rendered).toContain(`data-crop="${pictures[0].crop.mode}"`);
    expect(rendered).toContain("object-position:50% 50%");
    expect(rendered).not.toContain('class="studio-composition-native-mark"');
  }
});

test("photo silhouettes fall back when they would cut a protected region and retain shapes for a safe central subject", () => {
  const protectedPhoto = photoAt("protected-composition", "hero");
  const central = { ...protectedPhoto, asset: { ...protectedPhoto.asset, safeArea: { x: .4, y: .4, w: .2, h: .2 } } };
  for (const photoShape of STUDIO_PHOTO_SHAPES) {
    expect(safeStudioPhotoShape(central, photoShape)).toBe(photoShape);
    const expected = photoShape === "polaroid" ? "polaroid" : "sharp";
    expect(safeStudioPhotoShape(protectedPhoto, photoShape)).toBe(expected);
    const composition = { ...resolveStudioComposition("editorial"), photoShape };
    const rendered = markup("editorial", content, [protectedPhoto], composedTheme(composition));
    expect(rendered).toContain(`data-photo-shape="${expected}"`);
    if (!["sharp", "polaroid"].includes(photoShape)) expect(rendered).toContain('data-protected-fallback="true"');
  }
});

test("independent decoration respects its placement, density, opacity and selected registered pack", () => {
  const composition = resolveStudioComposition("editorial");
  const corners = { ...composition, decorConfig: { placement: "corners" as const, density: "rich" as const, opacity: .42 } };
  const botanical = markup("editorial", content, [], composedTheme(corners, "editorial", "botanical-engraving"));
  expect(botanical).toContain('data-ornament-set="botanical-engraving"');
  expect(botanical).toContain('data-decor-placement="corners"');
  expect(botanical).toContain("--studio-decor-opacity:0.42");
  expect(botanical).toContain("editorial-botanical");
  expect(botanical).not.toContain("studio-botanical-opening");
  for (const decorConfig of [{ ...corners.decorConfig, density: "none" as const }, { ...corners.decorConfig, opacity: 0 }]) {
    const rendered = markup("editorial", content, [], composedTheme({ ...composition, decorConfig }));
    expect(rendered).not.toContain('class="studio-composition-decor"');
  }
  const dividers = markup("editorial", content, [], composedTheme({ ...composition, decorConfig: { ...composition.decorConfig, placement: "dividers" } }));
  expect(dividers.match(/data-decor-placement="dividers"/g)).toHaveLength(8);
});

test("Heritage opts into the block renderer only with a composition; its absent configuration keeps the legacy envelope", () => {
  const oldTheme = themed("heritage");
  const legacy = renderToStaticMarkup(<ScrollNarrative content={content} theme={oldTheme} initialNow={0} embedded />);
  expect(legacy).not.toContain('data-studio-composition="parametric"');
  const composition = resolveStudioComposition("heritage");
  const theme = composedTheme(composition, "heritage", "chinese-garden");
  const rendered = renderToStaticMarkup(<ScrollNarrative content={content} theme={theme} initialNow={0} embedded />);
  expect(rendered).toContain('data-studio-template="heritage"');
  expect(rendered).toContain('data-studio-composition="parametric"');
  expect(rendered).toContain("/artwork/chinese-heritage/plum-branch.webp");
  expect(rendered).toContain('data-studio-field="hosts.0.name"');
  expect(rendered).toContain('action="https://example.com/rsvp"');
});
