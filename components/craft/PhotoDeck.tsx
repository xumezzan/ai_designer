"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Content } from "@/lib/schema/content";

const copy = { ru: { label: "Фотоальбом", previous: "Предыдущее фото", next: "Следующее фото", count: "Фото" }, "uz-latn": { label: "Fotoalbom", previous: "Oldingi surat", next: "Keyingi surat", count: "Surat" }, en: { label: "Photo album", previous: "Previous photo", next: "Next photo", count: "Photo" } };

export function PhotoDeck({ items, locale, still }: { items: ReactNode[]; locale: Content["locale"]; still: boolean }) {
  const [enhanced, setEnhanced] = useState(false);
  const [active, setActive] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const labels = copy[locale];
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnhanced(!still && !reduced.matches && items.length > 1);
    update(); reduced.addEventListener("change", update);
    return () => reduced.removeEventListener("change", update);
  }, [still, items.length]);
  const change = (step: number) => setActive((value) => (value + step + items.length) % items.length);
  return <div className="photo-deck" role="region" aria-label={labels.label}>
    <div className="deck-track" data-enhanced={enhanced || undefined} tabIndex={enhanced ? undefined : 0}
      onPointerDown={(event) => { if (enhanced && event.pointerType === "touch") start.current = { x: event.clientX, y: event.clientY }; }}
      onPointerCancel={() => { start.current = null; }}
      onPointerUp={(event) => { const origin = start.current; start.current = null; if (!origin) return; const dx = event.clientX - origin.x, dy = event.clientY - origin.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) change(dx < 0 ? 1 : -1); }}>
      {items.map((item, i) => { const distance = i - active; const offset = Math.max(-2, Math.min(2, distance)); return <div key={i} className="deck-card" data-current={i === active || undefined} inert={enhanced && i !== active} aria-hidden={enhanced && i !== active ? true : undefined} style={{ "--deck-step": offset, "--deck-depth": `${Math.abs(offset) * -70}px`, "--deck-opacity": Math.abs(distance) > 2 ? 0 : i === active ? 1 : .65, zIndex: items.length - Math.abs(distance) } as CSSProperties}>{item}</div>; })}
    </div>
    {enhanced && <div className="deck-controls"><button type="button" onClick={() => change(-1)} aria-label={labels.previous}>←</button><span aria-live="polite" data-level="small">{labels.count} {active + 1} / {items.length}</span><button type="button" onClick={() => change(1)} aria-label={labels.next}>→</button></div>}
  </div>;
}
