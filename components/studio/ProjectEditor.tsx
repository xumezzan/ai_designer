"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Content } from "@/lib/schema/content";
import type { Project } from "@/lib/studio/store";
import { resolveWallTime, wallTime } from "@/lib/studio/date";

const blank: Content = {
  slug: "", locale: "ru", eventType: "wedding", hosts: [{ name: "" }, { name: "" }], greeting: "",
  date: { start: "", timezone: "Asia/Tashkent", showCountdown: true }, venue: { name: "", address: "" },
  timeline: [], media: [], refs: [], brief: "",
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
  const scale = Math.min(phone ? .72 : .6, Math.max(width - 24, 1) / frameWidth);
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

export function ProjectEditor({ initial }: { initial?: Project }) {
  const router = useRouter();
  const [content, setContent] = useState<Content>(initial?.content ?? blank);
  const [revision, setRevision] = useState(initial?.revision ?? "");
  const [localDate, setLocalDate] = useState(initial ? wallTime(initial.content.date.start, initial.content.date.timezone) : "");
  const [tab, setTab] = useState("event");
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
  const update = (next: Partial<Content>) => { setContent((current) => ({ ...current, ...next })); setDirty(true); setMessage(""); setError(""); };
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); } };
    const navigation = (event: MouseEvent) => {
      if (!dirty || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || new URL(link.href).pathname === location.pathname) return;
      if (!window.confirm("Есть несохранённые изменения. Выйти без сохранения?")) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("click", navigation, true);
    return () => { window.removeEventListener("beforeunload", handler); document.removeEventListener("click", navigation, true); };
  }, [dirty]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const slug = initial ? content.slug : content.slug.trim() || `event-${crypto.randomUUID().slice(0, 8)}`;
      const next = { ...content, slug, date: { ...content.date, start: resolveWallTime(localDate, content.date.timezone) } };
      const response = await fetch(initial ? `/api/projects/${slug}` : "/api/projects", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(initial ? { content: next, revision } : next) });
      const data = await responseData(response);
      setContent(data.content); setRevision(data.revision); setDirty(false); setPreviewKey((key) => key + 1);
      setMessage("Сохранено. Все пять приглашений обновлены.");
      if (!initial) router.replace(`/studio/${slug}`);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function upload(files: FileList | null) {
    if (!files?.length || busy || !initial || readOnly) return;
    setBusy(true); setError(""); setMessage("");
    let currentRevision = revision;
    let count = 0;
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file); form.set("kind", uploadKind.current); form.set("revision", currentRevision);
        const data = await responseData(await fetch(`/api/projects/${content.slug}/media`, { method: "POST", body: form }));
        currentRevision = data.revision; setRevision(currentRevision);
        setContent((current) => ({ ...current, media: data.content.media, refs: data.content.refs }));
        count++;
      }
      setMessage(`Загружено изображений: ${count}.`);
    } catch (error) { setError(`${count ? `Уже загружено: ${count}. ` : ""}${(error as Error).message}`); }
    finally { setBusy(false); if (uploadInput.current) uploadInput.current.value = ""; }
  }
  async function remove(src: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await responseData(await fetch(`/api/projects/${content.slug}/media`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, src }) }));
      setRevision(data.revision); setContent((current) => ({ ...current, media: data.content.media, refs: data.content.refs }));
      setMessage("Изображение удалено из проекта.");
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  const name = content.headline || content.hosts.map((host) => host.name).filter(Boolean).join(" и ") || "Новое событие";
  function submitFromToolbar() {
    const form = document.getElementById("event-form") as HTMLFormElement;
    if (!form.checkValidity()) { setTab("event"); window.setTimeout(() => form.requestSubmit(), 0); }
    else form.requestSubmit();
  }
  const tabs = [{ id: "event", label: "Анкета", number: "01" }, { id: "media", label: "Фотографии и референсы", number: "02" }, { id: "designs", label: "Пять дизайнов", number: "03" }];
  return <main className="studio-main studio-editor"><Link className="studio-back" href="/studio">← Все проекты</Link>
    <div className="studio-page-heading"><div><p className="studio-eyebrow">{initial ? "Мастерская приглашения" : "Начнём с вашей истории"}</p><h1>{name}</h1><p className="studio-subtitle">{readOnly ? "Демо доступно для просмотра. Создайте проект, чтобы заполнить свои данные." : "Детали события, ваши фотографии и пять разных настроений."}</p></div>{readOnly ? <Link className="studio-primary" href="/studio/new">+ Свой проект</Link> : <div className="studio-save"><span>{busy ? "Сохраняем…" : dirty ? "Есть изменения" : initial ? "Все изменения сохранены" : "Новый проект"}</span><button className="studio-primary" type="button" onClick={submitFromToolbar} disabled={busy}>{initial ? "Сохранить" : "Создать проект"}</button></div>}</div>
    <div role="status" aria-live="polite" className={message ? "studio-notice" : ""}>{message}</div>{error && <div className="studio-error" role="alert">{error}</div>}
    <div className="studio-editor-layout"><aside className="studio-sidebar"><nav aria-label="Разделы проекта">{tabs.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} aria-label={`${item.number} ${item.label}`} onClick={() => { setTab(item.id); setError(""); }}><span>{item.number}</span><span className="studio-nav-desktop">{item.label}</span><span className="studio-nav-mobile">{item.id === "media" ? "Материалы" : item.id === "designs" ? "Дизайны" : "Анкета"}</span></button>)}</nav><p>Пять готовых композиций.<br />Одна ваша история.</p>{initial && <small>/{content.slug}</small>}</aside>
    <div className="studio-editor-content">
      <div hidden={tab !== "event"}>
        <form id="event-form" onSubmit={save}><fieldset disabled={readOnly || busy}>
          <section className="studio-panel"><div className="studio-panel-heading"><span>01</span><div><h2>О событии</h2><p>Имена и факты останутся живым текстом во всех дизайнах.</p></div></div><div className="studio-fields">
            <Field label="Тип события"><select value={content.eventType} onChange={(e) => update({ eventType: e.target.value as Content["eventType"] })}>{Object.entries(eventTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Язык приглашения"><select value={content.locale} onChange={(e) => update({ locale: e.target.value as Content["locale"] })}><option value="ru">Русский</option><option value="uz-latn">O‘zbekcha</option><option value="en">English</option></select></Field>
            {content.hosts.map((host, index) => <div className="studio-host" key={index}><Field label={`Имя ${index + 1}`}><input required maxLength={100} value={host.name} placeholder={index ? "Например, Амина" : "Например, Рустам"} onChange={(e) => update({ hosts: content.hosts.map((h, i) => i === index ? { ...h, name: e.target.value } : h) })} /></Field>{content.hosts.length > 1 && <button type="button" aria-label={`Удалить имя ${index + 1}`} className="studio-remove" onClick={() => update({ hosts: content.hosts.filter((_, i) => i !== index) })}>×</button>}</div>)}
            <button type="button" className="studio-text-button studio-field-wide" disabled={content.hosts.length >= 12} onClick={() => update({ hosts: [...content.hosts, { name: "" }] })}>+ Добавить имя</button>
            <Field label="Заголовок вместо имён" hint="Необязательно. Например, «Вечер в кругу близких»." wide><input value={content.headline ?? ""} maxLength={200} onChange={(e) => update({ headline: e.target.value || undefined })} /></Field>
            {!initial && <Field label="Адрес проекта" hint="Необязательно: латиница, цифры и дефисы. Если оставить пустым, адрес создастся автоматически." wide><input pattern="[a-z0-9][a-z0-9-]{0,63}" value={content.slug} placeholder="rustam-amina" onChange={(e) => update({ slug: e.target.value })} /></Field>}
          </div></section>
          <section className="studio-panel"><div className="studio-panel-heading"><span>02</span><div><h2>Когда и где</h2><p>Местное время события, а не время устройства.</p></div></div><div className="studio-fields">
            <Field label="Дата и время"><input required type="datetime-local" value={localDate} onChange={(e) => { setLocalDate(e.target.value); update({}); }} /></Field>
            <Field label="Часовой пояс"><input required list="timezones" value={content.date.timezone} onChange={(e) => update({ date: { ...content.date, timezone: e.target.value } })} /><datalist id="timezones"><option value="Asia/Tashkent" /><option value="Europe/Moscow" /><option value="Asia/Almaty" /><option value="Asia/Dubai" /><option value="Europe/London" /><option value="America/New_York" /></datalist></Field>
            <label className="studio-check studio-field-wide"><input type="checkbox" checked={content.date.showCountdown} onChange={(e) => update({ date: { ...content.date, showCountdown: e.target.checked } })} />Показывать обратный отсчёт</label>
            <Field label="Название места"><input required value={content.venue.name} maxLength={200} placeholder="Сад «Навруз»" onChange={(e) => update({ venue: { ...content.venue, name: e.target.value } })} /></Field>
            <Field label="Адрес"><input required value={content.venue.address} maxLength={400} placeholder="Город, улица, дом" onChange={(e) => update({ venue: { ...content.venue, address: e.target.value } })} /></Field>
            <Field label="Ссылка на карту" wide><input type="url" value={content.venue.mapUrl ?? ""} placeholder="https://…" onChange={(e) => update({ venue: { ...content.venue, mapUrl: e.target.value || undefined } })} /></Field>
            <Field label="Как добраться и что учесть" wide><textarea rows={2} value={content.venue.note ?? ""} onChange={(e) => update({ venue: { ...content.venue, note: e.target.value || undefined } })} /></Field>
          </div></section>
          <section className="studio-panel"><div className="studio-panel-heading"><span>03</span><div><h2>Слова и программа</h2><p>Добавьте только те подробности, которыми хотите поделиться.</p></div></div><div className="studio-fields">
            <Field label="Обращение к гостям" wide><textarea rows={5} value={content.greeting ?? ""} placeholder="Мы будем рады разделить этот день с вами…" onChange={(e) => update({ greeting: e.target.value || undefined })} /></Field>
          </div><div className="studio-timeline">{content.timeline.map((item, index) => <div className="studio-timeline-row" key={index}>
            <Field label="Время"><input type="time" required value={item.time} onChange={(e) => update({ timeline: content.timeline.map((v, i) => i === index ? { ...v, time: e.target.value } : v) })} /></Field>
            <Field label="Что запланировано"><input required value={item.title} maxLength={200} onChange={(e) => update({ timeline: content.timeline.map((v, i) => i === index ? { ...v, title: e.target.value } : v) })} /></Field>
            <button className="studio-remove" type="button" aria-label={`Удалить пункт программы ${index + 1}`} onClick={() => update({ timeline: content.timeline.filter((_, i) => i !== index) })}>×</button>
            <Field label="Подробности" wide><input value={item.note ?? ""} onChange={(e) => update({ timeline: content.timeline.map((v, i) => i === index ? { ...v, note: e.target.value || undefined } : v) })} /></Field>
          </div>)}<button type="button" className="studio-text-button" disabled={content.timeline.length >= 40} onClick={() => update({ timeline: [...content.timeline, { time: "17:00", title: "" }] })}>+ Добавить пункт программы</button></div>
          </section>
          <section className="studio-panel"><div className="studio-panel-heading"><span>04</span><div><h2>Дресс-код и ответ гостей</h2><p>Условия, которые помогут гостям подготовиться.</p></div></div><div className="studio-fields">
            <label className="studio-check studio-field-wide"><input type="checkbox" checked={Boolean(content.dressCode)} onChange={(e) => update({ dressCode: e.target.checked ? { title: "", swatches: [] } : undefined })} />Добавить дресс-код</label>
            {content.dressCode && <><Field label="Название дресс-кода" wide><input required value={content.dressCode.title} onChange={(e) => update({ dressCode: { ...content.dressCode!, title: e.target.value } })} /></Field><Field label="Пожелания к одежде" wide><textarea rows={2} value={content.dressCode.note ?? ""} onChange={(e) => update({ dressCode: { ...content.dressCode!, note: e.target.value || undefined } })} /></Field><div className="studio-swatches studio-field-wide">{content.dressCode.swatches.map((color, index) => <label key={index}>Цвет {index + 1}<input type="color" value={color} onChange={(e) => update({ dressCode: { ...content.dressCode!, swatches: content.dressCode!.swatches.map((v, i) => i === index ? e.target.value : v) } })} /><button type="button" aria-label={`Удалить цвет ${index + 1}`} onClick={() => update({ dressCode: { ...content.dressCode!, swatches: content.dressCode!.swatches.filter((_, i) => i !== index) } })}>×</button></label>)}<button type="button" className="studio-text-button" disabled={content.dressCode.swatches.length >= 8} onClick={() => update({ dressCode: { ...content.dressCode!, swatches: [...content.dressCode!.swatches, "#BEC5AF"] } })}>+ Цвет</button></div></>}
            <label className="studio-check studio-field-wide"><input type="checkbox" checked={content.rsvp?.enabled ?? false} onChange={(e) => update({ rsvp: { enabled: e.target.checked, mode: content.rsvp?.mode ?? "telegram", target: content.rsvp?.target ?? "", askGuestCount: content.rsvp?.askGuestCount ?? true, deadline: content.rsvp?.deadline } })} />Попросить подтвердить участие</label>
            {content.rsvp?.enabled && <><Field label="Способ ответа"><select value={content.rsvp.mode} onChange={(e) => update({ rsvp: { ...content.rsvp!, mode: e.target.value as "telegram" | "phone" | "form", target: "" } })}><option value="telegram">Telegram</option><option value="phone">Телефон</option><option value="form">Форма на ваш сервер</option></select></Field><Field label={content.rsvp.mode === "telegram" ? "Имя в Telegram" : content.rsvp.mode === "phone" ? "Номер телефона" : "Адрес приёма формы"} hint={content.rsvp.mode === "form" ? "Ваш сервер должен принимать name, attendance и guests." : undefined}><input required value={content.rsvp.target} placeholder={content.rsvp.mode === "telegram" ? "@username" : content.rsvp.mode === "phone" ? "+998…" : "https://…"} onChange={(e) => update({ rsvp: { ...content.rsvp!, target: e.target.value } })} /></Field><Field label="Ответить до"><input type="date" value={content.rsvp.deadline?.slice(0, 10) ?? ""} onChange={(e) => update({ rsvp: { ...content.rsvp!, deadline: e.target.value || undefined } })} /></Field>{content.rsvp.mode === "form" && <label className="studio-check"><input type="checkbox" checked={content.rsvp.askGuestCount} onChange={(e) => update({ rsvp: { ...content.rsvp!, askGuestCount: e.target.checked } })} />Спрашивать число гостей</label>}</>}
          </div></section>
          <section className="studio-panel"><div className="studio-panel-heading"><span>05</span><div><h2>Настроение приглашения</h2><p>Опишите материалы, цвета и ощущения, которые вам близки.</p></div></div><Field label="Пожелания к дизайну"><textarea rows={4} value={content.brief ?? ""} placeholder="Бархат, глубокий винный цвет, тонкая вышивка. Хочется тёплого семейного вечера…" onChange={(e) => update({ brief: e.target.value || undefined })} /></Field><p className="studio-help">Бриф сохраняется для дальнейшей генерации. Сейчас доступны пять готовых дизайнов коллекции.</p></section>
        </fieldset><div className="studio-form-footer">{!readOnly && <button className="studio-primary" disabled={busy} type="submit">{busy ? "Сохраняем…" : initial ? "Сохранить и обновить приглашения" : "Создать проект и увидеть дизайны"}</button>}</div></form>
      </div>
      <section hidden={tab !== "media"} className="studio-panel"><div className="studio-panel-heading"><span>02</span><div><h2>Визуальная история</h2><p>Соберите фотографии события и примеры оформления.</p></div></div>{!initial ? <div className="studio-empty"><h3>Сначала создайте проект</h3><p>Заполните имена, дату и место в анкете. После сохранения можно загрузить изображения.</p><button className="studio-secondary" onClick={() => setTab("event")}>Перейти к анкете</button></div> : <>
        <input hidden ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { void upload(e.target.files); }} />
        {(["photo", "reference"] as const).map((kind) => { const sources = kind === "photo" ? content.media.map((media) => media.src) : content.refs; return <div className="studio-media-section" key={kind}><div className="studio-media-heading"><h3>{kind === "photo" ? "Ваши фотографии" : "Референсы дизайна"} <span>{sources.length}</span></h3><button type="button" className="studio-secondary" disabled={busy || readOnly} onClick={() => { uploadKind.current = kind; uploadInput.current?.click(); }}>+ Загрузить</button></div>{sources.length ? <div className="studio-media-grid">{sources.map((src, index) => <figure key={src}><Image unoptimized width={480} height={360} src={src} alt={`${kind === "photo" ? "Фотография" : "Референс"} ${index + 1}`} /><figcaption><span>{kind === "photo" ? "Фото" : "Референс"} {index + 1}</span><button type="button" aria-label={`Удалить ${kind === "photo" ? "фотографию" : "референс"} ${index + 1}`} disabled={busy || readOnly} onClick={() => { void remove(src); }}>Удалить</button></figcaption></figure>)}</div> : <div className="studio-upload-empty"><span aria-hidden="true">↑</span><p>{kind === "photo" ? "Портреты, место встречи, детали события" : "Фактуры, узоры и приглашения, которые вам нравятся"}</p><small>JPG, PNG, WebP · до 15 МБ каждый</small></div>}</div>; })}
        <p className="studio-help">Изображения сохраняются в проекте. Размещение фотографий в приглашении и анализ референсов появятся на следующем этапе.</p>
      </>}</section>
      <section hidden={tab !== "designs"}><div className="studio-preview-heading"><div><h2>Одна история, пять настроений</h2><p>Готовые композиции с сохранёнными данными вашей анкеты.</p></div><div className="studio-view-toggle" aria-label="Ширина предпросмотра"><button type="button" aria-pressed={viewport === "phone"} onClick={() => setViewport("phone")}>Телефон</button><button type="button" aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>Компьютер</button></div></div>{dirty && <p className="studio-notice">В предпросмотре — сохранённая версия. Нажмите «Сохранить», чтобы обновить данные.</p>}
        {!initial ? <div className="studio-panel studio-empty"><h3>Ваши дизайны появятся после создания проекта</h3><p>Заполните анкету — и сравните все пять приглашений.</p><button className="studio-secondary" onClick={() => setTab("event")}>Заполнить анкету</button></div> : <div className="studio-preview-grid">{initial.concepts.map((concept, index) => <article className="studio-preview-card" key={concept.id}><PreviewWindow key={`${previewKey}-${viewport}`} concept={concept} slug={content.slug} revision={previewKey} viewport={viewport} onOpen={() => setModal(concept)} /><div className="studio-preview-caption"><span>0{index + 1}</span><h3>{concept.theme.meta.name}</h3><button type="button" aria-label={`Открыть ${concept.theme.meta.name}`} onClick={() => setModal(concept)}>↗</button></div><p>{concept.theme.meta.rationale}</p></article>)}</div>}
      </section>
    </div></div>
    <dialog ref={dialog} aria-labelledby="studio-dialog-title" className="studio-preview-dialog" onCancel={() => setModal(null)} onClose={() => setModal(null)}><div className="studio-dialog-heading"><h2 id="studio-dialog-title">{modal?.theme.meta.name}</h2>{modal && <Link href={`/preview/${content.slug}/${modal.id}/${modal.version}`} target="_blank">Открыть отдельно ↗</Link>}<button type="button" autoFocus aria-label="Закрыть предпросмотр" onClick={() => setModal(null)}>×</button></div>{modal && <iframe title={`Полный предпросмотр: ${modal.theme.meta.name}`} src={`/preview/${content.slug}/${modal.id}/${modal.version}?embed=1&saved=${previewKey}`} sandbox="allow-scripts allow-same-origin" />}</dialog>
  </main>;
}
