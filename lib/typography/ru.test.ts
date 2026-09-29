/**
 * One test per craft-layer rule (SPEC §7.1). If a rule changes, its test
 * changes in the same commit.
 */
import { describe, expect, it } from "vitest";
import {
  EM_DASH,
  NBSP,
  SHORT_WORDS,
  THIN_SPACE,
  UZ_OCHEL,
  UZ_TUTUQ,
  emDash,
  nbspAfterShortWords,
  nbspInDates,
  nbspInInitials,
  nbspNumberUnit,
  quotes,
  typograph,
  uzbekApostrophes,
} from "./ru";

describe("quotes", () => {
  it("puts guillemets at the first level", () => {
    expect(quotes('"Зелихан"')).toBe("«Зелихан»");
    expect(quotes("Азиз приглашает: \"торжество\"")).toBe("Азиз приглашает: «торжество»");
  });

  it("puts „ “ at the second level", () => {
    expect(quotes('"Привет, "Зелихан"!"')).toBe("«Привет, „Зелихан“!»");
  });

  it("closes in the reverse order of opening through three levels", () => {
    expect(quotes('"он сказал "я читал "мастер" давно""')).toBe(
      "«он сказал „я читал «мастер» давно“»",
    );
  });

  it("tracks manually typed guillemets so mixed input nests correctly", () => {
    expect(quotes('«торжество "Зелихан"»')).toBe("«торжество „Зелихан“»");
  });

  it("treats a mark between two letters as an apostrophe, not a quote", () => {
    expect(quotes("O'zbekiston")).toBe("O'zbekiston");
  });
});

describe("dashes", () => {
  it("uses a real em dash with a non-breaking space before and a thin space after", () => {
    expect(emDash("Ташкент - столица")).toBe(`Ташкент${NBSP}${EM_DASH}${THIN_SPACE}столица`);
  });

  it("normalises an em dash that already had ordinary spaces around it", () => {
    expect(emDash("Ташкент — столица")).toBe(`Ташкент${NBSP}${EM_DASH}${THIN_SPACE}столица`);
  });

  it("leaves compounds and phone numbers alone", () => {
    expect(emDash("из-за дождя")).toBe("из-за дождя");
    expect(emDash("кое-что")).toBe("кое-что");
    expect(emDash("+998 90 123-45-67")).toBe("+998 90 123-45-67");
  });

  it("sets year ranges as an em dash without spaces", () => {
    expect(emDash("1920-1990")).toBe(`1920${EM_DASH}1990`);
    expect(emDash("1920 - 1990")).toBe(`1920${EM_DASH}1990`);
  });

  it("does not touch a dash that opens direct speech", () => {
    expect(emDash("— Привет")).toBe("— Привет");
  });
});

describe("non-breaking spaces", () => {
  it("glues one- and two-letter prepositions and conjunctions to the next word", () => {
    expect(nbspAfterShortWords("в Ташкенте")).toBe(`в${NBSP}Ташкенте`);
    expect(nbspAfterShortWords("мы и вы")).toBe(`мы и${NBSP}вы`);
    expect(nbspAfterShortWords("не откажем")).toBe(`не${NBSP}откажем`);
  });

  it("does not glue inside a longer word", () => {
    expect(nbspAfterShortWords("восток")).toBe("восток");
    expect(nbspAfterShortWords("кот")).toBe("кот");
  });

  it("glues the number to its unit", () => {
    expect(nbspNumberUnit("5 км от центра")).toBe(`5${NBSP}км от центра`);
    expect(nbspNumberUnit("20 °C")).toBe(`20${NBSP}°C`);
    expect(nbspNumberUnit("100 % гостей")).toBe(`100${NBSP}% гостей`);
    expect(nbspNumberUnit("1 000 сум")).toBe(`1 000${NBSP}сум`);
  });

  it("glues initials to each other and to the surname", () => {
    expect(nbspInInitials("А. П. Чехов")).toBe(`А.${NBSP}П.${NBSP}Чехов`);
    expect(nbspInInitials("А.П. Чехов")).toBe(`А.${NBSP}П.${NBSP}Чехов`);
  });

  it("does not break a date", () => {
    expect(nbspInDates("12 июня 2027")).toBe(`12${NBSP}июня${NBSP}2027`);
    expect(nbspInDates("сбор в 12 июня")).toBe(`сбор в 12${NBSP}июня`);
    expect(nbspInDates("2027 г.")).toBe(`2027${NBSP}г.`);
  });
});

describe("Uzbek Latin apostrophes", () => {
  it("uses U+02BB after O/o and G/g", () => {
    expect(uzbekApostrophes("O'zbekiston")).toBe(`O${UZ_OCHEL}zbekiston`);
    expect(uzbekApostrophes("G'ani")).toBe(`G${UZ_OCHEL}ani`);
  });

  it("uses U+02BC everywhere else", () => {
    expect(uzbekApostrophes("ma'no")).toBe(`ma${UZ_TUTUQ}no`);
    expect(uzbekApostrophes("san'at")).toBe(`san${UZ_TUTUQ}at`);
  });

  it("normalises curly quotes typed instead of an apostrophe", () => {
    expect(uzbekApostrophes("ma’no")).toBe(`ma${UZ_TUTUQ}no`);
  });
});

describe("typograph", () => {
  const paragraph =
    'А. П. Чехов писал в Ташкенте - город ждал гостей 12 июня 2027, зал на 120 мест, 5 км от центра.';

  it("applies every rule at once", () => {
    const out = typograph(paragraph);
    expect(out).toContain(`А.${NBSP}П.${NBSP}Чехов`);
    expect(out).toContain(`в${NBSP}Ташкенте`);
    expect(out).toContain(`${NBSP}${EM_DASH}${THIN_SPACE}город`);
    expect(out).toContain(`12${NBSP}июня${NBSP}2027`);
    expect(out).toContain(`5${NBSP}км`);
  });

  it("leaves no short word followed by a breakable space", () => {
    const out = typograph(paragraph);
    expect(out).not.toMatch(
      new RegExp(`(?:^|[ ])(?:${SHORT_WORDS.join("|")})[ ]`, "gu"),
    );
  });

  it("is idempotent", () => {
    const once = typograph(paragraph);
    expect(typograph(once)).toBe(once);
  });

  it("applies Uzbek apostrophes and leaves Russian short words alone", () => {
    const out = typograph("O'zbekiston va san'at", "uz-latn");
    expect(out).toContain(UZ_OCHEL);
    expect(out).toContain(UZ_TUTUQ);
  });

  it("leaves English untouched rather than half-applying Russian rules", () => {
    const text = 'Anton Chekhov wrote in Tashkent - the hall holds 120 guests.';
    expect(typograph(text, "en")).toBe(text);
  });

  it("does not quote a straight mark used as an apostrophe inside a Russian sentence", () => {
    expect(typograph("O'zbekiston", "ru")).toBe("O'zbekiston");
  });
});
