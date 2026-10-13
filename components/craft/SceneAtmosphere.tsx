"use client";

import { useEffect, useRef } from "react";

/** Small, throttled luminous haze. The scene sleeps outside the viewport and
 * while the document is hidden; reduced motion gets one static frame. */
export function SceneAtmosphere({ mode = "haze", enabled = true }: { mode?: "haze" | "bokeh"; enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !enabled) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, visible = false, last = -1000, width = 0, height = 0;
    const color = getComputedStyle(canvas).getPropertyValue("--accent").trim();
    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < (mode === "haze" ? 5 : 15); i++) {
        const radius = mode === "haze" ? Math.max(160, width * .34) : 2 + (i % 4) * 2;
        const x = width * ((i * .271 + .17) % 1) + Math.sin(time * .000055 + i) * width * .08;
        const y = height * ((i * .193 + .3) % 1) + Math.cos(time * .000045 + i * 2) * height * .06;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color || "#D4AF37"); gradient.addColorStop(1, "transparent");
        ctx.globalAlpha = mode === "haze" ? .065 : .2;
        ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    };
    const loop = (time: number) => {
      if (!visible || document.hidden || media.matches) { frame = 0; return; }
      frame = requestAnimationFrame(loop);
      if (time - last < 66) return;
      last = time; draw(time);
    };
    const sync = () => {
      cancelAnimationFrame(frame); frame = 0;
      if (media.matches) draw(0);
      else if (visible && !document.hidden) frame = requestAnimationFrame(loop);
    };
    const resize = new ResizeObserver(() => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth; height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(0);
    });
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    resize.observe(canvas); observer.observe(canvas);
    document.addEventListener("visibilitychange", sync); media.addEventListener("change", sync);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); document.removeEventListener("visibilitychange", sync); media.removeEventListener("change", sync); };
  }, [mode, enabled]);
  return <canvas className="scene-atmosphere" ref={ref} aria-hidden="true" />;
}
