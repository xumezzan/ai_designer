import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvitationCanvas } from "./InvitationCanvas";
import { createEmptyDraft, type InvitationDraft } from "@/lib/platform/schema";

const artwork = { id: "11111111-1111-4111-8111-111111111111", src: "/api/platform/media/11111111-1111-4111-8111-111111111111" };
const draft: InvitationDraft = { ...createEmptyDraft("classic"), names: ["София", "Александр"], title: "PRIVATE MANAGEMENT TITLE",
  date: { day: "2028-06-19", time: "18:00", timezone: "Asia/Tashkent", showCountdown: true },
  greeting: "Дорогие близкие!", story: "Наша собственная история.", closing: "С любовью и теплом",
  venue: { name: "Сад встреч", address: "Ташкент" }, timeline: [{ time: "18:00", title: "Начало вечера" }],
  enabledSections: ["opening", "greeting", "story", "date", "venue", "timeline", "rsvp", "closing"],
  artwork, artDirection: { title: "Шёлковая история", scene: "silk", layout: "editorial" },
};
const render = (value = draft) => renderToStaticMarkup(<InvitationCanvas draft={value} initialNow={0} embedded rsvp={<section id="rsvp" data-section="rsvp"><form action="/reply"><button>Ответить</button></form></section>} />).replace(/\u00a0/g, " ");

test("material routing uses distinct live cover compositions and preserves semantic content", () => {
  for (const [scene, layout] of [["silk", "editorial"], ["night-garden", "immersive"], ["porcelain", "keepsake"]] as const) {
    const html = render({ ...draft, artDirection: { title: scene, scene, layout } });
    expect(html).toContain(`data-scene="${scene}" data-layout="${layout}"`);
    expect(html).toContain(`class="material-site-${layout}-cover"`);
    expect(html).toContain(`src="${artwork.src}"`);
    expect(html).toContain('data-studio-field="hosts.0.name">София');
    expect(html).toContain('data-studio-field="venue.name"');
    expect(html).toContain("Начало вечера");
    expect(html).not.toContain("PRIVATE MANAGEMENT TITLE");
    expect([...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1])).toEqual(["hero", "greeting", "story", "countdown", "venue", "timeline", "rsvp", "footer"]);
  }
});

test("personal material greeting retains artwork and whole photographs without leaking event controls", () => {
  const photo = { id: "22222222-2222-4222-8222-222222222222", src: "/api/platform/media/22222222-2222-4222-8222-222222222222" };
  const html = render({ ...draft, purpose: "greeting", eventType: "birthday", names: ["Амира"], headline: "Для тебя, Амира!", media: [photo] });
  expect(html).toContain('data-studio-field="headline">Для тебя, Амира!');
  expect(html).toContain(`src="${artwork.src}"`);
  expect(html.match(new RegExp(`src="${photo.src}"`, "g"))).toHaveLength(1);
  expect(html).not.toContain("Сад встреч");
  expect(html).not.toContain("Начало вечера");
  expect(html).not.toContain("2028-06-19");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("calendar");
  expect(html).not.toContain("<dialog");
});

test("material direction takes precedence over dedicated legacy renderer and optional blocks remain absent", () => {
  const html = render({ ...draft, templateId: "sculpted-garden", enabledSections: ["opening", "closing"] });
  expect(html).toContain('class="invitation material-site"');
  expect(html).not.toContain("Дорогие близкие!");
  expect(html).not.toContain("Наша собственная история.");
  expect(html).not.toContain("Сад встреч");
  expect(html).not.toContain("<form");
  expect(html).toContain('href="#footer"');
});

test("unfinished draft never substitutes collection artwork for a missing original image", () => {
  const html = render({ ...draft, artwork: undefined });
  expect(html).toContain('data-artwork="pending"');
  expect(html).not.toContain("/artwork/");
  expect(html).toContain('data-studio-field="hosts.0.name">София');
});

test("a photos-only story takes its accessible name from the gallery heading", () => {
  const photo = { id: "22222222-2222-4222-8222-222222222222", src: "/api/platform/media/22222222-2222-4222-8222-222222222222" };
  const html = render({ ...draft, purpose: "greeting", story: "  ", media: [photo] });
  expect(html).toContain('id="story" class="material-site-chapter material-site-story" data-section="story" aria-labelledby="material-story-title"');
  expect(html).toContain('<h2 id="material-story-title">Тёплые воспоминания</h2>');
  expect(html).not.toContain('data-studio-field="story"');
});

test("a long personal letter preserves all paragraphs in one editable source with a dedicated reading layout", () => {
  const paragraphs = ["Дорогая Лейла,", "Пусть сегодня будет много света и радости.", "Желаю вдохновения для новых замыслов и времени для себя.", "Пусть впереди будет много счастливых открытий."];
  const html = render({ ...draft, purpose: "greeting", greeting: paragraphs.join("\n\n") });
  expect(html).toContain('class="material-greeting"');
  expect(html).not.toContain('class="invitation-section greeting-section"');
  expect(html.match(/data-studio-field="greeting"/g)).toHaveLength(1);
  expect([...html.matchAll(/data-greeting-part="([^"]+)"/g)].map((match) => match[1])).toEqual(["salutation", "opening", "wishes", "afterword"]);
  for (const paragraph of paragraphs) expect(html).toContain(paragraph);
});
