import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Content } from "@/lib/schema/content";
import { eventDate } from "@/lib/invitation/date";
import { Footer } from "@/components/sections/Footer";
import { BriefFacts, applyBriefFacts } from "./briefFacts";
const brief = "Latifa’s great birthday celebration\nДата : 12.07.2026\nМесто : мирас\nДресс код: стиль great gatsby. Цвета : золото, серебро, черный\na little party never killed somebody! See you!";
const draft = Content.parse({ slug: "latifa", locale: "ru", eventType: "wedding", hosts: [{ name: "\n" }, { name: "" }], date: { start: "" }, venue: { name: "", address: "" }, brief });
const facts = BriefFacts.parse({ eventType: { value: "birthday", source: "birthday celebration" }, hosts: { value: ["Latifa"], source: "Latifa’s" }, headline: null, day: { value: "2026-07-12", source: "12.07.2026" }, venue: { value: "Мирас", source: "мирас" }, greeting: null, closing: { value: "a little party never killed somebody! See you!", source: "a little party never killed somebody! See you!" }, dressCode: { value: { title: "Great Gatsby", note: "Золото, серебро, чёрный" }, source: "Дресс код: стиль great gatsby. Цвета : золото, серебро, черный" } });

test("copies explicit birthday facts from the brief without importing a sample age or inventing time/address", () => {
  const content = applyBriefFacts(draft, facts);
  expect(content.eventType).toBe("birthday"); expect(content.hosts).toEqual([{ name: "Latifa" }]);
  expect(content.date).toMatchObject({ start: "", day: "2026-07-12" });
  expect(content.venue).toEqual({ name: "мирас", address: "" });
  expect(content.dressCode?.title.toLowerCase()).toBe("great gatsby");
  expect(content.dressCode?.swatches).toEqual(["#C8A84B", "#B0B8C1", "#0A0A0D"]);
  expect(eventDate(content)).toMatchObject({ day: "12", month: "июля", year: "2026", time: "" });
  expect(renderToStaticMarkup(<Footer content={content} />)).toContain("a little party never killed somebody!");
  expect(draft.eventType).toBe("wedding");
});

test("does not accept unsupported sources, dates from reference text, or replace completed editor fields", () => {
  const content = applyBriefFacts({ ...draft, hosts: [{ name: "Другое имя" }], venue: { name: "Выбранное место", address: "Адрес" }, date: { ...draft.date, start: "2027-01-01T18:00:00+05:00" }, closing: "Своя фраза" }, facts);
  expect(content.hosts[0].name).toBe("Другое имя"); expect(content.eventType).toBe("wedding");
  expect(content.venue.name).toBe("Выбранное место"); expect(content.date.day).toBeUndefined(); expect(content.closing).toBe("Своя фраза");
  const unsafe = applyBriefFacts(draft, { ...facts, hosts: { value: ["Sample from image"], source: "YOUR NAME" }, day: { value: "2024-10-24", source: "24 / 10 / 24" } });
  expect(unsafe.hosts).toEqual(draft.hosts); expect(unsafe.date.day).toBe("2026-07-12");
});

test("a date without a time retains its civil day in every supported timezone", () => {
  for (const timezone of ["Asia/Tashkent", "Pacific/Kiritimati", "America/Los_Angeles"]) {
    const content = applyBriefFacts({ ...draft, date: { ...draft.date, timezone } }, facts);
    expect(eventDate(content)).toMatchObject({ day: "12", year: "2026", time: "" });
  }
});


test("literal Latifa title and labelled facts survive omitted/incorrect model quotes with no extra provider call", () => {
  const text = "1. Страница invitation for Latifa’s great birthday celebration \nДата : 12.07.2026 \nМесто : мирас \n\n3. Заключение : a little party never killed somebody! See you!";
  const next = applyBriefFacts({ ...draft, brief: text, date: { ...draft.date, day: "2026-07-12" } });
  expect(next.hosts).toEqual([{ name: "Latifa" }]);
  expect(next.eventType).toBe("birthday");
  expect(next.headline).toBe("Latifa’s great birthday celebration");
  expect(next.date.start).toBe(""); expect(next.date.day).toBe("2026-07-12");
  expect(next.venue.address).toBe("");
});

test("a brief can extend the invitation with description, route and wishes while keeping the known venue", () => {
  const brief = "Описание: Дорогие друзья, ждём вас на празднике!\n\nБудем рады встрече.\nЛокация: Другой зал\nАдрес: Улица Тестовая, 12\nКарта: https://example.com/map\nКак добраться: Вход со стороны сада\nПожелания: Вместо цветов можно принести книгу.\n\nСпасибо за внимание к этим деталям.\nЗаключение: До скорой встречи!";
  const before = { ...draft, venue: { name: "Мирас", address: "" }, brief };
  const next = applyBriefFacts(before);
  expect(next.venue).toEqual({ name: "Мирас", address: "Улица Тестовая, 12", mapUrl: "https://example.com/map", note: "Вход со стороны сада" });
  expect(next.greeting).toBe("Дорогие друзья, ждём вас на празднике!\n\nБудем рады встрече.");
  expect(next.wishes).toBe("Вместо цветов можно принести книгу.\n\nСпасибо за внимание к этим деталям.");
  expect(next.closing).toBe("До скорой встречи!");
  expect(before.venue.address).toBe("");
  const edited = applyBriefFacts({ ...next, greeting: "Мой текст", wishes: "Мои пожелания", venue: { ...next.venue, address: "Мой адрес" } });
  expect(edited.greeting).toBe("Мой текст"); expect(edited.wishes).toBe("Мои пожелания"); expect(edited.venue.address).toBe("Мой адрес");
});
