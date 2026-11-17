import type { Content } from "@/lib/schema/content";
import { langFor } from "./locale";
import { eventDateParts, UZBEK_CALENDAR } from "./date";

/** The event's civil date, not the server's date or the offset in its ISO string. */
export function invitationMonth(content: Pick<Content, "date" | "locale">) {
  const {
    instant,
    timeZone,
    year,
    month,
    day: selected,
  } = eventDateParts(content.date);
  const first = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from(
    { length: Math.ceil((first + length) / 7) * 7 },
    (_, i) => (i < first || i >= first + length ? null : i - first + 1),
  );
  const locale = langFor(content.locale);
  const title =
    content.locale === "uz-latn"
      ? `${UZBEK_CALENDAR.months[month - 1]}, ${year}`
      : new Intl.DateTimeFormat(locale, {
          timeZone,
          month: "long",
          year: "numeric",
        }).format(instant);
  const weekdays =
    content.locale === "uz-latn"
      ? [
          ...UZBEK_CALENDAR.weekdaysShort.slice(1),
          UZBEK_CALENDAR.weekdaysShort[0],
        ]
      : Array.from({ length: 7 }, (_, i) =>
          new Intl.DateTimeFormat(locale, {
            timeZone: "UTC",
            weekday: "short",
          }).format(new Date(Date.UTC(2024, 0, i + 1))),
        );
  return { year, month, selected, title, weekdays, cells };
}
