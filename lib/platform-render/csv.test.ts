import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("guest response CSV", () => {
  it("neutralizes formulas including leading whitespace", () => {
    for (const text of [
      "=SUM(1)",
      "+1",
      "@SUM(1)",
      "-1+2",
      "  =HYPERLINK(1)",
      "\tname",
    ])
      expect(csvCell(text)).toBe(`"'${text}"`);
  });
  it("quotes punctuation and preserves multilingual text", () => {
    expect(csvCell('Азиз, "Malika"')).toBe('"Азиз, ""Malika"""');
    expect(csvCell("O‘zbekcha\nПривет")).toBe('"O‘zbekcha\nПривет"');
    expect(csvCell(null)).toBe('""');
  });
});
