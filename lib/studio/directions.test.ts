import { expect, test } from "vitest";
import { directionFor, directions } from "./directions";

test.each(directions)("the current $id brief selects its mood", (direction) => {
  expect(directionFor(direction.brief)?.id).toBe(direction.id);
});

test.each([
  ["paper", "Светлое редакционное приглашение на хлопковой бумаге. Кремовый фон, графитовый текст, тонкие линии и слепое тиснение. Крупная элегантная типографика, много воздуха, спокойное камерное настроение."],
  ["velvet", "Торжественное приглашение: глубокий винный бархат, тёплая золотая фольга, тонкий орнамент и мягкий свет. Элегантная типографика, ощущение тёплого семейного вечера. Сдержанная отделка без избыточного декора."],
  ["night", "Современное вечернее приглашение: глубокий синий фон, матовый камень, серебряные акценты и тонкая геометрическая рамка. Выразительная типографика и чистая композиция. Сдержанное, архитектурное настроение."],
  ["garden", "Нежное ботаническое приглашение: шалфей, молочная бумага, деликатные растительные мотивы и мягкая типографика. Естественное камерное настроение, свободная композиция и много воздуха. Без пышных цветочных рамок."],
])("a saved %s project retains its mood after the curated brief changes", (id, brief) => {
  expect(directionFor(brief)?.id).toBe(id);
});

test("a custom brief does not acquire a preset or get rewritten", () => {
  expect(directionFor("Бархат, но без золота и без орнаментов.")).toBeUndefined();
  expect(directionFor(undefined)).toBeUndefined();
});
