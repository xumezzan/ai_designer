"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Content } from "@/lib/schema/content";
import { labels, experienceLabels } from "@/lib/invitation/locale";

export function RsvpForm({ target, locale, askGuestCount, guest }: { target: string; locale: Content["locale"]; askGuestCount: boolean; guest?: string }) {
  const [step, setStep] = useState<number | null>(null);
  const name = useRef<HTMLInputElement>(null);
  const attendance = useRef<HTMLInputElement>(null);
  const copy = labels[locale];
  const experience = experienceLabels[locale];
  useEffect(() => setStep(0), []);
  function next() {
    if (name.current?.reportValidity()) { setStep(1); requestAnimationFrame(() => attendance.current?.focus()); }
  }
  function submit(event: FormEvent) {
    if (step === 0) { event.preventDefault(); next(); }
  }
  return <form action={target} method="post" className="rsvp-form" onSubmit={submit}>
    {step !== null && <div className="rsvp-steps" data-level="small" aria-live="polite"><span>{step === 0 ? copy.name : copy.attendance}</span><span>{String(step + 1).padStart(2, "0")} / 02</span></div>}
    <div className="rsvp-form-step" hidden={step === 1}>
      <label data-level="body" htmlFor="guest-name">{copy.name}</label><input ref={name} id="guest-name" name="name" autoComplete="name" required maxLength={120} defaultValue={guest} />
    </div>
    <div className="rsvp-form-step" hidden={step === 0}>
      <label className="rsvp-attendance" data-level="body"><input ref={attendance} type="checkbox" name="attendance" value="yes" required disabled={step === 0} />{copy.attendance}</label>
      {askGuestCount && <><label data-level="body" htmlFor="guest-count">{copy.guests}</label><input id="guest-count" type="number" name="guests" min={1} max={20} defaultValue={1} required disabled={step === 0} /></>}
    </div>
    <div className="rsvp-form-actions">
      {step === 0 ? <button className="invitation-button" data-level="small" type="button" onClick={next} data-magnetic>{experience.next}<span aria-hidden="true">→</span></button> : <button className="invitation-button" data-level="small" type="submit" data-magnetic>{copy.reply}<span aria-hidden="true">↗</span></button>}
      {step === 1 && <button className="rsvp-back" data-level="small" type="button" onClick={() => { setStep(0); requestAnimationFrame(() => name.current?.focus()); }}>{experience.back}</button>}
    </div>
  </form>;
}
