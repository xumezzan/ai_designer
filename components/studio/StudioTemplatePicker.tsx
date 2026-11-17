"use client";

import Link from "next/link";
import type { Content } from "@/lib/schema/content";
import { studioTemplates, studioPalettes } from "@/registry/studioTemplates";
import type { StudioTemplateId, StudioPaletteId } from "@/lib/schema/studioTemplate";

type Preference = NonNullable<Content["studioDesign"]>;
export function StudioTemplatePicker({ value, onChange }: { value?: Preference; onChange: (preference: Preference) => void }) {
  const id = value?.templateId ?? "auto";
  const selected = studioTemplates.find((template) => template.id === id);
  const choose = (templateId: Preference["templateId"]) => onChange({ templateId, paletteId: "auto" });
  return <div className="studio-template-picker">
    <div className="studio-template-picker-heading"><strong>Шаблон для создания</strong><Link href="/templates" target="_blank">Посмотреть целиком ↗</Link></div>
    <button type="button" className="studio-template-auto" aria-pressed={id === "auto"} onClick={() => choose("auto")}><span>Подобрать по описанию и референсам</span><span aria-hidden="true">{id === "auto" ? "✓" : "→"}</span></button>
    <div className="studio-template-options" role="group" aria-label="Шаблон приглашения">{studioTemplates.map((template) => {
      const palette = studioPalettes[template.defaultPaletteId];
      return <button type="button" key={template.id} aria-pressed={id === template.id} onClick={() => choose(template.id as StudioTemplateId)}>
        <span className="studio-template-miniature" data-template={template.id} style={{ background: palette.bg, color: palette.ink, borderColor: palette.accent }} aria-hidden="true"><i /><b>{template.id === "corporate" ? "EVENT" : template.id === "modern" ? "LET’S / GO" : "Aa"}</b><small>12 · 06 · 27</small></span>
        <strong>{template.name}</strong><small>{template.description}</small>
      </button>;
    })}</div>
    {selected && <div className="studio-template-palettes" role="group" aria-label="Палитра шаблона"><p>Палитра нового приглашения</p><button type="button" aria-pressed={!value || value.paletteId === "auto"} onClick={() => onChange({ templateId: selected.id, paletteId: "auto" })}>Подобрать</button>{selected.paletteIds.map((paletteId) => {
      const palette = studioPalettes[paletteId];
      return <button key={paletteId} type="button" aria-pressed={value?.paletteId === paletteId} onClick={() => onChange({ templateId: selected.id, paletteId: paletteId as StudioPaletteId })}><span aria-hidden="true" style={{ background: palette.bg, boxShadow: `inset 0 0 0 5px ${palette.accent}` }} />{palette.name}</button>;
    })}</div>}
    <p className="studio-help">У каждого шаблона своя композиция, типографика и декор. Референсы помогают выбрать подходящую палитру и настроение.</p>
  </div>;
}
