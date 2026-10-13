import type { ReactNode } from "react";
import type { SectionProps } from "./types";
import { eventDate } from "@/lib/invitation/date";
import { experienceLabels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";

export function Hero({ content, title, titleWrapper, nextTarget, guest, monogram }: SectionProps & { title: ReactNode; titleWrapper: (node: ReactNode) => ReactNode; nextTarget?: { id: string; label: string }; guest?: string; monogram: string }) {
  const date = eventDate(content);
  const t = (text: string) => typograph(text, content.locale);
  return <section className="invitation-hero" id="hero" aria-labelledby="hero-title" data-section="hero">
    <div className="hero-opening"><p data-level="small">{t(experienceLabels[content.locale][content.eventType])}</p><span className="hero-line" aria-hidden="true" /><span className="hero-edition" data-level="small">{date.year}</span></div>
    <div className="hero-imprint" aria-hidden="true"><span>{monogram}</span></div>
    <div className="hero-name-group">{titleWrapper(<h1 data-level="display" id="hero-title">{title}</h1>)}</div>
    {(content.date.start || content.date.day) && <time data-studio-section="date" className="hero-date" dateTime={content.date.start || content.date.day} aria-label={t(`${date.full}, ${date.weekday}, ${date.time}`)}>
      <span className="hero-day" data-level="display">{date.day}</span>
      <span className="hero-date-copy"><span data-level="lead">{t(`${date.month} ${date.year}`)}</span><span data-level="body">{t(`${date.weekday}${date.time ? ` · ${date.time}` : ""}`)}</span></span>
    </time>}
    <div className="hero-place" data-level="body">{guest && <span className="hero-personal">{t(`${guest}, ${experienceLabels[content.locale].waiting.toLocaleLowerCase()}`)}</span>}<span data-studio-field="venue.name">{t(content.venue.name)}</span><span data-studio-field="venue.address">{t(content.venue.address)}</span></div>
    {nextTarget && <a href={`#${nextTarget.id}`} className="hero-next" aria-label={nextTarget.label}><span className="hero-next-label" data-level="small">{experienceLabels[content.locale].scroll}</span><span aria-hidden="true">↓</span></a>}
  </section>;
}
