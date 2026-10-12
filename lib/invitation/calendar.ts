import type { Content } from "../schema/content";

const timestamp = (date: string) => new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[,;]/g, "\\$&");

// RFC 5545 folding counts UTF-8 octets, including the continuation space.
function fold(line: string) {
  let result = "", length = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (length + bytes > 75) { result += "\r\n "; length = 1; }
    result += char;
    length += bytes;
  }
  return result;
}

export function calendarLinks(content: Content) {
  const title = content.headline || content.hosts.map((host) => host.name).join(" & ");
  const location = `${content.venue.name}, ${content.venue.address}`;
  const start = timestamp(content.date.start);
  const description = content.venue.note || "";
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Invitation Studio//Invitation//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${escapeText(content.slug)}@invitation.local`, `DTSTAMP:${timestamp(new Date().toISOString())}`, `DTSTART:${start}`,
    `SUMMARY:${escapeText(title)}`, `LOCATION:${escapeText(location)}`, `DESCRIPTION:${escapeText(description)}`,
    "END:VEVENT", "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
  // No end time is supplied by the host; save a point-in-time event.
  const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${start}/${start}`, location, details: description, ctz: content.date.timezone });
  return { google: `https://calendar.google.com/calendar/render?${params}`, ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` };
}
