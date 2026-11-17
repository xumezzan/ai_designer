import { expect, test, vi } from "vitest";
import { Content } from "@/lib/schema/content";
import { eventDate, eventDateParts } from "./date";
import { invitationMonth } from "./month";

const event = (
  date: Partial<Content["date"]>,
  locale: Content["locale"] = "uz-latn",
) =>
  Content.parse({
    slug: "localized-date",
    locale,
    eventType: "wedding",
    hosts: [{ name: "Malika" }],
    date: {
      start: "",
      timezone: "Asia/Tashkent",
      showCountdown: false,
      ...date,
    },
    venue: { name: "", address: "" },
  });

/** Simulate a browser with no usable Uzbek locale data. Merely checking
 * supportedLocalesOf does not detect ICU builds that emit M10 placeholders. */
function withoutUzbekIcu(assertions: () => void) {
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  const formatter = vi
    .spyOn(Intl, "DateTimeFormat")
    .mockImplementation(function (...args) {
      const requested = Array.isArray(args[0]) ? args[0] : [args[0]];
      if (requested.some((locale) => String(locale).startsWith("uz")))
        throw new RangeError("Uzbek ICU unavailable");
      return new NativeDateTimeFormat(...args);
    });
  try {
    assertions();
  } finally {
    formatter.mockRestore();
  }
}

test("Uzbek event date and calendar names require no Uzbek ICU data", () => {
  const content = event({ start: "2027-10-16T17:30:00+05:00" });
  withoutUzbekIcu(() => {
    expect(eventDate(content)).toEqual({
      day: "16",
      month: "oktabr",
      year: "2027",
      weekday: "shanba",
      time: "17:30",
      full: "16-oktabr, 2027",
    });
    const month = invitationMonth(content);
    expect(month.title).toBe("oktabr, 2027");
    expect(month.weekdays).toEqual([
      "Dush",
      "Sesh",
      "Chor",
      "Pay",
      "Jum",
      "Shan",
      "Yak",
    ]);
    expect(month.selected).toBe(16);
    expect(month.cells.indexOf(16) % 7).toBe(5);
  });
});

test("Uzbek labels and selected calendar day follow the event zone across month and year boundaries", () => {
  withoutUzbekIcu(() => {
    const october = event({ start: "2027-09-30T22:45:00Z" });
    expect(eventDate(october)).toMatchObject({
      day: "01",
      month: "oktabr",
      weekday: "juma",
      time: "03:45",
      full: "1-oktabr, 2027",
    });
    expect(invitationMonth(october)).toMatchObject({
      year: 2027,
      month: 10,
      selected: 1,
      title: "oktabr, 2027",
    });
    const previousYear = event({
      start: "2027-01-01T00:30:00Z",
      timezone: "America/Los_Angeles",
    });
    expect(eventDate(previousYear)).toMatchObject({
      day: "31",
      month: "dekabr",
      year: "2026",
      weekday: "payshanba",
      time: "16:30",
    });
    expect(invitationMonth(previousYear)).toMatchObject({
      year: 2026,
      month: 12,
      selected: 31,
      title: "dekabr, 2026",
    });
  });
});

test("a date-only Uzbek leap day stays a civil day in every event zone and has no invented time", () => {
  withoutUzbekIcu(() => {
    for (const timezone of [
      "Pacific/Kiritimati",
      "America/Los_Angeles",
      "Asia/Tashkent",
    ]) {
      const content = event({ day: "2028-02-29", timezone });
      expect(eventDate(content)).toEqual({
        day: "29",
        month: "fevral",
        year: "2028",
        weekday: "seshanba",
        time: "",
        full: "29-fevral, 2028",
      });
      const month = invitationMonth(content);
      expect(month).toMatchObject({
        year: 2028,
        month: 2,
        selected: 29,
        title: "fevral, 2028",
      });
      expect(month.cells.filter((day) => day !== null)).toHaveLength(29);
      expect(month.cells.indexOf(29) % 7).toBe(1);
    }
  });
});

test("numeric extraction preserves an explicit DST-overlap instant and local midnight uses 00 hours", () => {
  expect(
    eventDateParts(
      event({
        start: "2027-11-07T01:30:41-04:00",
        timezone: "America/New_York",
      }).date,
    ),
  ).toMatchObject({
    year: 2027,
    month: 11,
    day: 7,
    hour: 1,
    minute: 30,
    weekday: 0,
  });
  expect(eventDate(event({ start: "2027-10-15T19:05:00Z" }))).toMatchObject({
    day: "16",
    month: "oktabr",
    time: "00:05",
  });
});

test("Russian and English retain their existing Intl date and weekday formatting", () => {
  for (const locale of ["ru", "en"] as const) {
    const content = event({ start: "2027-04-24T22:30:00Z" }, locale);
    const instant = new Date(content.date.start);
    const format = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, {
        timeZone: content.date.timezone,
        ...options,
      }).format(instant);
    expect(eventDate(content)).toMatchObject({
      full: format({ day: "numeric", month: "long", year: "numeric" }),
      weekday: format({ weekday: "long" }),
      time: format({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    });
    expect(invitationMonth(content).title).toBe(
      format({ month: "long", year: "numeric" }),
    );
  }
});

test("an empty Uzbek event exposes no invented date fields", () => {
  expect(eventDate(event({}))).toEqual({
    day: "",
    month: "",
    year: "",
    weekday: "",
    time: "",
    full: "",
  });
});
