import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScrollNarrative } from "./ScrollNarrative";
import { Content } from "@/lib/schema/content";
import { directAsset, unusedAsset, type DirectedAsset } from "@/lib/assets/crop";
import { studioTemplateTheme } from "@/registry/studioTemplates";

const theme = studioTemplateTheme({ templateId: "heritage", paletteId: "cinnabar", fontPairId: "ceremony", ornamentSetId: "chinese-garden" });
const content = Content.parse({
  slug: "heritage-studio", locale: "ru", eventType: "wedding", hosts: [{ name: "Малика" }, { name: "Амир" }],
  greeting: "Будем рады разделить этот день с вами.",
  date: { start: "2027-10-16T17:00:00+05:00" },
  venue: { name: "Сад встреч", address: "Ташкент", mapUrl: "https://example.com/heritage-map" },
  timeline: [{ time: "17:00", title: "Встреча в саду" }],
  dressCode: { title: "Тёплые оттенки", note: "Лён и спокойные цвета", swatches: ["#A07159"] },
  wishes: "Подарите нам вашу улыбку.", closing: "До встречи, дорогие друзья!",
  rsvp: { enabled: true, mode: "form", target: "https://example.com/heritage-rsvp", askGuestCount: true },
  media: [{ id: "not-directed", src: "/not-directed.jpg" }],
});
function markup(event = content, photos: DirectedAsset[] = []) {
  return renderToStaticMarkup(<ScrollNarrative content={event} theme={theme} initialNow={Date.parse("2027-01-01T00:00:00Z")} photos={photos} guest="Мадина" embedded />).replace(/\u00a0/g, " ");
}
function photoAt(id: string, section: NonNullable<DirectedAsset["asset"]["placement"]>["section"], pinned = false): DirectedAsset {
  const info = { width: 1200, height: 1600 };
  return directAsset({ ...unusedAsset(id, info), role: "portrait", subject: "person", quality: "high", placementPinned: pinned, placement: { section, index: 0 } }, `/${id}.jpg`, info, "none")!;
}

test("the real studio route renders Heritage and preserves editable event facts and the working external RSVP contract", () => {
  const html = markup();
  expect(html).toMatch(/class="hp-invitation(?: |")/);
  expect(html).toContain('data-template="heritage"');
  expect(html).toContain("Малика");
  expect(html).toContain("Амир");
  for (const value of [content.greeting!, content.venue.name, content.venue.address, content.timeline[0].title, content.dressCode!.title, content.wishes!, content.closing!]) expect(html).toContain(value);
  expect(html).toContain('href="https://example.com/heritage-map"');
  expect(html).toContain('action="https://example.com/heritage-rsvp"');
  expect(html).toContain('value="Мадина"');
  expect(html).toContain('name="attendance"');
  expect(html).toContain('name="guests"');
  expect(html).toContain("Google Calendar");
  for (const field of ["hosts.0.name", "hosts.1.name", "greeting", "venue.name", "venue.address", "timeline.0.title", "dressCode.title", "dressCode.note", "wishes", "closing"]) expect(html).toContain(`data-studio-field="${field}"`);
  expect(html).not.toContain("not-directed.jpg");
  expect(html).not.toContain("studio-classic-opening");
});

test("Heritage keeps pinned photo sections, protected crops and uniqueness without leaking unapproved uploads", () => {
  const photos = [photoAt("portrait", "hero"), photoAt("letter", "greeting", true), photoAt("garden", "venue", true), photoAt("date-photo", "countdown", true), photoAt("last", "footer")];
  const sparse = { ...content, greeting: undefined, venue: { name: "", address: "" }, rsvp: undefined };
  const html = renderToStaticMarkup(<ScrollNarrative content={sparse} theme={{ ...theme, photos: [
    { id: "portrait", section: "hero", index: 0, position: "before" },
    { id: "portrait", section: "hero", index: 0, position: "after" },
    { id: "garden", section: "footer", index: 1, position: "after" },
  ] }} initialNow={0} photos={photos} embedded />);
  for (const photo of photos) expect(html.match(new RegExp(`data-photo-id="${photo.asset.id}"`, "g"))).toHaveLength(1);
  expect(html).toContain('data-photo-section="greeting"');
  expect(html).toContain('data-photo-section="countdown"');
  expect(html).toContain('data-photo-section="venue"');
  expect(html.indexOf('data-photo-section="venue"')).toBeLessThan(html.indexOf('data-section="timeline"'));
  expect(html).toContain(`data-crop="${photos[0].crop.mode}"`);
  expect(html).toContain(`object-fit:${photos[0].crop.mode === "whole" ? "contain" : "cover"}`);
  expect(html).not.toContain("not-directed.jpg");
});

test("Heritage accepts every existing studio locale and explicit instants during a DST overlap", () => {
  for (const locale of ["ru", "uz-latn", "en"] as const) {
    const html = markup({ ...content, locale, date: { ...content.date, start: "2027-11-07T01:30:41-04:00", timezone: "America/New_York" } });
    expect(html).toContain(`lang="${locale === "uz-latn" ? "uz-Latn" : locale}"`);
    expect(html).toContain("Малика");
    expect(html).toContain("Google Calendar");
    expect(html).toContain('dateTime="2027-11-07T01:30:41-04:00"');
    expect(html).toContain("20271107T053041Z");
  }
});

test("photo-only guest response survives with no invented form and duplicate section ids", () => {
  const html = markup({ ...content, rsvp: undefined }, [photoAt("guest-response-photo", "rsvp", true)]);
  expect(html).toContain('id="rsvp"');
  expect(html.match(/id="rsvp"/g)).toHaveLength(1);
  expect(html).toContain('data-photo-section="rsvp"');
  expect(html).not.toContain('name="attendance"');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
});

test("legacy venue coordinates retain their safe map and unsafe map protocols are rejected", () => {
  const html = markup({ ...content, venue: { name: "", address: "", coords: [41.31, 69.28] } });
  expect(html).toContain("https://www.openstreetmap.org/?mlat=41.31&amp;mlon=69.28");
  expect(() => markup({ ...content, venue: { ...content.venue, mapUrl: "javascript:alert(1)" } })).toThrow(/HTTP\(S\)/);
});

test("a sparse Heritage studio draft invents no sample event facts or guest response", () => {
  const html = markup(Content.parse({ slug: "blank-heritage", locale: "en", eventType: "wedding", hosts: [{ name: "Alex" }], date: { start: "" }, venue: { name: "", address: "" } }));
  expect(html).toContain("Alex");
  expect(html).not.toContain("Эмма");
  expect(html).not.toContain("Даниэль");
  expect(html).not.toContain('name="attendance"');
  expect(html).not.toContain("Google Calendar");
  expect(html).not.toContain('data-photo-section=');
});
