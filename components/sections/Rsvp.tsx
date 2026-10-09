import type { SectionProps } from "./types";
import { labels, langFor } from "@/lib/invitation/locale";
import { rsvpTarget } from "@/lib/invitation/links";
import { typograph } from "@/lib/typography/ru";

export function Rsvp({ content }: SectionProps) {
  const rsvp = content.rsvp;
  if (!rsvp?.enabled) return null;
  const copy = labels[content.locale];
  const t = (text: string) => typograph(text, content.locale);
  const target = rsvpTarget(rsvp.mode, rsvp.target);
  const deadline = rsvp.deadline ? new Intl.DateTimeFormat(langFor(content.locale), {
    day: "numeric", month: "long", timeZone: /^\d{4}-\d{2}-\d{2}$/.test(rsvp.deadline) ? "UTC" : content.date.timezone,
  }).format(new Date(rsvp.deadline)) : undefined;
  return <section id="rsvp" className="invitation-section rsvp-section" data-section="rsvp" aria-labelledby="rsvp-title">
    <h2 data-level="display-sm" id="rsvp-title">{t(copy.rsvp)}</h2>
    {deadline && <p data-level="body">{t(`${copy.deadline} ${deadline}.`)}</p>}
    {rsvp.mode === "form" ? <form action={target} method="post" className="rsvp-form">
      <label data-level="body" htmlFor="guest-name">{copy.name}</label><input id="guest-name" name="name" autoComplete="name" required maxLength={120} />
      <label className="rsvp-attendance" data-level="body"><input type="checkbox" name="attendance" value="yes" required />{copy.attendance}</label>
      {rsvp.askGuestCount && <><label data-level="body" htmlFor="guest-count">{copy.guests}</label><input id="guest-count" type="number" name="guests" min={1} max={20} defaultValue={1} required /></>}
      <button className="invitation-button" data-level="body" type="submit">{copy.reply}</button>
    </form> : <>
      {rsvp.askGuestCount && <p data-level="body">{t(copy.guestsNote)}</p>}
      <a className="invitation-button" data-level="body" href={target}>{rsvp.mode === "phone" ? copy.phone : copy.reply}<span aria-hidden="true">↗</span></a>
    </>}
  </section>;
}
