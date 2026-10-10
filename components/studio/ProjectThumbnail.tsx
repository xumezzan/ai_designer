"use client";

import { useEffect, useRef, useState } from "react";

export function ProjectThumbnail({ src, names }: { src: string; names: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={container} className="studio-project-thumbnail" aria-hidden="true">
    {width > 0 && <iframe src={src} title={`Превью приглашения: ${names}`} loading="lazy" tabIndex={-1} sandbox="allow-scripts allow-same-origin" onLoad={() => setLoaded(true)} style={{ width: 768, height: 950, transform: `scale(${width / 768})` }} />}
    {!loaded && <span className="studio-project-placeholder">Загружаем превью…</span>}
  </div>;
}
