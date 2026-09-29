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
 * hides that state only when `html[data-craft="js"]` is set, so a reader
 * without JS — or a crawler — sees the content as if it had already played.
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

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
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
