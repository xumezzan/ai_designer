import type { Content } from "@/lib/schema/content";
import { invitationMonth } from "@/lib/invitation/month";
import { eventDate } from "@/lib/invitation/date";
import { experienceLabels } from "@/lib/invitation/locale";
import { Calendar } from "./Calendar";

export function StoryDate({ content }: { content: Content }) {
  const month = invitationMonth(content);
  const date = eventDate(content);
  return <section className="story-date-section" id="story-date" aria-labelledby="story-date-title">
    <div className="story-date-intro"><span className="story-mark" aria-hidden="true">♡</span><p className="story-kicker" data-level="small">{experienceLabels[content.locale].calendar}</p><h2 id="story-date-title" data-level="display-sm">{date.full}</h2><p data-level="body">{date.weekday} · {date.time}</p><Calendar content={content} /></div>
    <table className="story-month" aria-label={month.title}>
      <caption data-level="body">{month.title}</caption>
      <thead><tr>{month.weekdays.map((day, i) => <th scope="col" key={i} data-level="small">{day}</th>)}</tr></thead>
      <tbody>{Array.from({ length: month.cells.length / 7 }, (_, row) => <tr key={row}>{month.cells.slice(row * 7, row * 7 + 7).map((day, col) => <td key={col} data-selected={day === month.selected || undefined} data-level="body">{day === month.selected ? <time dateTime={`${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`} aria-label={date.full}>{day}<svg viewBox="0 0 80 70" aria-hidden="true"><path d="M40 61C28 54 5 38 6 22C7 3 28 1 40 15C53-1 74 5 74 22C74 39 52 54 40 61Z" /></svg></time> : day}</td>)}</tr>)}</tbody>
    </table>
  </section>;
}
