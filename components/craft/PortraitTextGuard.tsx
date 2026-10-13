"use client";

import { useEffect, useRef } from "react";

/** Server/no-JS starts with type outside the photograph. Only measured live
 * text can opt into an empty photo zone; edits and font changes recheck it. */
export function PortraitTextGuard({ preferred, freeSpace }: { preferred: "top" | "bottom" | "outside"; freeSpace: number }) {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const hero = anchor.current?.closest<HTMLElement>(".reference-hero");
    const photo = hero?.querySelector<HTMLElement>(".reference-hero-photo img");
    const copy = hero?.querySelector<HTMLElement>(".reference-hero-copy");
    if (!hero || !photo || !copy || preferred === "outside") return;
    const measure = () => {
      const style = getComputedStyle(copy);
      const textHeight = copy.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const padding = parseFloat(getComputedStyle(document.documentElement).fontSize) * 6;
      const allowed = photo.getBoundingClientRect().height * freeSpace;
      hero.dataset.textZone = textHeight + padding <= allowed ? preferred : "outside";
      const rootBounds = hero.getBoundingClientRect(), photoBounds = photo.getBoundingClientRect();
      hero.style.setProperty("--safe-photo-top", `${photoBounds.top - rootBounds.top}px`);
      hero.style.setProperty("--safe-photo-bottom", `${rootBounds.bottom - photoBounds.bottom}px`);
    };
    const resize = new ResizeObserver(measure);
    resize.observe(copy); resize.observe(photo); measure();
    return () => { resize.disconnect(); hero.dataset.textZone = "outside"; };
  }, [preferred, freeSpace]);
  return <span ref={anchor} hidden aria-hidden="true" />;
}
