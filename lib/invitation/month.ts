import type { Content } from "@/lib/schema/content";
import { langFor } from "./locale";

/** The event's civil date, not the server's date or the offset in its ISO string. */
export function invitationMonth(content: Pick<Content, "date" | "locale">) {
  const instant = new Date(content.date.start || `${content.date.day}T12:00:00Z`);
  const fields = new Intl.DateTimeFormat("en", { timeZone: content.date.start ? content.date.timezone : "UTC", calendar: "gregory", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(instant);
  const field = (name: string) => Number(fields.find((part) => part.type === name)!.value);
  const year = field("year"), month = field("month"), selected = field("day");
  const first = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((first + length) / 7) * 7 }, (_, i) => i < first || i >= first + length ? null : i - first + 1);
  const locale = langFor(content.locale);
  const title = new Intl.DateTimeFormat(locale, { timeZone: content.date.start ? content.date.timezone : "UTC", month: "long", year: "numeric" }).format(instant);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(2024, 0, i + 1))));
  return { year, month, selected, title, weekdays, cells };
}
