"use client";

import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import type { MotionId } from "@/registry/keys";

export type MaterialScene = "silk-suite" | "pressed-flower" | "glass-garden";

/** SSR is fully readable; only an observed panel acquires entrance/lighting. */
export function MaterialPanel({ children, scene, motion, hero = false }: { children: ReactNode; scene: MaterialScene; motion: MotionId; hero?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || motion === "still") return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    let animation: Animation | undefined;
    let shown = false;
    const cover = element.closest(".invitation")?.querySelector("dialog");
    const reset = () => { element.style.removeProperty("--panel-pitch"); element.style.removeProperty("--panel-yaw"); element.style.removeProperty("--panel-light-x"); };
    const reveal = () => {
      if (shown) return;
      shown = true;
      observer?.disconnect();
      if (reduced.matches || document.hidden || typeof element.animate !== "function") return;
      const start = scene === "silk-suite" ? "perspective(1200px) translateY(32px) rotateX(9deg)" : scene === "pressed-flower" ? "translateY(24px) rotate(-1.4deg)" : "translateY(16px) scale(.975)";
      animation = element.animate([{ opacity: scene === "glass-garden" ? .75 : 1, transform: start }, { opacity: 1, transform: "none" }], { duration: hero ? 1250 : 950, easing: "cubic-bezier(.16,1,.3,1)" });
    };
    const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !cover?.open) reveal();
    }, { rootMargin: "0px 0px -5% 0px", threshold: 0 });
    if (reduced.matches || !observer) shown = true; else observer.observe(element);
    const move = (event: PointerEvent) => {
      if (!fine.matches || reduced.matches || animation?.playState === "running") return;
      const box = element.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
      const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
      element.style.setProperty("--panel-pitch", `${(0.5 - y) * 2.4}deg`);
      element.style.setProperty("--panel-yaw", `${(x - 0.5) * 2.4}deg`);
      element.style.setProperty("--panel-light-x", `${x * 100}%`);
    };
    const preference = () => { if (reduced.matches) { animation?.cancel(); observer?.disconnect(); shown = true; reset(); } };
    const visibility = () => { if (document.hidden) { animation?.finish(); reset(); } };
    const afterCover = () => { const box = element.getBoundingClientRect(); if (box.top < innerHeight && box.bottom > 0) reveal(); };
    element.addEventListener("pointermove", move); element.addEventListener("pointerleave", reset);
    reduced.addEventListener("change", preference); document.addEventListener("visibilitychange", visibility);
    cover?.addEventListener("close", afterCover);
    return () => { observer?.disconnect(); animation?.cancel(); reset(); element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", reset); reduced.removeEventListener("change", preference); document.removeEventListener("visibilitychange", visibility); cover?.removeEventListener("close", afterCover); };
  }, [scene, motion, hero]);
  return <div ref={ref} className={`material-panel${hero ? " material-hero-panel" : ""}`} data-scene={scene} data-depth-card>
    <div className="material-panel-edge" aria-hidden="true" /><div className="material-panel-light" aria-hidden="true" />
    <div className="material-panel-content">{children}</div>
  </div>;
}

/** Bounded ambient objects stop in hidden documents; their geometry is authored. */
export function MaterialAtmosphere({ ambient, motion }: { ambient: "none" | "dust" | "petals" | "snow"; motion: MotionId }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => { el.dataset.paused = document.hidden ? "true" : "false"; };
    update(); document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  if (ambient === "none" || motion === "still") return null;
  return <div ref={ref} className="material-atmosphere" data-ambient={ambient} aria-hidden="true">{Array.from({ length: ambient === "dust" ? 8 : 6 }, (_, i) => <i key={i} style={{ "--particle-i": i } as CSSProperties} />)}</div>;
}
