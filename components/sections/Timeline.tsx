import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { ItalicAccents } from "@/components/craft/ItalicAccents";
import { FittedHeadingText } from "@/components/primitives/FittedHeadingText";

export function Timeline({ content, accentWords, heading, headingMeasure }: SectionProps) {
  if (!content.timeline.length) return null;
  const t = (text: string) => <ItalicAccents text={typograph(text, content.locale)} words={accentWords} locale={content.locale} />;
  return <section id="timeline" className="invitation-section timeline-section" data-section="timeline" aria-labelledby="timeline-title">
    <div className="timeline-heading"><span className="section-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none" width="40" height="40"><circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth=".8" /><path d="M20 10v10l7 4M20 3v3M37 20h-3M20 37v-3M3 20h3" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" /></svg></span><h2 data-level="display-sm" id="timeline-title" data-fit-display={headingMeasure !== undefined || undefined}><FittedHeadingText measure={headingMeasure}>{t(heading || labels[content.locale].timeline)}</FittedHeadingText></h2></div>
    <ol className="timeline-list">{content.timeline.map((item, index) => <li key={index}>
      <time data-level="lead">{item.time}</time><div><h3 data-level="lead">{t(item.title)}</h3>{item.note && <p data-level="body">{t(item.note)}</p>}</div><span className="timeline-index" data-level="small" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
    </li>)}</ol>
  </section>;
}
