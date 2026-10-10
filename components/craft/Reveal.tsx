"use client";

import { useEffect, useRef, useState } from "react";

export interface RevealProps {
  children: React.ReactNode;
  /** Stagger in milliseconds; 0 plays as soon as the block is in view. */
  delay?: number;
  className?: string;
}

/**
 * One step of the load choreography (SPEC §7.1).
 *
 * The block is server-rendered with `data-reveal="pending"`; the craft CSS
 * hides that state only after this block's own observer is registered, so a
 * reader without JS, or with a failed application bundle, sees the content.
 *
 * The reveal plays exactly once: the observer disconnects on the first
 * intersection and the state never returns to `pending`.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      setShown(true);
      observer.disconnect();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -5% 0px" },
    );

    observer.observe(el);
    el.dataset.revealReady = "true";
    const onMotionPreference = () => { if (media.matches) reveal(); };
    media.addEventListener("change", onMotionPreference);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", onMotionPreference);
      delete el.dataset.revealReady;
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-reveal={shown ? "shown" : "pending"}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
