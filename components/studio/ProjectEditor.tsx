"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Content } from "@/lib/schema/content";
import type { Project } from "@/lib/studio/store";
import type { AssetPlan } from "@/lib/schema/assetPlan";
import { unusedAsset } from "@/lib/assets/crop";
import { directions, directionFor } from "@/lib/studio/directions";
import { InvitationCanvas } from "./InvitationCanvas";
import { editCanvasText } from "@/lib/studio/live";
import { AssetDirector } from "./AssetDirector";
import { ConceptControls, type DesignAction } from "./ConceptControls";
import { resolveWallTime, wallTime } from "@/lib/studio/date";

const blank: Content = {
  slug: "", locale: "ru", eventType: "wedding", hosts: [{ name: "" }, { name: "" }], greeting: "",
  date: { start: "", timezone: "Asia/Tashkent", showCountdown: true }, venue: { name: "", address: "" },
  timeline: [], media: [], refs: [], variantCount: 1, brief: "",
};
const eventTypes = { wedding: "Свадьба", anniversary: "Юбилей", birthday: "День рождения", corporate: "Корпоративный вечер", engagement: "Помолвка", other: "Другое событие" };
function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return <label className={`studio-field ${wide ? "studio-field-wide" : ""}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function PreviewWindow({ concept, slug, revision, viewport, onOpen }: { concept: Project["concepts"][number]; slug: string; revision: number; viewport: string; onOpen: () => void }) {
  const element = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  const phone = viewport === "phone";
  const frameWidth = phone ? 390 : 1280;
  const frameHeight = phone ? 844 : 900;
  const scale = Math.min(phone ? .54 : .6, Math.max(width - 24, 1) / frameWidth);
  return <div ref={element} className="studio-preview-window" style={{ height: frameHeight * scale }}>
    <iframe loading="lazy" onLoad={() => setLoaded(true)} title={`Приглашение: ${concept.theme.meta.name}`} src={`/preview/${slug}/${concept.id}/${concept.version}?embed=1&saved=${revision}`} tabIndex={-1} sandbox="allow-scripts allow-same-origin" style={{ width: frameWidth, height: frameHeight, transform: `translateX(-50%) scale(${scale})` }} />
    {!loaded && <span className="studio-preview-loading">Загружаем приглашение…</span>}
    <button type="button" className="studio-preview-cover" aria-label={`Посмотреть ${concept.theme.meta.name}`} onClick={onOpen} />
  </div>;
}
async function responseData(response: Response) {
  let data;
  try { data = await response.json(); } catch { throw new Error("Сервер не ответил. Проверьте соединение и повторите."); }
  if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить проект. Повторите действие.");
  return data;
}

export function ProjectEditor({ initial, imagesConfigured = Boolean(initial?.imagesConfigured), visionConfigured = Boolean(initial?.visionConfigured) }: { initial?: Project; imagesConfigured?: boolean; visionConfigured?: boolean }) {
  const router = useRouter();
  const [content, setContent] = useState<Content>(initial ? { ...initial.content, variantCount: 1 } : blank);
  const [editorMode, setEditorMode] = useState(Boolean(initial?.generation) && initial?.content.slug !== "demo");
  const [tool, setTool] = useState("content");
  const [activeId, setActiveId] = useState(initial?.approval?.conceptId ?? initial?.concepts[0]?.id ?? "");
  const [selectedField, setSelectedField] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const editSequence = useRef(0);
  const failedSequence = useRef(-1);
  const history = useRef<{ content: Content; localDate: string }[]>([]);
  const future = useRef<{ content: Content; localDate: string }[]>([]);
  const lastHistory = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);
  const [concepts, setConcepts] = useState(initial?.generation || initial?.content.slug === "demo" ? initial?.concepts ?? [] : []);
  const [generation, setGeneration] = useState(initial?.generation ?? null);
  const [generationRevision, setGenerationRevision] = useState(initial?.generationRevision ?? "");
  const [approval, setApproval] = useState(initial?.approval ?? null);
  const [approvalQa, setApprovalQa] = useState(initial?.approvalQa ?? null);
  const [approvalRevision, setApprovalRevision] = useState(initial?.approvalRevision ?? "");
  const [viewVersions, setViewVersions] = useState<Record<string, string>>({});
  const [refiningId, setRefiningId] = useState("");
  const [checkingId, setCheckingId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [createVisual, setCreateVisual] = useState(imagesConfigured);
  const [elapsed, setElapsed] = useState(0);
  const [planRevision, setPlanRevision] = useState(initial?.planRevision ?? "");
  const [assetPlan, setAssetPlan] = useState(initial?.assetPlan ?? { assets: [], unifiedTreatment: "none" as const });
  const [mediaInfo, setMediaInfo] = useState(initial?.mediaInfo ?? {});
  const [planDirty, setPlanDirty] = useState(false);
  const [revision, setRevision] = useState(initial?.revision ?? "");
  const [localDate, setLocalDate] = useState(initial ? wallTime(initial.content.date.start, initial.content.date.timezone) : "");
  const [savedSlug, setSavedSlug] = useState(initial?.content.slug ?? "");
  const results = useRef<HTMLElement>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState("phone");
  const [previewKey, setPreviewKey] = useState(0);
  const [modal, setModal] = useState<Project["concepts"][number] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const uploadKind = useRef("photo");
  const readOnly = initial?.content.slug === "demo";
  function remember() {
    if (Date.now() - lastHistory.current > 700 || !history.current.length) {
      history.current.push({ content: structuredClone(content), localDate });
      if (history.current.length > 60) history.current.shift();
    }
    lastHistory.current = Date.now(); future.current = []; setHistoryTick((tick) => tick + 1);
  }
  const update = (next: Partial<Content>) => { remember(); editSequence.current++; setContent((current) => ({ ...current, ...next })); setDirty(true); setMessage(""); setError(""); };
  function undo(redo = false) {
    if (busy || readOnly) return;
    const source = redo ? future.current : history.current;
    const destination = redo ? history.current : future.current;
    const previous = source.pop();
    if (!previous) return;
    destination.push({ content: structuredClone(content), localDate });
    editSequence.current++; lastHistory.current = 0;
    // Media has its own persisted lifecycle and is never undone as a text edit.
    setContent({ ...previous.content, slug: content.slug, media: content.media, refs: content.refs });
    setLocalDate(previous.localDate); setDirty(true); setError(""); setHistoryTick((tick) => tick + 1);
  }
  function selectField(field: string) {
    setSelectedField(field); setTool("content");
    requestAnimationFrame(() => {
      const key = field === "hero" ? "hosts.0.name" : field;
      const section = document.querySelector<HTMLDetailsElement>(`[data-studio-inspector~="${CSS.escape(key)}"]`);
      if (section) section.open = true;
      const input = document.querySelector<HTMLElement>(`[data-studio-input="${CSS.escape(key)}"]`);
      let parent = input?.parentElement;
      while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
      if (field === "date") input?.focus();
      else if (!["headline", "greeting", "wishes", "closing"].includes(field) && !field.startsWith("hosts.") && !field.startsWith("venue.")) section?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
  const autosave = useRef<() => Promise<void>>(async () => {});
  autosave.current = async () => {
    if (savingRef.current || busy || readOnly || !savedSlug || (!dirty && !planDirty) || failedSequence.current === editSequence.current) return;
    savingRef.current = true; setSaving(true);
    const sequence = editSequence.current;
    try { await persistSetup(); }
    catch (error) { failedSequence.current = sequence; setError(`Не удалось сохранить автоматически. ${(error as Error).message}`); }
    finally { savingRef.current = false; setSaving(false); }
  };
  useEffect(() => {
    if (!dirty && !planDirty) return;
    const timer = window.setTimeout(() => { void autosave.current(); }, 900);
    return () => window.clearTimeout(timer);
  }, [content, localDate, dirty, planDirty, busy, saving, savedSlug]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!editorMode || !(event.ctrlKey || event.metaKey) || !["z", "y"].includes(event.key.toLowerCase())) return;
      if ((event.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      event.preventDefault(); undo(event.key.toLowerCase() === "y" || event.shiftKey);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const visualOptions = <div className="studio-visual-options"><label><input type="checkbox" checked={createVisual} disabled={busy || !imagesConfigured} onChange={(event) => setCreateVisual(event.target.checked)} /> Иллюстрация, если она нужна дизайну</label><p className="studio-help">{imagesConfigured ? "Типографика, декор и эффекты собираются как сайт. Для иллюстрированной композиции создаётся один визуал. Текст остаётся редактируемым." : "Типографика, декор и эффекты собираются как сайт. Создание иллюстраций пока не подключено."}</p>{content.refs.length > 16 && <p className="studio-notice">Для иллюстрации оставьте не больше 16 референсов.</p>}</div>;
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty || planDirty) { event.preventDefault(); } };
    const navigation = (event: MouseEvent) => {
      if (!(dirty || planDirty) || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || new URL(link.href).pathname === location.pathname) return;
      if (!window.confirm("Есть несохранённые изменения. Выйти без сохранения?")) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("click", navigation, true);
    return () => { window.removeEventListener("beforeunload", handler); document.removeEventListener("click", navigation, true); };
  }, [dirty, planDirty]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);

  useEffect(() => {
    if (!generating && !refiningId && !checkingId) return;
    const start = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [generating, refiningId, checkingId]);

  async function designAction(concept: Project["concepts"][number], version: string, action: DesignAction, instruction?: string, qaOverride?: boolean) {
    if (busy || savingRef.current || readOnly || dirty || planDirty) return false;
    setBusy(true); setError(""); setMessage("");
    if (action === "refine") setRefiningId(concept.id);
    if (action === "qa") setCheckingId(concept.id);
    try {
      const data = await responseData(await fetch(`/api/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: content.slug, conceptId: concept.id, version, fromVersion: version, instruction, qaOverride, revision, planRevision, generationRevision, approvalRevision }) }));
      setConcepts(data.concepts); setGeneration(data.generation); setGenerationRevision(data.generationRevision);
      setApproval(data.approval); setApprovalRevision(data.approvalRevision);
      setApprovalQa(data.approvalQa ?? null);
      if (action === "refine" || action === "restore") setViewVersions((current) => ({ ...current, [concept.id]: data.concepts.find((next: Project["concepts"][number]) => next.id === concept.id).version }));
      setModal(null); setPreviewKey((key) => key + 1);
      setMessage(action === "qa" ? "Результат проверки сохранён на карточке варианта." : action === "refine" ? "Создана новая версия. Результат проверки — на карточке. Исходная и выбранная версии сохранены." : action === "restore" ? "Предыдущая версия снова текущая. Выбор сохранён без изменений." : `Выбрана версия v${version}${qaOverride ? " с замечаниями" : ""}. Решение сохранено в проекте.`);
      return true;
    } catch (error) { setError((error as Error).message); return false; }
    finally { setBusy(false); setRefiningId(""); setCheckingId(""); }
  }

  function validateSetup() {
    const form = document.getElementById("event-form") as HTMLFormElement;
    const invalid = form.querySelector<HTMLInputElement>("input:invalid, select:invalid, textarea:invalid");
    if (invalid) {
      let parent = invalid.parentElement;
      while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
      invalid.reportValidity(); invalid.focus();
      return false;
    }
    return true;
  }

  // Save the event and photo plan together before any action that uses them.
  async function persistSetup() {
    const sequence = editSequence.current;
    const slug = savedSlug || content.slug.trim() || `event-${crypto.randomUUID().slice(0, 8)}`;
    let currentRevision = revision;
    let currentPlanRevision = planRevision;
    let currentGenerationRevision = generationRevision;
    if (!savedSlug || dirty || content.variantCount !== 1 || initial?.content.variantCount !== 1 && revision === initial?.revision) {
      const next = { ...content, variantCount: 1, slug, date: { ...content.date, start: resolveWallTime(localDate, content.date.timezone) } };
      const data = await responseData(await fetch(savedSlug ? `/api/projects/${slug}` : "/api/projects", { method: savedSlug ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(savedSlug ? { content: next, revision } : next) }));
      currentRevision = data.revision;
      currentPlanRevision = data.planRevision ?? currentPlanRevision;
      currentGenerationRevision = data.generationRevision ?? currentGenerationRevision;
      setContent((current) => editSequence.current === sequence ? data.content : { ...current, slug });
      setRevision(currentRevision); if (editSequence.current === sequence) setDirty(false); setSavedSlug(slug);
      setPlanRevision(currentPlanRevision); setGenerationRevision(currentGenerationRevision);
    }
    if (planDirty) {
      const data = await responseData(await fetch(`/api/projects/${slug}/asset-plan`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetPlan, revision: currentRevision, planRevision: currentPlanRevision }) }));
      currentPlanRevision = data.planRevision;
      setAssetPlan(data.assetPlan); setPlanRevision(currentPlanRevision); setPlanDirty(false);
    }
    return { slug, revision: currentRevision, planRevision: currentPlanRevision, generationRevision: currentGenerationRevision };
  }

  async function generate() {
    if (busy || savingRef.current || readOnly || !validateSetup()) return;
    if (createVisual && content.refs.length > 16) { setError("Для иллюстрации оставьте до 16 референсов или выключите её создание."); return; }
    if (!content.brief?.trim()) { setError("Выберите настроение или опишите пожелания к дизайну."); return; }
    setBusy(true); setGenerating(true); setError(""); setMessage("");
    let createdSlug = "";
    try {
      const snapshot = await persistSetup();
      if (!savedSlug) createdSlug = snapshot.slug;
      const data = await responseData(await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, createVisual }) }));
      setConcepts(data.concepts); setGeneration(data.generation); setGenerationRevision(data.generationRevision);
      setApproval(data.approval); setApprovalRevision(data.approvalRevision); setViewVersions({});
      setApprovalQa(data.approvalQa ?? null);
      setRevision(data.revision); setPlanRevision(data.planRevision); setContent(data.content); setLocalDate(wallTime(data.content.date.start, data.content.date.timezone)); setModal(null); setActiveId(data.concepts[0]?.id ?? ""); setEditorMode(true); setTool("content");
      setPreviewKey((key) => key + 1); setMessage("Дизайн готов. Текст и данные можно редактировать прямо в приглашении.");
      requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); setGenerating(false); if (createdSlug) router.replace(`/studio/${createdSlug}`, { scroll: false }); }
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (readOnly || busy || savingRef.current || !validateSetup()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const snapshot = await persistSetup();
      setPreviewKey((key) => key + 1); setMessage("Изменения сохранены.");
      if (!savedSlug) router.replace(`/studio/${snapshot.slug}`, { scroll: false });
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  async function upload(files: FileList | null) {
    if (!files?.length || busy || savingRef.current || readOnly) return;
    if (!validateSetup()) { if (uploadInput.current) uploadInput.current.value = ""; return; }
    setBusy(true); setError(""); setMessage("");
    let count = 0;
    let createdSlug = "";
    try {
      const snapshot = await persistSetup();
      if (!savedSlug) createdSlug = snapshot.slug;
      let currentRevision = snapshot.revision;
      let nextPlan: AssetPlan = assetPlan;
      let photosAdded = false;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file); form.set("kind", uploadKind.current); form.set("revision", currentRevision);
        const data = await responseData(await fetch(`/api/projects/${snapshot.slug}/media`, { method: "POST", body: form }));
        currentRevision = data.revision; setRevision(currentRevision);
        setContent((current) => ({ ...current, media: data.content.media, refs: data.content.refs }));
        if (data.uploadedInfo) {
          const { id, width, height } = data.uploadedInfo;
          const info = { width, height };
          setMediaInfo((current) => ({ ...current, [id]: info }));
          // Show new photos without an extra setup step; preserve the whole frame.
          nextPlan = { ...nextPlan, assets: [...nextPlan.assets, { ...unusedAsset(id, info), role: "portrait", placement: { section: "greeting", index: data.content.media.length - 1 } }] };
          setAssetPlan(nextPlan); setPlanDirty(true); photosAdded = true;
        }
        count++;
      }
      if (photosAdded) {
        const data = await responseData(await fetch(`/api/projects/${snapshot.slug}/asset-plan`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetPlan: nextPlan, revision: currentRevision, planRevision: snapshot.planRevision }) }));
        setAssetPlan(data.assetPlan); setPlanRevision(data.planRevision); setPlanDirty(false);
      }
      setPreviewKey((key) => key + 1); setMessage(uploadKind.current === "photo" ? `Добавлено фото: ${count}. Снимки уже включены в приглашение.` : `Добавлено референсов: ${count}.`);
    } catch (error) { setError(`${count ? `Уже загружено: ${count}. ` : ""}${(error as Error).message}`); }
    finally { setBusy(false); if (uploadInput.current) uploadInput.current.value = ""; if (createdSlug) router.replace(`/studio/${createdSlug}`, { scroll: false }); }
  }
  async function remove(src: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const snapshot = await persistSetup();
      const data = await responseData(await fetch(`/api/projects/${content.slug}/media`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: snapshot.revision, src }) }));
      setRevision(data.revision); setContent((current) => ({ ...current, media: data.content.media, refs: data.content.refs }));
      setAssetPlan((current) => ({ ...current, assets: current.assets.filter((asset) => data.content.media.some((media: Content["media"][number]) => media.id === asset.id)) }));
      setPreviewKey((key) => key + 1); setMessage("Изображение удалено.");
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  const name = content.headline || content.hosts.map((host) => host.name).filter(Boolean).join(" и ") || "Новое событие";
  const direction = directionFor(content.brief);
  const active = concepts.find((concept) => concept.id === activeId) ?? concepts[0];
  const canvasConcept = active ? { ...active, version: viewVersions[active.id] ?? active.version } : null;
  const checkedActive = active ? { ...active, history: active.history?.map((entry) => ({ ...entry, ...(entry.qa ? { qa: { ...entry.qa, stale: entry.qa.stale || entry.qa.report.contentRevision !== revision || entry.qa.report.planRevision !== planRevision } } : {}) })) } : null;
  const canvasMode = editorMode && Boolean(canvasConcept);
  void historyTick;
  return <main className={`studio-main studio-editor ${canvasMode ? "studio-canvas-editor" : "studio-idea-editor"}`} data-tool={tool}>
    <div className="studio-editor-top"><Link className="studio-back" href="/studio">← Проекты</Link><div className="studio-save"><span>{generating ? `Создаём приглашение · ${elapsed} с` : busy || saving ? "Сохраняем…" : dirty || planDirty ? "Есть изменения" : savedSlug ? "Сохранено" : "Новый проект"}</span>{!readOnly && <button className="studio-secondary" type="button" disabled={busy || saving} onClick={() => { void save(); }}>Сохранить черновик</button>}</div></div>
    <div className="studio-page-heading"><div><h1>{readOnly ? "Примеры приглашений" : savedSlug ? name : "Одно приглашение. Ваша идея."}</h1><p className="studio-subtitle">{readOnly ? "Посмотрите готовые примеры или создайте своё приглашение." : canvasMode ? "Нажмите на текст в приглашении или выберите блок слева. Изменения сохраняются автоматически." : "Расскажите о событии и дизайне. Прикрепите референс — создадим одно цельное приглашение."}</p></div>{readOnly && <Link className="studio-primary" href="/studio/new">Создать своё</Link>}</div>
    <div role="status" aria-live="polite" className={message ? "studio-notice" : ""}>{message}</div>{error && <div className="studio-error" role="alert">{error}</div>}
    {canvasMode && <div className="studio-canvas-toolbar"><div className="studio-tool-tabs" role="group" aria-label="Инструменты редактора">{[["content", "Текст и блоки"], ["design", "Дизайн"], ["media", "Фото"], ["variants", "Версии"]].map(([id, label]) => <button type="button" key={id} aria-pressed={tool === id} onClick={() => setTool(id)}>{label}</button>)}</div><div className="studio-history-actions"><button type="button" aria-label="Отменить изменение" title="Отменить · Ctrl/⌘ Z" disabled={busy || !history.current.length} onClick={() => undo()}>↶</button><button type="button" aria-label="Повторить изменение" title="Повторить · Ctrl/⌘ Shift Z" disabled={busy || !future.current.length} onClick={() => undo(true)}>↷</button><Link className="studio-secondary" href={`/preview/${content.slug}/${canvasConcept!.id}/${canvasConcept!.version}`} target="_blank">Предпросмотр ↗</Link></div></div>}
    <input hidden ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { void upload(e.target.files); }} />
    <div className="studio-workspace">
      <div className="studio-setup" data-selected-field={selectedField}>
        <form id="event-form" noValidate onSubmit={save}><fieldset disabled={readOnly || busy}>
          <section className="studio-panel studio-mood" hidden={canvasMode && tool !== "design"}><div className="studio-section-title"><span className="studio-step">✧</span><div><h2>{canvasMode ? "Идея и стиль" : "С чего начнём?"}</h2><p>Расскажите, каким вы видите приглашение</p></div></div>
            <Field label="Опишите приглашение" hint="Опишите цвета, атмосферу, материалы и детали. Например: камерная свадьба, шалфейный шёлк, крупные имена и лёгкий цветочный узор."><textarea aria-label="Опишите приглашение" className="studio-idea-input" rows={5} maxLength={10000} value={content.brief ?? ""} placeholder="Хочу нежное приглашение с ощущением шёлка, светлыми цветами и красивой типографикой…" onChange={(e) => update({ brief: e.target.value || undefined })} /></Field>
            <details className="studio-vibe-picker"><summary>Выбрать вайб <span>Необязательно</span></summary><div className="studio-directions" role="group" aria-label="Настроение приглашения">{directions.map((item) => <button type="button" key={item.id} aria-pressed={direction?.id === item.id} onClick={() => { update({ brief: item.brief }); }}><span className="studio-direction-swatch" style={{ background: item.bg, color: item.ink }}><span style={{ color: item.accent }}>Aa</span><i aria-hidden="true" /></span><strong>{item.name}</strong><small>{item.note}</small>{direction?.id === item.id && <span className="studio-direction-check" aria-hidden="true">✓</span>}</button>)}</div></details>
            {direction?.id === "physical" && <a className="studio-material-examples" href="/materials" target="_blank" rel="noopener noreferrer">Посмотреть материалы и движение ↗</a>}
          </section>
          <section className="studio-panel studio-reference-start" hidden={canvasMode && tool !== "design"}><div className="studio-media-heading"><div><h2>Референсы</h2><p className="studio-help">Приглашения, цвета и фактуры, которые вам нравятся</p></div><span className="studio-draft-label">Необязательно</span></div><button type="button" aria-label="Добавить референсы" className="studio-reference-drop" disabled={busy || saving} onClick={() => { uploadKind.current = "reference"; uploadInput.current?.click(); }}><span aria-hidden="true">＋</span><strong>Добавить референсы</strong><small>JPG, PNG, WebP · до 15 МБ</small></button>{content.refs.length > 0 && <div className="studio-reference-grid">{content.refs.map((src, index) => <figure key={src}><Image unoptimized width={160} height={160} src={src} alt={`Референс ${index + 1}`} /><button type="button" aria-label={`Удалить референс ${index + 1}`} disabled={busy || saving} onClick={() => { void remove(src); }}>×</button></figure>)}</div>}<details className="studio-generation-options"><summary>Настройки создания</summary>{visualOptions}</details></section>
          <details className="studio-disclosure studio-essential studio-facts" data-studio-inspector="hero venue date" open={canvasMode} hidden={canvasMode && tool !== "content"}><summary><span>Данные события</span><small>Можно заполнить позже</small></summary><div className="studio-disclosure-body"><div className="studio-section-title"><div><h2>Ваше событие</h2><p>Что, когда и где</p></div></div><div className="studio-fields">
            {content.hosts.map((host, index) => <div className="studio-host" key={index}><Field label={`Имя ${index + 1}`}><input data-studio-input={`hosts.${index}.name`} maxLength={100} value={host.name} placeholder={index ? "Амина" : "Рустам"} onChange={(e) => update({ hosts: content.hosts.map((h, i) => i === index ? { ...h, name: e.target.value } : h) })} /></Field>{content.hosts.length > 1 && <button type="button" aria-label={`Удалить имя ${index + 1}`} className="studio-remove" onClick={() => update({ hosts: content.hosts.filter((_, i) => i !== index) })}>×</button>}</div>)}
            <button type="button" className="studio-text-button studio-field-wide" disabled={content.hosts.length >= 12} onClick={() => update({ hosts: [...content.hosts, { name: "" }] })}>+ Добавить имя</button>

            <Field label="Дата" wide><input data-studio-input="date" type="date" aria-label="Дата" value={localDate.slice(0, 10) || content.date.day || ""} onChange={(e) => { update({ date: { ...content.date, day: e.target.value || undefined } }); if (localDate) setLocalDate(e.target.value ? `${e.target.value}T${localDate.slice(11, 16)}` : ""); }} /></Field><Field label="Время" hint="Необязательно" wide><input type="time" aria-label="Время" disabled={!localDate.slice(0, 10) && !content.date.day} value={localDate.slice(11, 16)} onChange={(e) => { const day = localDate.slice(0, 10) || content.date.day; update({ date: { ...content.date, day } }); setLocalDate(e.target.value && day ? `${day}T${e.target.value}` : ""); }} /></Field>
            <Field label="Название места" wide><input data-studio-input="venue.name" value={content.venue.name} maxLength={200} placeholder="Сад «Навруз»" onChange={(e) => update({ venue: { ...content.venue, name: e.target.value } })} /></Field>
            <Field label="Адрес" wide><input data-studio-input="venue.address" value={content.venue.address} maxLength={400} placeholder="Город, улица, дом" onChange={(e) => update({ venue: { ...content.venue, address: e.target.value } })} /></Field>
          </div></div></details>
          <div className="studio-extras" hidden={!canvasMode || tool !== "content"}><p className="studio-extras-label">Добавьте, если нужно</p>
            <details className="studio-disclosure" data-studio-inspector="greeting timeline wishes footer closing"><summary><span>Слова и программа</span><small>{content.timeline.length ? `${content.timeline.length} пунктов` : "Необязательно"}</small></summary><div className="studio-disclosure-body"><div className="studio-fields">
            <Field label="Заключительная фраза" wide><textarea data-studio-input="closing" rows={2} value={content.closing ?? ""} placeholder="До встречи на празднике…" onChange={(e) => update({ closing: e.target.value || undefined })} /></Field><Field label="Обращение к гостям" wide><textarea data-studio-input="greeting" rows={5} value={content.greeting ?? ""} placeholder="Мы будем рады разделить этот день с вами…" onChange={(e) => update({ greeting: e.target.value || undefined })} /></Field><Field label="Пожелания гостям" hint="Например, про цветы, подарки или важные детали. Этот блок появится перед ответом гостей и прощанием." wide><textarea data-studio-input="wishes" rows={3} maxLength={10000} value={content.wishes ?? ""} onChange={(e) => update({ wishes: e.target.value || undefined })} /></Field>
          </div><div className="studio-timeline">{content.timeline.map((item, index) => <div className="studio-timeline-row" key={index}>
            <Field label="Время"><input type="time" required value={item.time} onChange={(e) => update({ timeline: content.timeline.map((v, i) => i === index ? { ...v, time: e.target.value } : v) })} /></Field>
            <Field label="Что запланировано"><input required value={item.title} maxLength={200} onChange={(e) => update({ timeline: content.timeline.map((v, i) => i === index ? { ...v, title: e.target.value } : v) })} /></Field>
            <button className="studio-remove" type="button" aria-label={`Удалить пункт программы ${index + 1}`} onClick={() => update({ timeline: content.timeline.filter((_, i) => i !== index) })}>×</button>
            <Field label="Подробности" wide><input value={item.note ?? ""} onChange={(e) => update({ timeline: content.timeline.map((v, i) => i === index ? { ...v, note: e.target.value || undefined } : v) })} /></Field>
          </div>)}<button type="button" className="studio-text-button" disabled={content.timeline.length >= 40} onClick={() => update({ timeline: [...content.timeline, { time: "", title: "" }] })}>+ Добавить пункт программы</button></div>

            </div></details>
            <details className="studio-disclosure" data-studio-inspector="dressCode rsvp"><summary><span>Дресс-код и ответ гостей</span><small>{content.dressCode || content.rsvp?.enabled ? "Добавлено" : "Необязательно"}</small></summary><div className="studio-disclosure-body"><div className="studio-fields">
            <label className="studio-check studio-field-wide"><input type="checkbox" checked={Boolean(content.dressCode)} onChange={(e) => update({ dressCode: e.target.checked ? { title: "", swatches: [] } : undefined })} />Добавить дресс-код</label>
            {content.dressCode && <><Field label="Название дресс-кода" wide><input required value={content.dressCode.title} onChange={(e) => update({ dressCode: { ...content.dressCode!, title: e.target.value } })} /></Field><Field label="Пожелания к одежде" wide><textarea rows={2} value={content.dressCode.note ?? ""} onChange={(e) => update({ dressCode: { ...content.dressCode!, note: e.target.value || undefined } })} /></Field><div className="studio-swatches studio-field-wide">{content.dressCode.swatches.map((color, index) => <label key={index}>Цвет {index + 1}<input type="color" value={color} onChange={(e) => update({ dressCode: { ...content.dressCode!, swatches: content.dressCode!.swatches.map((v, i) => i === index ? e.target.value : v) } })} /><button type="button" aria-label={`Удалить цвет ${index + 1}`} onClick={() => update({ dressCode: { ...content.dressCode!, swatches: content.dressCode!.swatches.filter((_, i) => i !== index) } })}>×</button></label>)}<button type="button" className="studio-text-button" disabled={content.dressCode.swatches.length >= 8} onClick={() => update({ dressCode: { ...content.dressCode!, swatches: [...content.dressCode!.swatches, "#BEC5AF"] } })}>+ Цвет</button></div></>}
            <label className="studio-check studio-field-wide"><input type="checkbox" checked={content.rsvp?.enabled ?? false} onChange={(e) => update({ rsvp: { enabled: e.target.checked, mode: content.rsvp?.mode ?? "telegram", target: content.rsvp?.target ?? "", askGuestCount: content.rsvp?.askGuestCount ?? true, deadline: content.rsvp?.deadline } })} />Попросить подтвердить участие</label>
            {content.rsvp?.enabled && <><Field label="Способ ответа"><select value={content.rsvp.mode} onChange={(e) => update({ rsvp: { ...content.rsvp!, mode: e.target.value as "telegram" | "phone" | "form", target: "" } })}><option value="telegram">Telegram</option><option value="phone">Телефон</option><option value="form">Форма на ваш сервер</option></select></Field><Field label={content.rsvp.mode === "telegram" ? "Имя в Telegram" : content.rsvp.mode === "phone" ? "Номер телефона" : "Адрес приёма формы"} hint={content.rsvp.mode === "form" ? "Ваш сервер должен принимать name, attendance и guests." : undefined}><input required value={content.rsvp.target} placeholder={content.rsvp.mode === "telegram" ? "@username" : content.rsvp.mode === "phone" ? "+998…" : "https://…"} onChange={(e) => update({ rsvp: { ...content.rsvp!, target: e.target.value } })} /></Field><Field label="Ответить до"><input type="date" value={content.rsvp.deadline?.slice(0, 10) ?? ""} onChange={(e) => update({ rsvp: { ...content.rsvp!, deadline: e.target.value || undefined } })} /></Field>{content.rsvp.mode === "form" && <label className="studio-check"><input type="checkbox" checked={content.rsvp.askGuestCount} onChange={(e) => update({ rsvp: { ...content.rsvp!, askGuestCount: e.target.checked } })} />Спрашивать число гостей</label>}</>}

            </div></div></details>
            <details className="studio-disclosure"><summary><span>Другие настройки</span><small>Язык и карта</small></summary><div className="studio-disclosure-body"><div className="studio-fields">
            <Field label="Тип события"><select value={content.eventType} onChange={(e) => update({ eventType: e.target.value as Content["eventType"] })}>{Object.entries(eventTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Язык приглашения"><select value={content.locale} onChange={(e) => update({ locale: e.target.value as Content["locale"] })}><option value="ru">Русский</option><option value="uz-latn">O‘zbekcha</option><option value="en">English</option></select></Field>
            <Field label="Заголовок вместо имён" hint="Необязательно. Например, «Вечер в кругу близких»." wide><input data-studio-input="headline" value={content.headline ?? ""} maxLength={200} onChange={(e) => update({ headline: e.target.value || undefined })} /></Field>
            {!savedSlug && <Field label="Адрес проекта" hint="Необязательно: латиница, цифры и дефисы. Если оставить пустым, адрес создастся автоматически." wide><input pattern="[a-z0-9][a-z0-9-]{0,63}" value={content.slug} placeholder="rustam-amina" onChange={(e) => update({ slug: e.target.value })} /></Field>}
            <Field label="Часовой пояс"><input required list="timezones" value={content.date.timezone} onChange={(e) => update({ date: { ...content.date, timezone: e.target.value } })} /><datalist id="timezones"><option value="Asia/Tashkent" /><option value="Europe/Moscow" /><option value="Asia/Almaty" /><option value="Asia/Dubai" /><option value="Europe/London" /><option value="America/New_York" /></datalist></Field>
            <label className="studio-check studio-field-wide"><input type="checkbox" checked={content.date.showCountdown} onChange={(e) => update({ date: { ...content.date, showCountdown: e.target.checked } })} />Показывать обратный отсчёт</label>
            <Field label="Ссылка на карту" wide><input type="url" value={content.venue.mapUrl ?? ""} placeholder="https://…" onChange={(e) => update({ venue: { ...content.venue, mapUrl: e.target.value || undefined } })} /></Field>
            <Field label="Как добраться и что учесть" wide><textarea data-studio-input="venue.note" rows={2} value={content.venue.note ?? ""} onChange={(e) => update({ venue: { ...content.venue, note: e.target.value || undefined } })} /></Field>

            </div>{visualOptions}</div></details>
          </div>
        </fieldset></form>
        <details className="studio-disclosure studio-upload-disclosure" open={canvasMode && tool === "media"} hidden={canvasMode && tool !== "media"}><summary><span>Фото и референсы</span><small>{content.media.length + content.refs.length ? `${content.media.length + content.refs.length} файлов` : "Необязательно"}</small></summary><div className="studio-disclosure-body">
        {(["photo"] as ("photo" | "reference")[]).map((kind) => { const sources = kind === "photo" ? content.media.map((media) => media.src) : content.refs; return <div className="studio-media-section" key={kind}><div className="studio-media-heading"><h3>{kind === "photo" ? "Ваши фотографии" : "Референсы дизайна"} <span>{sources.length}</span></h3><button type="button" className="studio-text-button" disabled={busy || readOnly} onClick={() => { uploadKind.current = kind; uploadInput.current?.click(); }}>Добавить</button></div>{sources.length ? <div className="studio-media-grid">{sources.map((src, index) => <figure key={src}><Image unoptimized width={480} height={360} src={src} alt={`${kind === "photo" ? "Фотография" : "Референс"} ${index + 1}`} /><figcaption><span>{kind === "photo" ? "Фото" : "Референс"} {index + 1}</span><button type="button" aria-label={`Удалить ${kind === "photo" ? "фотографию" : "референс"} ${index + 1}`} disabled={busy || readOnly} onClick={() => { void remove(src); }}>Удалить</button></figcaption></figure>)}</div> : <div className="studio-upload-empty"><span aria-hidden="true">↑</span><p>{kind === "photo" ? "Портреты, место встречи, детали события" : "Фактуры, узоры и приглашения, которые вам нравятся"}</p><small>JPG, PNG, WebP · до 15 МБ каждый</small></div>}</div>; })}

          <p className="studio-help">Фото появятся в приглашении целиком. Референсы помогут определить стиль.</p>
          {savedSlug && content.media.length > 0 && <details className="studio-photo-advanced"><summary>Настроить кадры и обработку</summary><AssetDirector key={`${planRevision}-${content.media.map((media) => media.id).join("-")}`} content={content} revision={revision} planRevision={planRevision} initialPlan={assetPlan} info={mediaInfo} disabled={busy} readOnly={readOnly} visionConfigured={visionConfigured} onBusy={setBusy} onDirty={setPlanDirty} onPlanChange={(plan) => { editSequence.current++; setAssetPlan(plan); }} onMessage={(text, isError) => { setMessage(isError ? "" : text); setError(isError ? text : ""); }} onSaved={(plan, nextRevision) => { setAssetPlan(plan); setPlanRevision(nextRevision); setPreviewKey((key) => key + 1); }} /></details>}
        </div></details>

        {canvasMode && tool === "variants" && <section className="studio-panel"><h2>Ваши варианты</h2><p className="studio-help">Откройте дизайн в редакторе. Выбор для отправки гостям доступен после проверки.</p>{concepts.map((concept, index) => <button type="button" className="studio-variant-choice" key={concept.id} aria-pressed={active?.id === concept.id} onClick={() => { setActiveId(concept.id); }}><span>0{index + 1}</span><strong>{concept.theme.meta.name}</strong><span aria-hidden="true">→</span></button>)}</section>}
      </div>
      <section className="studio-results" hidden={!concepts.length} ref={results} aria-label="Предпросмотр приглашения" aria-busy={generating}>
        <div className="studio-preview-heading"><div><p className="studio-eyebrow">{canvasMode ? "Визуальный редактор" : concepts.length ? "Готовые варианты" : "Предпросмотр"}</p><h2>{canvasMode ? active?.theme.meta.name : concepts.length ? "Выберите свой дизайн" : "Начинается с вашей истории"}</h2></div>{concepts.length > 0 ? <div className="studio-view-toggle" aria-label="Ширина предпросмотра"><button type="button" aria-pressed={viewport === "phone"} onClick={() => setViewport("phone")}>Телефон</button><button type="button" aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>Компьютер</button></div> : <span className="studio-draft-label">Эскиз</span>}</div>
        {generating && <div className="studio-generating" role="status"><span className="studio-spinner" aria-hidden="true" /><div><strong>Создаём ваше приглашение</strong><p>Готовим оригинальную графику и одну композицию по вашим референсам.</p></div></div>}
        {!canvasMode && (dirty || planDirty) && concepts.length > 0 && <p className="studio-notice">В вариантах — сохранённые данные. Сохраните черновик перед выбором или доработкой.</p>}
        {approval && <div className="studio-panel studio-approved"><div><span className="studio-eyebrow">Ваш выбор</span><h3>{concepts.find((concept) => concept.id === approval.conceptId)?.theme.meta.name ?? "Вариант из предыдущей серии"} · v{approval.version}</h3>{(!approvalQa || approvalQa.stale || approvalQa.report.contentRevision !== revision || approvalQa.report.planRevision !== planRevision || dirty || planDirty) && <p>После изменений нужно повторить проверку.</p>}</div><Link className="studio-secondary" href={`/preview/${content.slug}/${approval.conceptId}/${approval.version}`} target="_blank">Открыть приглашение ↗</Link></div>}
        {canvasMode ? <InvitationCanvas revision={previewKey} disabled={busy} concept={canvasConcept!} content={content} localDate={localDate} viewport={viewport} onEdit={(field, text) => { const next = editCanvasText(content, field, text); if (next) update(next); }} onSelect={selectField} onHistory={undo} /> : concepts.length === 0 ? null :
<div className="studio-preview-grid">{concepts.map((concept, index) => {
          const version = viewVersions[concept.id] ?? concept.version;
          const showing = { ...concept, version };
          const checked = { ...concept, history: concept.history?.map((entry) => ({ ...entry, ...(entry.qa ? { qa: { ...entry.qa, stale: entry.qa.stale || entry.qa.report.contentRevision !== revision || entry.qa.report.planRevision !== planRevision } } : {}) })) };
          return <article className="studio-preview-card" key={concept.id}><PreviewWindow key={`${previewKey}-${viewport}-${version}`} concept={showing} slug={content.slug} revision={previewKey} viewport={viewport} onOpen={() => setModal(showing)} /><button type="button" className="studio-secondary studio-open-editor" disabled={readOnly} onClick={() => { setActiveId(concept.id); setEditorMode(true); setTool("content"); }}>Редактировать приглашение</button><div className="studio-preview-caption"><span>0{index + 1}</span><h3>{concept.theme.meta.name}</h3><button type="button" aria-label={`Открыть ${concept.theme.meta.name}`} onClick={() => setModal(showing)}>↗</button></div><p>{concept.theme.meta.rationale}</p>{!readOnly && <ConceptControls concept={checked} version={version} approval={approval} disabled={busy} pendingEdits={dirty || planDirty} configured={visionConfigured} refining={refiningId === concept.id} checking={checkingId === concept.id} elapsed={elapsed} onView={(next) => setViewVersions((current) => ({ ...current, [concept.id]: next }))} onAction={(action, instruction, qaOverride) => designAction(concept, version, action, instruction, qaOverride)} />}</article>;
        })}</div>}
        {canvasMode && tool === "variants" && <div className="studio-panel studio-active-controls"><h3>{active?.theme.meta.name}</h3><ConceptControls concept={checkedActive!} version={canvasConcept!.version} approval={approval} disabled={busy || saving} pendingEdits={dirty || planDirty} configured={visionConfigured} refining={refiningId === active?.id} checking={checkingId === active?.id} elapsed={elapsed} onView={(version) => setViewVersions((current) => ({ ...current, [active!.id]: version }))} onAction={(action, instruction, qaOverride) => designAction(active!, canvasConcept!.version, action, instruction, qaOverride)} /></div>}
        {canvasMode && tool === "design" && <div className="studio-panel studio-active-controls"><h3>Изменить этот дизайн</h3><p className="studio-help">Опишите правку: например, «сделай имена крупнее, фон темнее». Получится новая версия текущего дизайна.</p><ConceptControls concept={checkedActive!} version={canvasConcept!.version} approval={approval} disabled={busy || saving} pendingEdits={dirty || planDirty} configured={visionConfigured} refining={refiningId === active?.id} checking={checkingId === active?.id} elapsed={elapsed} onView={(version) => setViewVersions((current) => ({ ...current, [active!.id]: version }))} onAction={(action, instruction, qaOverride) => designAction(active!, canvasConcept!.version, action, instruction, qaOverride)} /></div>}
        {generation && <details className="studio-series-details"><summary>Как мы поняли ваш стиль</summary><div className="studio-series-summary"><div><h3>{generation.style.name}</h3><p>{generation.style.rationale}</p></div><div className="studio-series-colors" aria-label="Общая палитра">{Object.values(generation.style.palette).map((color, index) => <span key={index} style={{ background: color }} title={color} />)}</div></div>{generation.style.intent && <div className="studio-design-intent"><div><p>{generation.style.intent.summary}</p><ul>{generation.style.intent.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul>{generation.style.intent.referenceNotes && <p>{generation.style.intent.referenceNotes}</p>}</div>{generation.style.generatedVisual && <figure><Image src={`/art/${content.slug}/${generation.style.generatedVisual.id}`} width={generation.style.generatedVisual.width} height={generation.style.generatedVisual.height} unoptimized alt="Иллюстрация для серии приглашений" /></figure>}</div>}</details>}
        {generation && generation.brief !== content.brief && <p className="studio-help">Настроение изменилось. Создайте новые дизайны, чтобы применить его.</p>}
      </section>
    </div>
        {!readOnly && (!canvasMode || tool === "design") && <div className="studio-create-bar"><div className="studio-create-inner"><button type="button" className="studio-primary" disabled={busy || saving || !visionConfigured} onClick={() => { void generate(); }}><span aria-hidden="true">✧</span>{generating ? `Создаём приглашение · ${elapsed} с` : concepts.length ? "Создать заново" : "Создать приглашение"}<span aria-hidden="true">→</span></button><p>{generating ? "Это займёт несколько минут. Данные уже сохранены." : "Один дизайн · оригинальная композиция по референсу"}</p>{!visionConfigured && <p>Генерация пока не подключена. Можно сохранить черновик.</p>}</div></div>}
    <dialog ref={dialog} aria-labelledby="studio-dialog-title" className="studio-preview-dialog" onCancel={() => setModal(null)} onClose={() => setModal(null)}><div className="studio-dialog-heading"><h2 id="studio-dialog-title">{modal?.theme.meta.name}</h2>{modal && <Link href={`/preview/${content.slug}/${modal.id}/${modal.version}`} target="_blank">Открыть отдельно ↗</Link>}<button type="button" autoFocus aria-label="Закрыть предпросмотр" onClick={() => setModal(null)}>×</button></div>{modal && <iframe title={`Полный предпросмотр: ${modal.theme.meta.name}`} src={`/preview/${content.slug}/${modal.id}/${modal.version}?embed=1&saved=${previewKey}`} sandbox="allow-scripts allow-same-origin" />}</dialog>
  </main>;
}
