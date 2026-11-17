"use client";
import { useEffect, useState } from "react";
import type { Content } from "@/lib/schema/content";
import { remainingTime } from "@/lib/invitation/date";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { FittedHeadingText } from "@/components/primitives/FittedHeadingText";

export function Countdown({ date, locale, initialNow, heading, headingMeasure }: { date: Content["date"]; locale: Content["locale"]; initialNow: number; heading?: string; headingMeasure?: number }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const tick = () => { const current = Date.now(); setNow(current); if (current >= Date.parse(date.start)) stop(); };
    const sync = () => {
      stop();
      if (!date.showCountdown) return;
      if (document.hidden || Date.now() >= Date.parse(date.start)) { setNow(Date.now()); return; }
      tick(); timer = setInterval(tick, 1000);
    };
    sync(); document.addEventListener("visibilitychange", sync);
    return () => { stop(); document.removeEventListener("visibilitychange", sync); };
  }, [date.start, date.showCountdown]);
  const remaining = remainingTime(date.start, now);
  const copy = labels[locale];
  if (!date.showCountdown) return null;
  return <section id="countdown" className="invitation-section countdown-section" data-section="countdown" aria-labelledby="countdown-title">
    <h2 id="countdown-title" data-level="display-sm" data-fit-display={headingMeasure !== undefined || undefined}><FittedHeadingText measure={headingMeasure}>{typograph(heading || copy.countdown, locale)}</FittedHeadingText></h2>
    <p className="countdown-status" aria-live="polite" data-level="body">{remaining.arrived ? copy.arrived : ""}</p>
    <dl className="countdown-values" role="timer" aria-live="off" aria-label={heading || copy.countdown}>
      {(["days", "hours", "minutes", "seconds"] as const).map((unit) => <div key={unit}><dt data-level="small">{copy[unit]}</dt><dd data-level="display-sm">{String(remaining[unit]).padStart(2, "0")}</dd></div>)}
    </dl>
  </section>;
}
