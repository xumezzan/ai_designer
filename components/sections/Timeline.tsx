import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";

export function Timeline({ content }: SectionProps) {
  if (!content.timeline.length) return null;
  const t = (text: string) => typograph(text, content.locale);
  return <section id="timeline" className="invitation-section timeline-section" data-section="timeline" aria-labelledby="timeline-title">
    <h2 data-level="display-sm" id="timeline-title">{t(labels[content.locale].timeline)}</h2>
    <ol className="timeline-list">{content.timeline.map((item, index) => <li key={index}>
      <time data-level="lead">{item.time}</time><div><h3 data-level="lead">{t(item.title)}</h3>{item.note && <p data-level="body">{t(item.note)}</p>}</div>
    </li>)}</ol>
  </section>;
}
