import type { ReactNode } from "react";
import type { SectionProps } from "./types";
import { eventDate } from "@/lib/invitation/date";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";

export function Hero({ content, title, titleWrapper, nextTarget }: SectionProps & { title: ReactNode; titleWrapper: (node: ReactNode) => ReactNode; nextTarget?: { id: string; label: string } }) {
  const date = eventDate(content);
  const t = (text: string) => typograph(text, content.locale);
  return <section className="invitation-hero" id="hero" aria-labelledby="hero-title" data-section="hero">
    <div className="hero-opening"><p data-level="body">{t(labels[content.locale].invitation)}</p><span className="hero-line" aria-hidden="true" /></div>
    <div className="hero-name-group">{titleWrapper(<h1 data-level="display" id="hero-title">{title}</h1>)}</div>
    <time className="hero-date" dateTime={content.date.start} aria-label={t(`${date.full}, ${date.weekday}, ${date.time}`)}>
      <span className="hero-day" data-level="display">{date.day}</span>
      <span className="hero-date-copy"><span data-level="lead">{t(`${date.month} ${date.year}`)}</span><span data-level="body">{t(`${date.weekday} · ${date.time}`)}</span></span>
    </time>
    <div className="hero-place" data-level="body"><span>{t(content.venue.name)}</span><span>{t(content.venue.address)}</span></div>
    {nextTarget && <a href={`#${nextTarget.id}`} className="hero-next" aria-label={nextTarget.label}><span aria-hidden="true">↓</span></a>}
  </section>;
}
