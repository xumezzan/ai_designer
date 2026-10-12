"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Content } from "@/lib/schema/content";
import type { MotionId } from "@/registry/keys";
import { experienceLabels } from "@/lib/invitation/locale";

export function InvitationExperience({ children, names, monogram, date, guest, locale, motion, embedded = false }: {
  children: ReactNode; names: string; monogram: string; date: string; guest?: string;
  locale: Content["locale"]; motion: MotionId; embedded?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  const copy = experienceLabels[locale];

  useEffect(() => {
    const dialog = cover.current;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!dialog || embedded || motion !== "unfold" || media.matches || window.location.hash || typeof dialog.showModal !== "function") return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const unlock = () => { document.body.style.overflow = previousOverflow; };
    const reduce = () => { if (media.matches) { dialog.close(); unlock(); } };
    dialog.addEventListener("close", unlock);
    media.addEventListener("change", reduce);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      dialog.close(); unlock();
      dialog.removeEventListener("close", unlock);
      media.removeEventListener("change", reduce);
    };
  }, [embedded, motion]);

  useEffect(() => {
    const element = root.current;
    if (!element || motion === "still") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reset = () => element.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((button) => {
      button.style.removeProperty("translate");
    });
    const move = (event: PointerEvent) => {
      if (media.matches || !fine.matches || !(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLElement>("[data-magnetic]");
      if (!button) { reset(); return; }
      const rect = button.getBoundingClientRect();
      button.style.translate = `${Math.max(-7, Math.min(7, (event.clientX - rect.left - rect.width / 2) * .08))}px ${Math.max(-5, Math.min(5, (event.clientY - rect.top - rect.height / 2) * .08))}px`;
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", reset);
    media.addEventListener("change", reset);
    return () => { reset(); element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", reset); media.removeEventListener("change", reset); };
  }, [motion]);

  function open() {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(() => { cover.current?.close(); Array.from(root.current?.querySelectorAll<HTMLElement>(".hero-next, .invitation-calendar summary") ?? []).find((target) => target.checkVisibility())?.focus({ preventScroll: true }); }, 850);
  }

  return <div ref={root} className="invitation-experience">
    {children}
    <dialog ref={cover} className="invitation-cover" data-closing={closing || undefined} aria-label={copy.open} onCancel={(event) => { event.preventDefault(); open(); }}
      onPointerDown={(event) => { if (event.pointerType === "touch") touchStart.current = event.clientY; }}
      onPointerUp={(event) => { if (touchStart.current !== null && touchStart.current - event.clientY > 55) open(); touchStart.current = null; }}>
      <div className="cover-leaf cover-leaf-top" aria-hidden="true" /><div className="cover-leaf cover-leaf-bottom" aria-hidden="true" />
      <div className="cover-content">
        <p className="cover-eyebrow" data-level="small">{guest ? `${guest}, ${copy.forYou}` : copy.personal}</p>
        <div className="cover-envelope" aria-hidden="true"><span className="cover-monogram">{monogram}</span></div>
        <p className="cover-names" data-level="display-sm">{names}</p>
        <p data-level="small" className="cover-date">{date}</p>
        <button type="button" className="cover-open" onClick={open} data-level="small">{copy.open}<span aria-hidden="true">↗</span></button>
        <span className="cover-swipe" data-level="small">{copy.swipe}</span>
      </div>
    </dialog>
  </div>;
}
