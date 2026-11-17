import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyDraft, type InvitationDraft } from "@/lib/platform/schema";
import { SculptedGardenInvitation } from "./SculptedGardenInvitation";

const artworkId = "11111111-1111-4111-8111-111111111111";
const wideId = "22222222-2222-4222-8222-222222222222";
const photoId = "33333333-3333-4333-8333-333333333333";
const media = (id: string) => ({ id, src: `/api/platform/media/${id}` });

function fixture(overrides: Partial<InvitationDraft> = {}): InvitationDraft {
  return {
    ...createEmptyDraft("sculpted-garden"),
    title: "Private project title",
    names: ["Малика", "Амир"],
    greeting: "Приглашаем вас разделить этот день.",
    story: "Наша собственная история.",
    date: { day: "2028-02-29", time: "17:30", timezone: "Asia/Tashkent", showCountdown: true },
    venue: { name: "Сад у реки", address: "Ташкент, улица Садовая 42", mapUrl: "https://example.com/our-map", note: "Вход со стороны сада." },
    timeline: [{ time: "17:30", title: "Встреча гостей", note: "В саду у фонтана" }],
    dressCode: { title: "В оттенках вечера", note: "Выберите удобный образ.", swatches: ["#D8D2BC", "#A1AB91", "#6A7059"] },
    closing: "До встречи в нашем саду.",
    enabledSections: ["opening", "greeting", "story", "date", "venue", "timeline", "dressCode", "rsvp", "closing"],
    media: [media(photoId)],
    ...overrides,
  };
}

const render = (draft: InvitationDraft, withRsvp = true) => renderToStaticMarkup(
  <SculptedGardenInvitation draft={draft} slug="our-garden" initialNow={Date.UTC(2027, 0, 1)} rsvp={withRsvp ? <form id="rsvp" action="/api/platform/public/our-garden/rsvp"><label>Имя<input name="name" /></label><button>Отправить</button></form> : undefined} />,
);
const plain = (html: string) => html.replaceAll("\u00a0", " ").replaceAll("\u202f", " ");

