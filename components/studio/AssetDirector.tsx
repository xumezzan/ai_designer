"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Image from "next/image";
import type { Content } from "@/lib/schema/content";
import type { Asset, AssetPlan } from "@/lib/schema/assetPlan";
import type { ImageInfo } from "@/lib/assets/crop";
import { heroGrade, ratios, selectCrop, unusedAsset } from "@/lib/assets/crop";

const roles = { unused: "Не использовать", hero: "Главное фото", portrait: "Портрет", story: "История", gallery: "Галерея", backdrop: "Атмосфера" };
const subjects = { couple: "Пара", person: "Один человек", group: "Группа людей", venue: "Место события", detail: "Детали", landscape: "Пейзаж" };
const qualities = { high: "Высокое", usable: "Подходит для небольшого блока", low: "Низкое — только небольшой снимок" };
const treatments = { none: "Без обработки", "warm-film": "Тёплая плёнка", desaturate: "Приглушённые цвета", bw: "Чёрно-белая" };
const sections = { hero: "Первый экран", greeting: "Обращение к гостям", countdown: "Обратный отсчёт", timeline: "Программа", venue: "Место встречи", dressCode: "Дресс-код", rsvp: "Ответ гостей", footer: "Завершение" };
const issues = { "soft-focus": "Нечёткий фокус", "low-res": "Низкое разрешение", "harsh-flash": "Жёсткая вспышка", "mixed-white-balance": "Разный свет", "busy-background": "Пёстрый фон", watermark: "Водяной знак", "cluttered-edges": "Лишние детали по краям" };
type Props = {
  content: Content; revision: string; planRevision: string; initialPlan: AssetPlan; info: Record<string, ImageInfo>;
  disabled: boolean; readOnly: boolean; visionConfigured: boolean; onBusy: (busy: boolean) => void;
  onDirty: (dirty: boolean) => void; onSaved: (plan: AssetPlan, revision: string) => void; onMessage: (message: string, error?: boolean) => void;
};
async function result(response: Response) {
  let data;
  try { data = await response.json(); } catch { throw new Error("Сервер не ответил. Повторите действие."); }
  if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить настройки фото.");
  return data;
}
function Percent({ label, value, max = 1, min = 0, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="studio-photo-range"><span>{label}<output>{Math.round(value * 100)}%</output></span><input type="range" aria-label={label} min={Math.round(min * 100)} max={Math.round(max * 100)} step={1} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} /></label>;
}
function PhotoSettings({ asset, info, src, index, unified, disabled, onChange }: { asset: Asset; info: ImageInfo; src: string; index: number; unified: AssetPlan["unifiedTreatment"]; disabled: boolean; onChange: (patch: Partial<Asset>) => void }) {
  const [mode, setMode] = useState("focal");
  const anchor = useRef<[number, number] | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const crop = selectCrop(info, asset);
  const point = (event: PointerEvent<HTMLDivElement>): [number, number] => {
    const rect = stage.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!anchor.current || disabled) return;
    const current = point(event);
    if (mode === "focal") onChange({ focal: current });
    else {
      const x = Math.min(Math.min(anchor.current[0], current[0]), .98);
      const y = Math.min(Math.min(anchor.current[1], current[1]), .98);
      onChange({ safeArea: { x, y, w: Math.min(1 - x, Math.max(.02, Math.abs(current[0] - anchor.current[0]))), h: Math.min(1 - y, Math.max(.02, Math.abs(current[1] - anchor.current[1]))) } });
    }
  };
  function role(value: Asset["role"]) {
    const placement = value === "unused" ? null : value === "hero" ? { section: "hero" as const, index } : asset.placement ?? { section: asset.subject === "venue" ? "venue" as const : "greeting" as const, index };
    onChange({ role: value, placement, ...(value === "hero" ? { quality: "high" as const } : {}) });
  }
  return <article className="studio-photo-settings"><div className="studio-photo-title"><h3>Фото {index + 1}</h3><span>{info.width} × {info.height} px</span></div><fieldset disabled={disabled}>
    <div className="studio-photo-edit-layout"><div><div className="studio-photo-mode"><button type="button" aria-pressed={mode === "focal"} onClick={() => setMode("focal")}>Точка фокуса</button><button type="button" aria-pressed={mode === "safe"} onClick={() => setMode("safe")}>Сохраняемая область</button></div>
      <div className="studio-photo-stage" ref={stage} style={{ aspectRatio: info.width / info.height }} onPointerDown={(event) => { if (disabled || event.button !== 0) return; anchor.current = point(event); event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={move} onPointerUp={(event) => { move(event); anchor.current = null; }} onPointerCancel={() => { anchor.current = null; }} aria-label={`Исходное фото ${index + 1}: положение фокуса и защищённая область`}>
        <Image unoptimized src={src} width={info.width} height={info.height} alt={`Исходное фото ${index + 1}`} draggable={false} />
        <span className="studio-safe-box" style={{ left: `${asset.safeArea.x * 100}%`, top: `${asset.safeArea.y * 100}%`, width: `${asset.safeArea.w * 100}%`, height: `${asset.safeArea.h * 100}%` }} />
        <span className="studio-focal-dot" style={{ left: `${asset.focal[0] * 100}%`, top: `${asset.focal[1] * 100}%` }} />
      </div><p className="studio-help">{mode === "focal" ? "Нажмите на важную часть фото. Точную позицию можно задать ползунками." : "Протяните рамку вокруг всех лиц и важных деталей. Они останутся в кадре."}</p>
      <div className="studio-photo-coordinates"><Percent label="Фокус по горизонтали" value={asset.focal[0]} onChange={(value) => onChange({ focal: [value, asset.focal[1]] })} /><Percent label="Фокус по вертикали" value={asset.focal[1]} onChange={(value) => onChange({ focal: [asset.focal[0], value] })} />
      <Percent label="Область: слева" max={.98} value={asset.safeArea.x} onChange={(x) => onChange({ safeArea: { ...asset.safeArea, x, w: Math.min(asset.safeArea.w, 1 - x) } })} /><Percent label="Область: сверху" max={.98} value={asset.safeArea.y} onChange={(y) => onChange({ safeArea: { ...asset.safeArea, y, h: Math.min(asset.safeArea.h, 1 - y) } })} />
      <Percent label="Ширина области" min={.02} max={1 - asset.safeArea.x} value={asset.safeArea.w} onChange={(w) => onChange({ safeArea: { ...asset.safeArea, w } })} /><Percent label="Высота области" min={.02} max={1 - asset.safeArea.y} value={asset.safeArea.h} onChange={(h) => onChange({ safeArea: { ...asset.safeArea, h } })} /></div>
    </div><div className="studio-photo-options"><label className="studio-field"><span>Роль фото</span><select value={asset.role} onChange={(e) => role(e.target.value as Asset["role"])}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value} disabled={value === "hero" && !heroGrade(info)}>{label}</option>)}</select></label>
      <label className="studio-field"><span>Что изображено</span><select value={asset.subject} onChange={(e) => onChange({ subject: e.target.value as Asset["subject"] })}>{Object.entries(subjects).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="studio-field"><span>Качество</span><select value={asset.quality} onChange={(e) => { const quality = e.target.value as Asset["quality"]; onChange({ quality, maxViewportShare: quality === "low" ? Math.min(asset.maxViewportShare, .35) : asset.maxViewportShare, ...(quality !== "high" && (asset.role === "hero" || asset.placement?.section === "hero") ? { role: "portrait" as const, placement: { section: "greeting" as const, index } } : {}) }); }}>{Object.entries(qualities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="studio-field"><span>Раздел приглашения</span><select value={asset.placement?.section ?? "unused"} onChange={(e) => { const section = e.target.value; onChange(section === "unused" ? { role: "unused", placement: null } : { role: asset.role === "unused" ? "portrait" : asset.role, placement: { section: section as NonNullable<Asset["placement"]>["section"], index: asset.placement?.index ?? index } }); }}><option value="unused">Не размещать</option>{Object.entries(sections).map(([value, label]) => <option key={value} value={value} disabled={value === "hero" && (asset.quality !== "high" || !heroGrade(info))}>{label}</option>)}</select></label>
      <label className="studio-field"><span>Порядок в разделе</span><input type="number" min={0} max={40} value={asset.placement?.index ?? index} disabled={!asset.placement} onChange={(e) => { if (asset.placement) onChange({ placement: { ...asset.placement, index: Number(e.target.value) } }); }} /></label>
      <label className="studio-field"><span>Обработка отдельного фото</span><select value={asset.treatment} onChange={(e) => onChange({ treatment: e.target.value as Asset["treatment"] })}>{Object.entries({ ...treatments, duotone: "Дуотон" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>{unified !== "none" ? "В приглашении применяется общая обработка всей серии." : "Используется, когда общая обработка отключена."}</small></label>
      <Percent label="Максимальная доля экрана" min={.15} max={asset.quality === "low" || Math.min(info.width, info.height) < 480 ? .35 : 1} value={asset.maxViewportShare} onChange={(value) => onChange({ maxViewportShare: value })} />
      <div className="studio-photo-ratios"><span>Форматы кадра · в порядке предпочтения</span><div>{ratios.map((ratio) => <label key={ratio}><input type="checkbox" checked={asset.allowedRatios.includes(ratio)} onChange={(e) => { const allowedRatios = e.target.checked ? [...asset.allowedRatios, ratio] : asset.allowedRatios.filter((value) => value !== ratio); if (allowedRatios.length) onChange({ allowedRatios }); }} />{ratio}</label>)}</div><ol>{asset.allowedRatios.map((ratio, position) => <li key={ratio}><span>{position + 1}. {ratio}</span><button type="button" disabled={position === 0} aria-label={`Поднять формат ${ratio}`} onClick={() => { const values = [...asset.allowedRatios]; [values[position - 1], values[position]] = [values[position], values[position - 1]]; onChange({ allowedRatios: values }); }}>↑</button><button type="button" disabled={position === asset.allowedRatios.length - 1} aria-label={`Опустить формат ${ratio}`} onClick={() => { const values = [...asset.allowedRatios]; [values[position], values[position + 1]] = [values[position + 1], values[position]]; onChange({ allowedRatios: values }); }}>↓</button></li>)}</ol></div>
      <details className="studio-photo-issues"><summary>Особенности снимка · {asset.issues.length}</summary>{Object.entries(issues).map(([value, label]) => <label key={value}><input type="checkbox" checked={asset.issues.includes(value as Asset["issues"][number])} onChange={(e) => onChange({ issues: e.target.checked ? [...asset.issues, value as Asset["issues"][number]] : asset.issues.filter((issue) => issue !== value) })} />{label}</label>)}</details>
      <label className="studio-field"><span>Заметка для оформления</span><textarea rows={2} maxLength={1000} value={asset.note ?? ""} onChange={(e) => onChange({ note: e.target.value || undefined })} /></label>
    </div></div>
    <div className="studio-photo-crop"><div><h4>Кадр, который увидят гости</h4><p>{crop.mode === "whole" ? "Показываем фото целиком: выбранные форматы задевают защищённую область." : `Формат ${crop.label}. Защищённая область целиком внутри кадра.`}</p><p>{asset.role === "unused" ? "Фото сохранено, но пока не размещено в приглашении." : asset.quality === "low" ? "Небольшой блок без увеличения исходных пикселей, максимум 35% экрана." : `Размер ограничен ${Math.round(asset.maxViewportShare * 100)}% экрана и разрешением исходного кадра.`}</p></div><figure className="directed-photo" data-treatment={unified === "none" ? asset.treatment : unified} style={{ "--photo-ratio": String(crop.ratio), "--photo-limit": "min(100%, 260px)" } as CSSProperties}><Image unoptimized src={src} width={info.width} height={info.height} alt={`Проверка кадра фото ${index + 1}`} style={{ objectFit: crop.mode === "whole" ? "contain" : "cover", objectPosition: `${asset.focal[0] * 100}% ${asset.focal[1] * 100}%` }} /></figure></div>
  </fieldset></article>;
}
export function AssetDirector(props: Props) {
  const [draft, setDraft] = useState(props.initialPlan);
  const plan = { ...draft, assets: props.content.media.filter((media) => props.info[media.id]).map((media) => draft.assets.find((asset) => asset.id === media.id) ?? unusedAsset(media.id, props.info[media.id])) };
  function change(id: string, patch: Partial<Asset>) {
    setDraft({ ...plan, assets: plan.assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset) });
    props.onDirty(true); props.onMessage("");
  }
  async function save() {
    if (props.disabled || props.readOnly) return;
    props.onBusy(true); props.onMessage("");
    try {
      const data = await result(await fetch(`/api/projects/${props.content.slug}/asset-plan`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetPlan: plan, revision: props.revision, planRevision: props.planRevision }) }));
      setDraft(data.assetPlan); props.onSaved(data.assetPlan, data.planRevision); props.onDirty(false); props.onMessage("Настройки фото сохранены. Приглашения обновлены.");
    } catch (error) { props.onMessage((error as Error).message, true); }
    finally { props.onBusy(false); }
  }
  async function analyze() {
    if (props.disabled || props.readOnly) return;
    props.onBusy(true); props.onMessage("Анализируем фотографии…");
    try {
      const data = await result(await fetch("/api/plan-assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: props.content.slug, revision: props.revision, planRevision: props.planRevision }) }));
      setDraft(data.assetPlan); props.onDirty(true); props.onMessage("Анализ готов. Проверьте лица и кадры, затем сохраните настройки.");
    } catch (error) { props.onMessage((error as Error).message, true); }
    finally { props.onBusy(false); }
  }
  return <section className="studio-panel"><div className="studio-panel-heading"><span>03</span><div><h2>Фотографии в приглашении</h2><p>Фокус, лица в кадре и единая обработка всей серии.</p></div></div>
    {!plan.assets.length ? <div className="studio-empty"><h3>Начните с фотографий</h3><p>Загрузите снимки в разделе «Материалы». Референсы оформления не размещаются в приглашении.</p></div> : <><div className="studio-photo-actions"><label className="studio-field"><span>Общая обработка серии</span><select disabled={props.disabled || props.readOnly} value={draft.unifiedTreatment} onChange={(e) => { setDraft({ ...plan, unifiedTreatment: e.target.value as AssetPlan["unifiedTreatment"] }); props.onDirty(true); props.onMessage(""); }}>{Object.entries(treatments).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button type="button" className="studio-secondary" disabled={props.disabled || props.readOnly || !props.visionConfigured} onClick={() => { void analyze(); }}>Проанализировать фото</button></div>
    {!props.visionConfigured && <p className="studio-help">Автоанализ станет доступен после подключения Anthropic. Все настройки можно задать вручную.</p>}
    <p className="studio-help">Кнопка анализа предлагает новый план для всех фотографий. Приглашения обновятся только после сохранения.</p>
    {plan.assets.map((asset, index) => <PhotoSettings key={asset.id} asset={asset} info={props.info[asset.id]} src={props.content.media.find((media) => media.id === asset.id)!.src} index={index} unified={plan.unifiedTreatment} disabled={props.disabled || props.readOnly} onChange={(patch) => change(asset.id, patch)} />)}
    <button id="save-photo-plan" type="button" className="studio-primary" disabled={props.disabled || props.readOnly} onClick={() => { void save(); }}>Сохранить настройки фото</button></>}
  </section>;
}
