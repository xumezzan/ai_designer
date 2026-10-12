"use client";

import { useState, type CSSProperties } from "react";
import type { Content } from "@/lib/schema/content";
import { experienceLabels } from "@/lib/invitation/locale";

export function DressPalette({ swatches, locale }: { swatches: string[]; locale: Content["locale"] }) {
  const [selected, setSelected] = useState(0);
  const copy = experienceLabels[locale];
  return <div className="dress-palette">
    <div className="dress-palette-heading" data-level="small"><span>{copy.palette}</span><span aria-hidden="true">01 — {String(swatches.length).padStart(2, "0")}</span></div>
    <ul className="dress-swatches">{swatches.map((hex, index) => <li key={`${hex}-${index}`}>
      <button type="button" className="dress-fabric" style={{ "--swatch": hex } as CSSProperties} aria-label={`${copy.shade} ${index + 1}: ${hex}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>
        <span className="dress-swatch" aria-hidden="true" /><span className="dress-fabric-number" data-level="small">{String(index + 1).padStart(2, "0")}</span>
      </button>
    </li>)}</ul>
    <div className="dress-preview" style={{ "--swatch": swatches[selected] } as CSSProperties}>
      <svg viewBox="0 0 176 128" fill="none" className="dress-outfits" aria-hidden="true">
        <path d="M24 13 13 28l8 20 7-3-7 64h45l-7-64 7 3 8-20-11-15-12 9H36l-12-9Z" fill="var(--swatch)" fillOpacity=".7" />
        <path d="m24 13 12 9h15l12-9M28 45l5 5h20l6-5M33 50l-7 54m27-54 8 54M36 22l3 20m12-20-3 20" stroke="currentColor" strokeOpacity=".55" />
        <path d="m118 14-19 12-8 50 13 3 7-32-3 62h48l-3-62 7 32 13-3-8-50-19-12-14 9-14-9Z" fill="var(--swatch)" fillOpacity=".7" />
        <path d="m118 14 14 9 14-9-6 18-8 7-8-7-6-18Zm14 25v66m-24-16h14m20 0h14" stroke="currentColor" strokeOpacity=".55" />
      </svg>
      <p data-level="small" aria-live="polite">{copy.outfit} · {String(selected + 1).padStart(2, "0")}<span>{copy.paletteHint}</span></p>
    </div>
  </div>;
}
