"use client";
import { useEffect, useRef, useState } from "react";
import type { DesignDocument } from "@/design/schema";
import { SiteRenderer } from "@/renderer/SiteRenderer";

/**
 * A real render of the design, scaled down to fit — never a static screenshot.
 * `width` is the emulated viewport width of the site.
 */
export function SiteThumbnail({ doc, width = 1280, height, className = "", interactive = false }: { doc: DesignDocument; width?: number; height?: number; className?: string; interactive?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / width));
    ro.observe(el);
    setScale(el.clientWidth / width);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={`thumb-frame ${className}`} style={{ height: height ?? undefined, aspectRatio: height ? undefined : "4 / 3" }}>
      <div className="thumb-inner" style={{ width, transform: `scale(${scale})`, pointerEvents: interactive ? "auto" : "none" }}>
        <SiteRenderer doc={doc} viewport={width < 700 ? "mobile" : "desktop"} />
      </div>
    </div>
  );
}
