import type { Content } from "@/lib/schema/content";
import { calendarLinks } from "@/lib/invitation/calendar";
import { experienceLabels } from "@/lib/invitation/locale";

export function Calendar({ content }: { content: Content }) {
  if (!content.date.start) return null;
  const links = calendarLinks(content);
  return <details className="invitation-calendar">
    <summary data-level="small">{experienceLabels[content.locale].calendar}<span aria-hidden="true">＋</span></summary>
    <div className="calendar-options">
      <a data-level="small" href={links.google} target="_blank" rel="noopener noreferrer">Google Calendar <span aria-hidden="true">↗</span></a>
      <a data-level="small" href={links.ics} download={`${content.slug}.ics`}>Apple / Outlook <span aria-hidden="true">↓</span></a>
    </div>
  </details>;
}