describe("SculptedGardenInvitation", () => {
  it("renders the saved event as a live, complete web story with timezone-correct actions", () => {
    const html = plain(render(fixture()));
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('data-template="sculpted-garden"');
    expect(html).toContain('data-studio-field="hosts.0.name">Малика');
    expect(html).toContain('data-studio-field="hosts.1.name">Амир');
    expect(html).toContain("Приглашаем вас разделить этот день.");
    expect(html).toContain("Наша собственная история.");
    expect(html).toContain('dateTime="2028-02-29T12:30:00.000Z"');
    expect(html).toContain("29 февраля 2028");
    expect(html).toContain("17:30");
    expect(html).toContain('href="https://example.com/our-map"');
    expect(html).toContain("Вход со стороны сада.");
    expect(html).toContain("Встреча гостей");
    expect(html).toContain("В саду у фонтана");
    expect(html).toContain("Выберите удобный образ.");
    expect(html).toContain("До встречи в нашем саду.");
    expect(html).toContain("DTSTART%3A20280229T123000Z");
    expect(html).toContain('download="our-garden.ics"');
    expect(html).toContain('action="/api/platform/public/our-garden/rsvp"');
    expect(html).not.toContain("Private project title");
    expect(html).not.toContain("envelope");
    const order = ["opening", "greeting", "story", "date", "venue", "timeline", "dressCode", "rsvp", "closing"].map((id) => html.indexOf(`data-section="${id}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.match(/id="rsvp"/g)).toHaveLength(1);
    expect(html).toContain('href="#response"');
  });

  it("uses the generated portrait directly on both viewports, preserving separate uploaded photos", () => {
    const draft = fixture({ artwork: media(artworkId), media: [media(artworkId), media(photoId)] });
    const html = render(draft);
    expect(html).toContain(`class="sg-art-portrait" src="${media(artworkId).src}"`);
    expect(html).toContain(`class="sg-art-wide" src="${media(artworkId).src}"`);
    expect(html).not.toContain("/artwork/sculpted-garden/");
    expect(html).toContain('data-media-count="1"');
    expect(html).toContain(`data-media-id="${photoId}"`);
    expect(html).not.toContain(`data-media-id="${artworkId}"`);
    const css = readFileSync(new URL("./sculpted-garden.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.sg-photo-frame img\s*\{[^}]*object-fit:contain/);
  });

  it("uses an explicitly generated wide image without replacing either with bundled artwork", () => {
    const html = render(fixture({ artwork: media(artworkId), artworkWide: media(wideId) }));
    expect(html).toContain(`class="sg-art-portrait" src="${media(artworkId).src}"`);
    expect(html).toContain(`class="sg-art-wide" src="${media(wideId).src}"`);
    expect(html).not.toContain("/artwork/sculpted-garden/");
  });

  it("removes disabled event facts and actions from the hero as well as their sections", () => {
    const html = render(fixture({ enabledSections: ["opening"], media: [] }));
    for (const fragment of ["Приглашаем вас", "Наша собственная", "Сад у реки", "Садовая", "our-map", "Вход со стороны", "Встреча гостей", "фонтан", "В оттенках", "Выберите удобный", "До встречи в нашем саду", "29 февраля", "17:30", "20280229", "data-section=\"date\"", "calendar.google", "<form", "countdown"]) {
      expect(html).not.toContain(fragment);
    }
    expect(html).toContain("Малика");
    expect(html).toContain("Амир");
  });

  it("leaves empty optional blocks absent and does not invent names, dates or programme facts", () => {
    const html = render(createEmptyDraft("sculpted-garden"), false);
    expect(html).toContain('/artwork/sculpted-garden/portrait.webp');
    expect(html).toContain('/artwork/sculpted-garden/wide.webp');
    expect(html.match(/data-section=/g)).toHaveLength(1);
    for (const section of ["greeting", "story", "date", "venue", "timeline", "dressCode", "rsvp", "closing"]) expect(html).not.toContain(`data-section="${section}"`);
    for (const invented of ["София", "Александр", "Villa", "2027", "17:00", "Встреча гостей", "Сохранить дату"]) expect(html).not.toContain(invented);
  });

  it("preserves a date-only value without inventing midnight or a calendar instant", () => {
    const html = render(fixture({ date: { day: "2028-02-29", time: "", timezone: "Pacific/Kiritimati", showCountdown: true } }));
    expect(html).toContain('dateTime="2028-02-29"');
    expect(html).toContain("29 февраля 2028");
    expect(html).not.toContain("calendar.google");
    expect(html).not.toContain(".ics");
    expect(html).not.toContain('data-section="countdown"');
    expect(html).not.toContain("00:00");
  });

  it("keeps an unfinished DST-gap editor date readable without offering a false instant", () => {
    const html = render(fixture({ date: { day: "2028-03-26", time: "02:30", timezone: "Europe/Berlin", showCountdown: true } }));
    expect(html).toContain("26 марта 2028");
    expect(html).not.toContain("calendar.google");
    expect(html).not.toContain('data-section="countdown"');
  });

  it("supports one to six actual names, arbitrary event types and Uzbek guest labels", () => {
    const names = ["Atlas", "Malika", "Aziza", "Amir", "Sanjar", "Nodira"];
    const html = plain(render(fixture({ locale: "uz-latn", eventType: "corporate", names })));
    expect(html).toContain('lang="uz-Latn"');
    expect(html).toContain('data-name-count="6"');
    expect(html).toContain("Tadbirga taklifnoma");
    expect(html).toContain("29-fevral, 2028");
    expect(html).toContain("Xaritani ochish");
    expect(html).toContain("Javobingiz");
    expect(html).not.toContain("To‘yga");
    names.forEach((name, index) => expect(html).toContain(`data-studio-field="hosts.${index}.name">${name}`));
    const solo = plain(render(fixture({ eventType: "birthday", names: ["Элеонора"], closing: "" })));
    expect(solo).toContain('data-name-count="1"');
    expect(solo).toContain("Приглашение на день рождения");
    expect(solo).not.toContain('class="sg-ampersand"');
  });

  it("shows the RSVP slot only when supplied and enabled", () => {
    expect(render(fixture(), false)).not.toContain('data-section="rsvp"');
    expect(render(fixture({ enabledSections: ["rsvp"] }))).toContain('data-section="rsvp"');
    expect(render(fixture({ enabledSections: ["rsvp"] }))).not.toContain('data-section="opening"');
  });
});
