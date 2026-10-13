import type { Content } from "../schema/content";
import { langFor } from "./locale";

export function eventDate(content: Content) {
  if (!content.date.start && !content.date.day) return { day: "", month: "", year: "", weekday: "", time: "", full: "" };
  const date = new Date(content.date.start || `${content.date.day}T12:00:00Z`);
  const base = { timeZone: content.date.start ? content.date.timezone : "UTC" };
  const locale = langFor(content.locale);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...base, ...options }).format(date);
  const month = new Intl.DateTimeFormat(locale, { ...base, day: "numeric", month: "long" }).formatToParts(date).find((part) => part.type === "month")!.value;
  return { day: format({ day: "2-digit" }), month, year: format({ year: "numeric" }),
    weekday: format({ weekday: "long" }), time: content.date.start ? format({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "",
    full: format({ day: "numeric", month: "long", year: "numeric" }) };
}

export function remainingTime(start: string, now: number) {
  const total = Math.max(0, Math.ceil((Date.parse(start) - now) / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60, seconds: total % 60, arrived: total === 0 };
}
