"use client";

import { useEffect, useRef, useState } from "react";
import type { Content } from "@/lib/schema/content";
import type { Concept } from "@/lib/studio/store";
import { resolveWallTime } from "@/lib/studio/date";

export function InvitationCanvas({ concept, content, localDate, viewport, revision, onEdit, onSelect, onHistory, disabled = false }: {
  concept: Concept; content: Content; localDate: string; viewport: string; revision: number;
  disabled?: boolean;
  onEdit: (field: string, text: string) => void; onSelect: (field: string) => void; onHistory: (redo: boolean) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef({ content, localDate, onEdit, onSelect, onHistory, disabled });
  latest.current = { content, localDate, onEdit, onSelect, onHistory, disabled };
  const send = () => {
    const current = latest.current;
    try {
      frame.current?.contentWindow?.postMessage({ channel: "invitation-studio", type: "content", locked: current.disabled, content: { ...current.content, date: { ...current.content.date, start: resolveWallTime(current.localDate, current.content.date.timezone) } } }, location.origin);
    } catch { /* An incomplete date stays in the inspector until it is valid. */ }
  };
  useEffect(() => { send(); }, [content, localDate, disabled]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    if (stage.current) observer.observe(stage.current);
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "invitation-studio") return;
      if (event.data.type === "ready") { setLoaded(true); send(); }
      if (!latest.current.disabled && event.data.type === "edit" && typeof event.data.field === "string" && typeof event.data.text === "string") latest.current.onEdit(event.data.field, event.data.text);
      if (event.data.type === "select" && typeof event.data.field === "string") latest.current.onSelect(event.data.field);
      if (event.data.type === "history") latest.current.onHistory(Boolean(event.data.redo));
    };
    window.addEventListener("message", receive);
    return () => { observer.disconnect(); window.removeEventListener("message", receive); };
  }, []);
  const phone = viewport === "phone";
  const frameWidth = phone ? 390 : 1280;
  const frameHeight = phone ? 844 : 900;
  const scale = Math.min(1, Math.max(width - 40, 1) / frameWidth);
  return <div className="studio-canvas-stage" ref={stage}>
    <div className="studio-canvas-device" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
      <iframe key={`${concept.id}-${concept.version}`} ref={frame} title="Редактор приглашения" src={`/preview/${content.slug}/${concept.id}/${concept.version}?embed=1&studio=1&saved=${revision}`} onLoad={() => { setLoaded(true); send(); }} sandbox="allow-scripts allow-same-origin" style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})`, transformOrigin: "top left" }} />
      {!loaded && <span className="studio-preview-loading">Открываем редактор…</span>}
    </div>
    <p className="studio-canvas-hint">Нажмите на текст, чтобы изменить его. Прокрутите приглашение, чтобы увидеть остальные блоки.</p>
  </div>;
}
