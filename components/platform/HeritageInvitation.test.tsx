import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createEmptyDraft, type InvitationDraft } from "@/lib/platform/schema";
import { platformTheme } from "@/lib/platform-render/theme";
import { HeritageInvitation } from "./HeritageInvitation";

const draft: InvitationDraft = {
  ...createEmptyDraft("heritage"),
  title: "Private dashboard title",
  names: ["Малика", "Амир"],
  greeting: "Приходите разделить с нами этот день.",
  story: "Мы встретились весной.\n\nТеперь начинается новая глава.",
  date: {
    day: "2028-02-29",
    time: "17:30",
    timezone: "Asia/Tashkent",
    showCountdown: true,
  },
  venue: {
    name: "Сад встреч",
    address: "Ташкент, улица Садовая, 7",
    note: "Вход со стороны парка.",
    mapUrl: "https://example.com/venue",
  },
  timeline: [
    { time: "17:00", title: "Сбор гостей", note: "Встречаемся в саду" },
    { time: "17:30", title: "Церемония" },
  ],
  dressCode: {
    title: "Палитра вечера",
    note: "Мягкие природные оттенки",
    swatches: ["#A07159", "#F0E6D4"],
  },
  closing: "Спасибо, что разделите наш праздник.",
  enabledSections: [
    "opening",
    "greeting",
    "story",
    "date",
    "venue",
    "timeline",
    "dressCode",
    "rsvp",
    "closing",
  ],
  media: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      src: "/api/platform/media/11111111-1111-4111-8111-111111111111",
    },
  ],
};
const rsvp = (
  <section id="rsvp">
    <form action="/api/platform/public/test/rsvp" method="post">
      <input name="name" />
      <button type="submit">Отправить ответ</button>
    </form>
  </section>
);
const markup = (
  event = draft,
  extra: Partial<Parameters<typeof HeritageInvitation>[0]> = {},
) =>
  renderToStaticMarkup(
    <HeritageInvitation
      draft={event}
      embedded
      initialNow={Date.parse("2027-01-01T00:00:00Z")}
      rsvp={rsvp}
      {...extra}
    />,
  ).replace(/\u00a0/g, " ");

test("Heritage renders saved facts, live text and the real response slot in the required semantic order", () => {
  const html = markup();
  expect(html.match(/<h1 /g)).toHaveLength(1);
  expect(html.match(/<main /g)).toHaveLength(1);
  expect(html.match(/<\/main>/g)).toHaveLength(1);
  expect(html).toContain('data-template="heritage"');
  expect(html).toContain('data-font-pair="romantic"');
  expect(html).toContain('data-studio-field="hosts.0.name">Малика');
  expect(html).toContain('data-studio-field="hosts.1.name">Амир');
  expect(html).not.toContain(draft.title);
  for (const value of [
    draft.greeting,
    "Мы встретились весной.",
    draft.venue.name,
    draft.venue.address,
    draft.venue.note!,
    draft.timeline[0].title,
    draft.timeline[0].note!,
    draft.dressCode!.title,
    draft.closing,
  ])
    expect(html).toContain(value);
  expect(html).toContain('dateTime="2028-02-29T12:30:00.000Z"');
  expect(html).toContain('href="https://example.com/venue"');
  expect(html).toContain('action="/api/platform/public/test/rsvp"');
  expect(html).toContain('href="#rsvp"');
  expect(html.match(/<img /g)).toHaveLength(1);
  expect(html).toContain(`src="${draft.media[0].src}"`);
  expect(
    [...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1]),
  ).toEqual([
    "hero",
    "greeting",
    "story",
    "date",
    "countdown",
    "venue",
    "timeline",
    "dressCode",
    "rsvp",
    "footer",
  ]);
});

test("disabled sections leak no event facts, calendar data or response controls", () => {
  const html = markup({ ...draft, enabledSections: [], media: [] });
  for (const value of [
    draft.greeting,
    draft.story!,
    draft.venue.name,
    draft.venue.address,
    draft.venue.note!,
    draft.timeline[0].title,
    draft.dressCode!.title,
    draft.closing,
    "2028-02-29",
    "17:30",
    "calendar.google.com",
    "text/calendar",
    'href="#rsvp"',
    'href="#story"',
    'href="#date"',
    'href="#venue"',
  ])
    expect(html).not.toContain(value);
  expect(html).not.toContain("<form");
  expect(html).not.toContain("hp-entrance");
  expect(
    [...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1]),
  ).toEqual(["hero"]);
});

