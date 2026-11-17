import type { Content } from "../schema/content";
import { langFor } from "./locale";

// Uzbek Gregorian labels and long-date pattern follow Unicode CLDR. Keep them
// deterministic: some browser ICU builds return "M10" and English weekdays
// even though they report uz-Latn as supported.
// https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-dates-full/main/uz/ca-gregorian.json
export const UZBEK_CALENDAR = {
  months: [
    "yanvar",
    "fevral",
    "mart",
    "aprel",
    "may",
    "iyun",
    "iyul",
    "avgust",
    "sentabr",
    "oktabr",
    "noyabr",
    "dekabr",
  ],
  weekdays: [
    "yakshanba",
    "dushanba",
    "seshanba",
    "chorshanba",
    "payshanba",
    "juma",
    "shanba",
  ],
  weekdaysShort: ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"],
} as const;

/** Numeric Gregorian fields use the event zone and never depend on the
 * availability of translated month or weekday names in the current ICU build. */
export function eventDateParts(date: Content["date"]) {
  const instant = new Date(date.start || `${date.day}T12:00:00Z`);
  const timeZone = date.start ? date.timezone : "UTC";
  const fields = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const field = (name: Intl.DateTimeFormatPartTypes) =>
    Number(fields.find((part) => part.type === name)!.value);
  const year = field("year"),
    month = field("month"),
    day = field("day");
  const civilDay = new Date(0);
  civilDay.setUTCFullYear(year, month - 1, day);
  return {
    instant,
    timeZone,
    year,
    month,
    day,
    weekday: civilDay.getUTCDay(),
    hour: field("hour"),
    minute: field("minute"),
  };
}

export function eventDate(content: Content) {
  if (!content.date.start && !content.date.day)
    return { day: "", month: "", year: "", weekday: "", time: "", full: "" };
  if (content.locale === "uz-latn") {
    const parts = eventDateParts(content.date);
    const month = UZBEK_CALENDAR.months[parts.month - 1];
    const pad = (value: number) => String(value).padStart(2, "0");
    return {
      day: pad(parts.day),
      month,
      year: String(parts.year),
      weekday: UZBEK_CALENDAR.weekdays[parts.weekday],
      time: content.date.start ? `${pad(parts.hour)}:${pad(parts.minute)}` : "",
      full: `${parts.day}-${month}, ${parts.year}`,
    };
  }
  const date = new Date(content.date.start || `${content.date.day}T12:00:00Z`);
  const base = { timeZone: content.date.start ? content.date.timezone : "UTC" };
  const locale = langFor(content.locale);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...base, ...options }).format(date);
  const month = new Intl.DateTimeFormat(locale, {
    ...base,
    day: "numeric",
    month: "long",
  })
    .formatToParts(date)
    .find((part) => part.type === "month")!.value;
  return {
    day: format({ day: "2-digit" }),
    month,
    year: format({ year: "numeric" }),
    weekday: format({ weekday: "long" }),
    time: content.date.start
      ? format({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      : "",
    full: format({ day: "numeric", month: "long", year: "numeric" }),
  };
}

export function remainingTime(start: string, now: number) {
  const total = Math.max(0, Math.ceil((Date.parse(start) - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
    arrived: total === 0,
  };
}
