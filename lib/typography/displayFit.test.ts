import { expect, test } from "vitest";
import { displayTokenMeasure } from "./displayFit";

test("wide display fonts reserve enough width for complete Cyrillic words", () => {
  // Browser canvas measurements with the bundled faces: 10.581em for this
  // Unbounded word; 9.287em + 0.825em tracking for uppercase Tenor Sans.
  expect(displayTokenMeasure("Константиновна", "modernist")).toBeGreaterThan(10.581);
  expect(displayTokenMeasure("С\u00a0тёплыми пожеланиями", "gallery", true)).toBeGreaterThan(10.112);
  expect(displayTokenMeasure("Константиновна", "modernist")).toBeGreaterThan(displayTokenMeasure("Константиновна", "ceremony"));
});

test("fits the longest natural token, preserving spaces, hyphens and short nonbreaking phrases", () => {
  expect(displayTokenMeasure("Александра-Екатерина Константиновна", "modernist")).toBe(displayTokenMeasure("Константиновна", "modernist"));
  expect(displayTokenMeasure("До\u00a0праздника", "modernist")).toBeGreaterThan(displayTokenMeasure("До праздника", "modernist"));
  expect(displayTokenMeasure("С днём рождения", "gallery", true)).toBeGreaterThan(displayTokenMeasure("С днём рождения", "gallery"));
  expect(displayTokenMeasure("", "editorial")).toBeGreaterThan(0);
  expect(Number.isFinite(displayTokenMeasure("未知文字", "gallery"))).toBe(true);
});
