"use client";
import { useState } from "react";
import type { Concept } from "@/lib/studio/store";
import type { Approval } from "@/lib/schema/versions";

export type DesignAction = "refine" | "restore" | "approve";
const changeLabels: Record<string, string> = {
  "palette.bg": "Фон", "palette.surface": "Поверхности", "palette.ink": "Основной текст", "palette.muted": "Второстепенный текст", "palette.accent": "Акцент", "palette.accentAlt": "Второй акцент",
  typeSet: "Шрифтовая пара", materialSet: "Материал", artwork: "Иллюстрации", "foil.enabled": "Фольга", "foil.color": "Цвет фольги",
  "ornament.pack": "Узоры", "ornament.density": "Плотность узоров", "ornament.placement": "Расположение узоров", "ornament.color": "Цвет узоров",
  "layout.preset": "Макет", "layout.composition": "Композиция", "layout.hero": "Первый экран", "layout.photoArrangement": "Раскладка фото", "layout.sectionOrder": "Порядок разделов", photos: "Позиции фотографий", "motion.preset": "Анимация", "motion.ambient": "Фоновые эффекты",
};
const valueLabels: Record<string, string> = {
  none: "без эффекта", paper: "бумага", ceremony: "торжественная", editorial: "редакционная", "suzani-atelier": "Сузани · Atelier", "art-deco": "ар-деко", "uzbek-suzani": "сузани", "geometric-islamic": "геометрические",
  light: "лёгкая", medium: "средняя", divider: "разделитель", corners: "углы", "hero-frame": "рамка", watermark: "фоновый узор", accent: "акцент", accentAlt: "второй акцент", muted: "приглушённый",
  letter: "письмо", poster: "постер", folio: "фолио", arch: "арка", botanical: "диагональ", "scroll-narrative": "приглашение со скроллом", "full-photo": "с фотографией", typographic: "типографический", "ornament-frame": "с рамкой",
  row: "в ряд", stack: "друг под другом", offset: "со смещением", still: "без анимации", unfold: "появление", drift: "плавное появление", hero: "первый экран", greeting: "обращение", countdown: "обратный отсчёт", timeline: "программа", venue: "место", dressCode: "дресс-код", rsvp: "ответ гостей", footer: "завершение",
};
function changeValue(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "boolean") return parsed ? "включена" : "выключена";
    if (Array.isArray(parsed)) return parsed.length ? parsed.every((item) => typeof item === "string") ? parsed.map((item) => valueLabels[item] ?? item).join(", ") : `${parsed.length} позиции фото` : "нет";
    return typeof parsed === "string" ? valueLabels[parsed] ?? parsed : value;
  } catch { return value; }
}
export function ConceptControls({ concept, version, approval, disabled, pendingEdits, configured, refining, elapsed, onView, onAction }: {
  concept: Concept; version: string; approval: Approval | null; disabled: boolean; pendingEdits: boolean; configured: boolean;
  refining: boolean; elapsed: number; onView: (version: string) => void;
  onAction: (action: DesignAction, instruction?: string) => Promise<boolean>;
}) {
  const [instruction, setInstruction] = useState("");
  const selected = approval?.conceptId === concept.id && approval.version === version;
  const history = concept.history ?? [{ version: concept.version, name: concept.theme.meta.name, record: null }];
  const record = history.find((entry) => entry.version === version)?.record;
  return <div className="studio-concept-controls">
    <div className="studio-version-row"><label>Версия для просмотра<span className="studio-sr-only"> {concept.theme.meta.name}</span><select value={version} disabled={disabled} onChange={(event) => onView(event.target.value)}>
      {history.map((entry) => <option key={entry.version} value={entry.version}>v{entry.version}{entry.version === concept.version ? " · текущая" : ""}{approval?.conceptId === concept.id && approval.version === entry.version ? " · выбрана" : ""}{entry.record?.fromVersion ? ` · из v${entry.record.fromVersion}` : ""}</option>)}
    </select></label><button type="button" className={selected ? "studio-primary" : "studio-secondary"} aria-pressed={selected} disabled={disabled || pendingEdits || selected} onClick={() => { void onAction("approve"); }}>{selected ? `Выбрана v${version}` : `Выбрать v${version}`}</button></div>
    {version !== concept.version && <button type="button" className="studio-text-button" disabled={disabled || pendingEdits} onClick={() => { void onAction("restore"); }}>Сделать v{version} текущей</button>}
    {record?.fromVersion && <details className="studio-version-details"><summary>Изменения v{version}</summary><p>{record.summary}</p><p className="studio-help">Запрос: {record.instruction}</p><ul>{record.changes.map((change) => <li key={change.path}><strong>{changeLabels[change.path] ?? "Дизайн"}</strong>: <span>{changeValue(change.before)}</span> → <span>{changeValue(change.after)}</span></li>)}</ul>{record.adjustments.length > 0 && <p>Дополнительно скорректирована читаемость или доступность фотографии. Все изменения перечислены выше.</p>}</details>}
    <form onSubmit={async (event) => { event.preventDefault(); if (await onAction("refine", instruction)) setInstruction(""); }}>
      <label className="studio-field"><span>Доработать этот вариант<span className="studio-sr-only"> {concept.theme.meta.name}</span></span><textarea rows={3} maxLength={2000} disabled={disabled || !configured} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Например, сделай фон темнее, убери золото. Остальное сохрани." /></label>
      <button type="submit" className="studio-secondary" disabled={disabled || pendingEdits || !configured || !instruction.trim()}>{refining ? `Создаём правку · ${elapsed} с` : `Создать версию из v${version}`}</button>
      <p className="studio-help">Изменится только этот вариант. Выбранная версия сохраняется, пока вы явно не выберете новую.</p>
    </form>
  </div>;
}