test("a date without a time preserves the civil day and leap-year month without inventing countdown or calendar instants", () => {
  const html = markup({ ...draft, date: { ...draft.date, time: "" } });
  expect(html).toContain('dateTime="2028-02-29"');
  expect(html).toContain('aria-current="date">29</span>');
  expect(html).not.toContain('data-section="countdown"');
  expect(html).not.toContain("calendar.google.com");
  expect(html).not.toContain("text/calendar");
  expect(html).not.toContain('class="hp-event-time"');
});

test("sparse drafts invent no names, photographs, programme or event facts", () => {
  const html = markup(createEmptyDraft("heritage"), { rsvp: undefined });
  expect(html).toContain("Приглашение");
  for (const value of [
    "Эмма",
    "Даниэль",
    "Шанхай",
    "2027",
    "<img",
    "<form",
    "<audio",
    "calendar.google.com",
    'href="#rsvp"',
  ])
    expect(html).not.toContain(value);
  expect(
    [...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1]),
  ).toEqual(["hero"]);
});

test("the envelope is a progressive enhancement and is absent from embedded previews", () => {
  const publicHtml = markup(draft, { embedded: false });
  const dialog = publicHtml.match(/<dialog[^>]*>/)?.[0];
  expect(dialog).toContain('class="hp-entrance"');
  expect(dialog).not.toMatch(/\sopen(?:=|\s|>)/);
  expect(publicHtml).toContain("Открыть приглашение");
  expect(publicHtml).toContain(draft.venue.name);
  expect(markup()).not.toContain("<dialog");
  expect(
    markup(
      {
        ...draft,
        enabledSections: draft.enabledSections.filter((id) => id !== "opening"),
      },
      { embedded: false },
    ),
  ).not.toContain("<dialog");
});

test("palette and font choices reach the renderer and Uzbek remains a complete supported locale", () => {
  const event = {
    ...draft,
    locale: "uz-latn" as const,
    fontPairId: "modern" as const,
    paletteId: "sage" as const,
  };
  const html = markup(event, { theme: platformTheme(event) });
  expect(html).toContain('lang="uz-Latn"');
  expect(html).toContain('data-font-pair="modern"');
  expect(html).toContain('data-palette="sage"');
  expect(html).toContain(`--hp-red:${platformTheme(event).palette.accent}`);
  expect(html).toContain("To‘y kunimiz");
  expect(html).toContain("Kun dasturi");
  expect(html).toContain("Ishtirokni tasdiqlash");
});

test("slot-only roles retain supplied photographs without inventing empty event sections", () => {
  const html = markup(createEmptyDraft("heritage"), {
    rsvp: undefined,
    sectionSlots: {
      venue: { after: <p>Approved venue photograph</p> },
      rsvp: { before: <p>Approved response photograph</p> },
      wishes: { body: <p>Our personal wishes</p> },
    },
  });
  expect(html).toContain("Approved venue photograph");
  expect(html).toContain("Approved response photograph");
  expect(html).toContain("Our personal wishes");
  expect(html).not.toContain("Открыть карту");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("hp-rsvp-card");
  expect(
    [...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1]),
  ).toEqual(["hero", "venue", "wishes", "rsvp"]);
});

test("authored text stays escaped HTML", () => {
  const html = markup({
    ...draft,
    names: ['<script>alert("name")</script>'],
    story: '<img src=x onerror="alert(1)">',
  });
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<img src=x");
});

test("empty host fields do not shift the studio edit target for a later name", () => {
  const html = markup({ ...draft, names: ["", "Амир"] });
  expect(html).toContain('data-studio-field="hosts.1.name">Амир');
  expect(html).not.toContain('data-studio-field="hosts.0.name"');
});

test("default muted text remains readable on both paper surfaces without a supplied theme", () => {
  const css = readFileSync(
    new URL("./heritage-invitation.css", import.meta.url),
    "utf8",
  );
  const colour = (token: string) =>
    css.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, "i"))![1];
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const ink = luminance(colour("--hp-muted"));
  for (const surface of ["--hp-paper", "--hp-surface"]) {
    const paper = luminance(colour(surface));
    expect(
      (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  }
});
