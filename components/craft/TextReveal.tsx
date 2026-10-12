"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useAnimationControls } from "motion/react";

/** SSR stays readable; motion is armed only after the observer is registered. */
export function TextReveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();

  useEffect(() => {
    const element = root.current;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || media.matches || typeof IntersectionObserver === "undefined") return;
    let shown = false;
    const cover = element.closest(".invitation")?.querySelector("dialog");
    const reveal = () => {
      if (shown) return;
      shown = true;
      observer.disconnect();
      if (media.matches) { controls.stop(); controls.set({ y: 0 }); }
      else void controls.start({ y: 0, transition: { duration: .95, ease: [.16, 1, .3, 1] } });
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !cover?.open) reveal();
    }, { threshold: 0, rootMargin: "0px 0px -5% 0px" });
    controls.set({ y: "100%" });
    observer.observe(element);
    const reduce = () => { if (media.matches) { shown = false; reveal(); } };
    const afterCover = () => {
      const bounds = element.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom > 0) reveal();
    };
    media.addEventListener("change", reduce);
    cover?.addEventListener("close", afterCover);
    return () => { observer.disconnect(); media.removeEventListener("change", reduce); cover?.removeEventListener("close", afterCover); controls.stop(); };
  }, [controls]);

  return <div ref={root} className="text-reveal">
    <motion.div className="text-reveal-inner" initial={false} animate={controls}>{children}</motion.div>
  </div>;
}
