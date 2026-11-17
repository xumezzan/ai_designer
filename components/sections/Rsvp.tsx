import type { SectionProps } from "./types";
import { labels, langFor, experienceLabels } from "@/lib/invitation/locale";
import { rsvpTarget } from "@/lib/invitation/links";
import { typograph } from "@/lib/typography/ru";
import { Calendar } from "./Calendar";
import { RsvpForm } from "./RsvpForm";
import { ItalicAccents } from "@/components/craft/ItalicAccents";

export function Rsvp({ content, guest, accentWords }: SectionProps & { guest?: string }) {
  const rsvp = content.rsvp;
  if (!rsvp?.enabled) return null;
  const copy = labels[content.locale];
  const t = (text: string) => <ItalicAccents text={typograph(text, content.locale)} words={accentWords} locale={content.locale} />;
  const target = rsvpTarget(rsvp.mode, rsvp.target);
  const deadline = rsvp.deadline ? new Intl.DateTimeFormat(langFor(content.locale), {
    day: "numeric", month: "long", timeZone: /^\d{4}-\d{2}-\d{2}$/.test(rsvp.deadline) ? "UTC" : content.date.timezone,
  }).format(new Date(rsvp.deadline)) : undefined;
  return <section id="rsvp" className="invitation-section rsvp-section" data-section="rsvp" aria-labelledby="rsvp-title">
    <div className="rsvp-heading"><p data-level="small" className="section-eyebrow"><ItalicAccents text={experienceLabels[content.locale].response} words={accentWords} locale={content.locale} /></p><h2 data-level="display-sm" id="rsvp-title">{t(copy.rsvp)}</h2><span className="rsvp-flourish" aria-hidden="true">↗</span><span className="paper-wax-seal" aria-hidden="true"><span>{content.hosts.map((host) => Array.from(host.name.trim())[0]).join("·")}</span></span></div>
    <div className="rsvp-copy">
    {deadline && <p data-level="body">{t(`${copy.deadline} ${deadline}.`)}</p>}
    {rsvp.mode === "form" ? <RsvpForm target={target} locale={content.locale} askGuestCount={rsvp.askGuestCount} guest={guest} /> : <>
      {rsvp.askGuestCount && <p data-level="body">{t(copy.guestsNote)}</p>}
      <a className="invitation-button" data-level="small" href={target} data-magnetic><ItalicAccents text={rsvp.mode === "phone" ? copy.phone : copy.reply} words={accentWords} locale={content.locale} /><span aria-hidden="true">↗</span></a>
    </>}
    <Calendar content={content} />
    </div>
  </section>;
}
