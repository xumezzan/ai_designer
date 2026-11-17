"use client";

import { useEffect, useRef, useState } from "react";
import { createEmptyDraft, type InvitationDraft, type InvitationRecord } from "@/lib/platform/schema";
import { platformRequest } from "@/lib/platform/client";
import type { PlatformLocale } from "@/lib/platform/i18n";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import "./ai-brief.css";

type Reference = { id: string; src: string };
type BriefForm = {
  eventType: InvitationDraft["eventType"];
  purpose: "invitation" | "greeting";
  headline: string;
  firstName: string;
  secondName: string;
  day: string;
  time: string;
  timezone: string;
  venue: string;
  address: string;
  brief: string;
};
type GenerationRequest = {
  requestId: string;
  expectedUpdatedAt: string;
  brief: string;
  referenceIds?: string[];
};
type GenerationJob = {
  requestId: string;
  status: "running" | "succeeded" | "failed";
  createdAt: string;
  updatedAt: string;
  error?: { code: string; message: string };
};
type GenerationResult = { job: GenerationJob; invitation?: InvitationRecord; previousDraft?: InvitationDraft };
type WizardSnapshot = {
  form: BriefForm;
  step: 0 | 1;
  invitationId?: string;
  references: Reference[];
  request?: GenerationRequest;
  job?: GenerationJob;
};

const copy = {
  ru: {
    title: "Ваш сайт с ИИ", collection: "IVORY ATELIER · ИИ-СТУДИЯ",
    eventType: "Повод", purpose: "Что создаём", invitation: "Приглашение на событие", personalGreeting: "Личное поздравление", recipient: "Имя или название", headline: "Главные слова", greetingHint: "Поздравление можно отправить по ссылке без даты, места и ответов гостей.", oneNameRequired: "Укажите имя или название.",
    events: { wedding: "Свадьба", engagement: "Помолвка", birthday: "День рождения", anniversary: "Годовщина / юбилей", corporate: "Корпоративное событие", other: "Другой повод" },
    heading: "Начнём с вашей истории", intro: "Расскажите о событии и желаемом настроении. ИИ подберёт композицию, шрифты, палитру и декор для готового сайта. Тексты и детали можно будет изменить в редакторе.",
    facts: "Событие", design: "Оформление", firstName: "Первое имя", secondName: "Второе имя", day: "Дата", time: "Время", timezone: "Часовой пояс", venue: "Место проведения", address: "Адрес", optional: "необязательно", missing: "Неизвестные детали можно добавить позже. Мы не будем их придумывать.",
    next: "К оформлению", back: "К событию", brief: "Каким вы видите ваш сайт?", placeholder: "Например: скульптурные белые магнолии, матовый фарфор, молочные оттенки, мягкий тёплый свет и очень спокойная элегантность…", briefHint: "Опишите настроение, цвета и стиль. ИИ подберёт оформление всей страницы; текст останется редактируемым.", refs: "Референсы", refsHint: "До 3 изображений · JPEG, PNG или WebP · до 8 МБ каждое. Они направят оформление и не попадут в галерею для гостей.", upload: "Добавить изображение", remove: "Убрать референс", create: "Создать оформление", loading: "Создаём оформление", saving: "Сохраняем данные события", uploading: "Загружаем референс", checking: "Проверяем результат", working: "Создаём оформление. Это может занять несколько минут. Данные события уже сохранены в черновике.", pending: "Задача ещё выполняется или связь с сервером прервалась. Проверьте результат: повторная проверка не запускает новую генерацию.", check: "Проверить результат", resend: "Повторить тот же запрос", retry: "Создать заново", retryHint: "Новая попытка отправит новый запрос на создание оформления.", openDraft: "Открыть сохранённый черновик", error: "Не удалось выполнить запрос. Данные формы сохранены.", failed: "Оформление не создано", close: "Закрыть", briefLength: "Опишите оформление: от 20 до 2000 символов.", namesRequired: "Укажите оба имени.", tooMany: "Можно добавить не больше трёх референсов.", badFile: "Выберите JPEG, PNG или WebP размером до 8 МБ.", saved: "Сохранённый черновик", retained: "Можно закрыть это окно и вернуться к созданию позже с того же устройства.", unknown: "Результат запроса пока неизвестен. Проверка статуса безопасна; повторный запрос использует тот же идентификатор.",
  },
  "uz-latn": {
    title: "AI bilan saytingiz", collection: "IVORY ATELIER · AI STUDIYA",
    eventType: "Sabab", purpose: "Nima yaratamiz", invitation: "Tadbirga taklifnoma", personalGreeting: "Shaxsiy tabrik", recipient: "Ism yoki nom", headline: "Asosiy so‘zlar", greetingHint: "Tabrikni sana, joy va mehmonlar javobisiz havola orqali yuborish mumkin.", oneNameRequired: "Ism yoki nomni kiriting.",
    events: { wedding: "To‘y", engagement: "Fotiha", birthday: "Tug‘ilgan kun", anniversary: "Yillik / yubiley", corporate: "Korporativ tadbir", other: "Boshqa sabab" },
    heading: "Hikoyangizdan boshlaymiz", intro: "Tadbir va istagan kayfiyatingiz haqida ayting. AI tayyor sayt uchun kompozitsiya, shriftlar, ranglar va bezakni tanlaydi. Matn va tafsilotlarni muharrirda o‘zgartira olasiz.",
    facts: "Tadbir", design: "Bezak", firstName: "Birinchi ism", secondName: "Ikkinchi ism", day: "Sana", time: "Vaqt", timezone: "Vaqt mintaqasi", venue: "Tadbir joyi", address: "Manzil", optional: "ixtiyoriy", missing: "Nomaʼlum tafsilotlarni keyin qo‘shishingiz mumkin. Ularni o‘ylab topmaymiz.",
    next: "Bezakka o‘tish", back: "Tadbirga qaytish", brief: "Saytingizni qanday tasavvur qilasiz?", placeholder: "Masalan: oq magnoliya haykallari, xira chinni, sutrang tuslar, mayin iliq yorug‘lik va sokin nafislik…", briefHint: "Kayfiyat, ranglar va uslubni tasvirlang. AI butun sahifa bezagini tanlaydi; matnni tahrirlash mumkin bo‘ladi.", refs: "Namunalar", refsHint: "3 tagacha rasm · JPEG, PNG yoki WebP · har biri 8 MB gacha. Ular bezak uchun yo‘nalish beradi va mehmonlar galereyasiga qo‘shilmaydi.", upload: "Rasm qo‘shish", remove: "Namunani olib tashlash", create: "Bezak yaratish", loading: "Bezak yaratilmoqda", saving: "Tadbir maʼlumotlari saqlanmoqda", uploading: "Namuna yuklanmoqda", checking: "Natija tekshirilmoqda", working: "Bezak yaratilmoqda. Bu bir necha daqiqa olishi mumkin. Tadbir maʼlumotlari qoralamada saqlangan.", pending: "Vazifa hali bajarilmoqda yoki server bilan aloqa uzildi. Natijani tekshiring: tekshirish yangi yaratishni boshlamaydi.", check: "Natijani tekshirish", resend: "Shu so‘rovni takrorlash", retry: "Yangidan yaratish", retryHint: "Yangi urinish bezak yaratish uchun yangi so‘rov yuboradi.", openDraft: "Saqlangan qoralamani ochish", error: "So‘rov bajarilmadi. Kiritilgan maʼlumotlar saqlandi.", failed: "Bezak yaratilmadi", close: "Yopish", briefLength: "Bezakni 20–2000 ta belgi bilan tasvirlang.", namesRequired: "Ikkala ismni kiriting.", tooMany: "Ko‘pi bilan uchta namuna qo‘shish mumkin.", badFile: "8 MB gacha bo‘lgan JPEG, PNG yoki WebP rasmini tanlang.", saved: "Saqlangan qoralama", retained: "Bu oynani yopib, shu qurilmadan keyinroq qaytishingiz mumkin.", unknown: "So‘rov natijasi hali nomaʼlum. Holatni tekshirish xavfsiz; takroriy so‘rov o‘sha identifikatordan foydalanadi.",
  },
} as const;

function emptySnapshot(): WizardSnapshot {
  return { step: 0, references: [], form: { eventType: "wedding", purpose: "invitation", headline: "", firstName: "", secondName: "", day: "", time: "", timezone: "Asia/Tashkent", venue: "", address: "", brief: "" } };
}

function readSnapshot(key: string): WizardSnapshot {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!value || typeof value !== "object" || !value.form) return emptySnapshot();
    const initial = emptySnapshot();
    // Only restore known string fields; storage never supplies API credentials or an owner ID.
    for (const field of ["headline", "firstName", "secondName", "day", "time", "timezone", "venue", "address", "brief"] as const) {
      if (typeof value.form[field] === "string") initial.form[field] = value.form[field];
    }
    if (["wedding", "engagement", "birthday", "anniversary", "corporate", "other"].includes(value.form.eventType)) initial.form.eventType = value.form.eventType;
    if (value.form.purpose === "greeting") initial.form.purpose = "greeting";
    initial.step = value.step === 1 ? 1 : 0;
    if (typeof value.invitationId === "string") initial.invitationId = value.invitationId;
    initial.references = Array.isArray(value.references) ? value.references.filter((item: Reference) => typeof item?.id === "string" && item.src === `/api/platform/media/${item.id}`).slice(0, 3) : [];
    if (value.request && typeof value.request.requestId === "string" && typeof value.request.expectedUpdatedAt === "string" && typeof value.request.brief === "string") {
      initial.request = value.request;
      initial.step = 1;
      if (value.job && ["running", "failed", "succeeded"].includes(value.job.status)) initial.job = value.job;
    }
    return initial;
  } catch { return emptySnapshot(); }
}

/** Assemble user facts without replacing a persisted design during a retry. */
export function invitationDraftFromBrief(form: BriefForm, locale: PlatformLocale, existingDraft?: InvitationDraft): InvitationDraft {
  const seed = form.purpose === "greeting" ? "editorial" : form.eventType === "corporate" ? "corporate" : form.eventType === "birthday" ? "modern" : form.eventType === "anniversary" ? "classic" : "botanical";
  // Editing facts and retrying a request must keep an already resolved AI design.
  const draft = { ...(existingDraft || createEmptyDraft(seed)) };
  draft.locale = locale;
  draft.eventType = form.eventType;
  draft.purpose = form.purpose;
  draft.headline = form.headline.trim() || undefined;
  draft.names = [form.firstName.trim(), form.secondName.trim()].filter(Boolean);
  draft.title = draft.names.join(" & ").slice(0, 120);
  if (form.purpose === "greeting") {
    draft.enabledSections = ["opening", "greeting", "story", "closing"];
  } else {
    if (existingDraft?.purpose === "greeting") draft.enabledSections = createEmptyDraft(seed).enabledSections;
    draft.date = { ...draft.date, day: form.day, time: form.time, timezone: form.timezone };
    draft.venue = { ...draft.venue, name: form.venue.trim(), address: form.address.trim() };
  }
  return draft;
}

export function AiBriefWizard({ locale, userId, onClose, onSuccess }: {
  locale: PlatformLocale;
  userId: string;
  onClose: () => void;
  onSuccess: (invitation: InvitationRecord, previousDraft?: InvitationDraft) => void;
}) {
  const t = copy[locale];
  const storageKey = `taklif-ai-wizard:${userId}`;
  const [snapshot, setSnapshot] = useState<WizardSnapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"saving" | "uploading" | "loading" | "checking" | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const current = useRef(snapshot);
  const mounted = useRef(true);
  const locked = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const record = useRef<InvitationRecord | null>(null);
  current.current = snapshot;

  function update(next: WizardSnapshot) {
    current.current = next;
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The server still keeps the draft and job. */ }
    if (mounted.current) setSnapshot(next);
  }

  useEffect(() => {
    mounted.current = true;
    const restored = readSnapshot(storageKey);
    current.current = restored;
    setSnapshot(restored);
    setReady(true);
    if (restored.job?.status === "failed") setError(restored.job.error?.message || t.failed);
    if (restored.request && restored.invitationId && restored.job?.status !== "failed") {
      locked.current = true;
      setBusy("checking");
      void poll(restored.invitationId, restored.request).finally(() => {
        locked.current = false;
        if (mounted.current) setBusy(null);
      });
    }
    return () => { mounted.current = false; };
    // A wizard belongs to one signed-in owner for its whole mounted lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function change<Key extends keyof BriefForm>(field: Key, value: BriefForm[Key]) {
    update({ ...current.current, form: { ...current.current.form, [field]: value } });
  }

  async function loadRecord() {
    if (record.current) return record.current;
    const id = current.current.invitationId;
    if (!id) return null;
    const result = await platformRequest<{ invitation: InvitationRecord }>(`/invitations/${id}`);
    record.current = result.invitation;
    return result.invitation;
  }

  async function saveFacts() {
    const form = current.current.form;
    const existing = await loadRecord();
    const draft = invitationDraftFromBrief(form, locale, existing?.draft);
    const result = await platformRequest<{ invitation: InvitationRecord }>(existing ? `/invitations/${existing.id}` : "/invitations", {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify({ draft, ...(existing ? { expectedUpdatedAt: existing.updatedAt } : {}) }),
    });
    record.current = result.invitation;
    update({ ...current.current, invitationId: result.invitation.id });
    return result.invitation;
  }

  async function accept(result: GenerationResult) {
    update({ ...current.current, job: result.job });
    if (result.job.status === "succeeded") {
      const invitation = result.invitation || (await platformRequest<{ invitation: InvitationRecord }>(`/invitations/${current.current.invitationId}`)).invitation;
      record.current = invitation;
      if (mounted.current) {
        try { sessionStorage.removeItem(storageKey); } catch { /* Optional browser storage. */ }
        onSuccess(invitation, result.previousDraft);
      }
      return true;
    }
    if (result.job.status === "failed") {
      if (mounted.current) { setError(result.job.error?.message || t.failed); setPending(false); }
      return true;
    }
    return false;
  }

  async function poll(id: string, request: GenerationRequest) {
    for (let attempt = 0; attempt < 5 && mounted.current; attempt++) {
      try {
        const result = await platformRequest<GenerationResult>(`/invitations/${id}/generate?requestId=${encodeURIComponent(request.requestId)}`, { signal: AbortSignal.timeout(15_000) });
        if (await accept(result)) return;
      } catch (e) {
        if (mounted.current) setError((e as Error).message || t.error);
        break;
      }
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (mounted.current) setPending(true);
  }

  async function generate(reuse = false) {
    if (locked.current) return;
    // An unknown/running paid request can only be checked or explicitly resent with its original ID.
    if (!reuse && current.current.request && current.current.job?.status !== "failed") return;
    if (!reuse && current.current.form.brief.trim().length < 20) { setError(t.briefLength); return; }
    locked.current = true;
    setError("");
    setPending(false);
    setBusy(reuse ? "loading" : "saving");
    try {
      const invitation = reuse ? await loadRecord() : await saveFacts();
      if (!invitation) throw new Error(t.error);
      const request = reuse && current.current.request ? current.current.request : {
        requestId: crypto.randomUUID(), expectedUpdatedAt: invitation.updatedAt,
        brief: current.current.form.brief.trim(),
        referenceIds: current.current.references.map((ref) => ref.id),
      };
      update({ ...current.current, request, job: undefined });
      setBusy("loading");
      try {
        const result = await platformRequest<GenerationResult>(`/invitations/${invitation.id}/generate`, { method: "POST", body: JSON.stringify(request), signal: AbortSignal.timeout(180_000) });
        if (!(await accept(result))) await poll(invitation.id, request);
      } catch (e) {
        if (mounted.current) setError((e as Error).message || t.error);
        await poll(invitation.id, request);
      }
    } catch (e) {
      // A conflict must be resolved against the latest record before another manual attempt.
      record.current = null;
      if (mounted.current) setError((e as Error).message || t.error);
    }
    finally { locked.current = false; if (mounted.current) setBusy(null); }
  }

  async function upload(files: FileList | null) {
    if (!files?.length || locked.current) return;
    const selected = Array.from(files);
    if (selected.length + current.current.references.length > 3) { setError(t.tooMany); return; }
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)) { setError(t.badFile); return; }
    locked.current = true;
    setBusy("uploading");
    setError("");
    try {
      const invitation = await saveFacts();
      for (const file of selected) {
        const data = new FormData();
        data.append("file", file);
        const result = await platformRequest<{ media: Reference }>(`/invitations/${invitation.id}/media`, { method: "POST", body: data });
        update({ ...current.current, references: [...current.current.references, result.media] });
      }
    } catch (e) { if (mounted.current) setError((e as Error).message || t.error); }
    finally { locked.current = false; if (mounted.current) setBusy(null); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function checkStatus() {
    const { invitationId, request } = current.current;
    if (!invitationId || !request || locked.current) return;
    locked.current = true;
    setBusy("checking");
    setError("");
    try { await poll(invitationId, request); }
    finally { locked.current = false; if (mounted.current) setBusy(null); }
  }

  async function openDraft() {
    if (locked.current) return;
    locked.current = true;
    setBusy("checking");
    try {
      // Fetch the current record: generation may have finished after the last status response.
      record.current = null;
      const invitation = await loadRecord();
      if (invitation && mounted.current) onSuccess(invitation);
    } catch (e) { if (mounted.current) setError((e as Error).message || t.error); }
    finally { locked.current = false; if (mounted.current) setBusy(null); }
  }

  const form = snapshot.form;
  const activeRequest = Boolean(snapshot.request && snapshot.job?.status !== "failed");
  const failed = snapshot.job?.status === "failed";
  const immutable = Boolean(busy || activeRequest);
  const isGreeting = form.purpose === "greeting";
  const needsTwoNames = !isGreeting && ["wedding", "engagement"].includes(form.eventType);
  const canProceed = Boolean(form.firstName.trim() && (!needsTwoNames || form.secondName.trim()));

  return (
    <Modal wide title={t.title} closeLabel={t.close} onClose={onClose}>
      <div className="pf-ai-wizard" lang={locale === "ru" ? "ru" : "uz-Latn"}>
        <header className="pf-ai-header">
          <span className="pf-eyebrow">{t.collection}</span>
          <h2>{t.heading}</h2>
          <p>{t.intro}</p>
        </header>
        <ol className="pf-ai-steps" aria-label={t.title}>
          <li aria-current={snapshot.step === 0 ? "step" : undefined}><span>01</span>{t.facts}</li>
          <li aria-current={snapshot.step === 1 ? "step" : undefined}><span>02</span>{t.design}</li>
        </ol>
        {!ready ? <p role="status">{t.checking}</p> : (
          <form className="pf-ai-form" onSubmit={(event) => {
            event.preventDefault();
            if (snapshot.step === 0) {
              if (!canProceed) { setError(needsTwoNames ? t.namesRequired : t.oneNameRequired); return; }
              setError(""); update({ ...current.current, step: 1 });
            } else void generate();
          }}>
            {snapshot.step === 0 ? (
              <>
                <div className="pf-ai-fields">
                  <label>{t.eventType}<select value={form.eventType} disabled={immutable} onChange={(e) => change("eventType", e.target.value as BriefForm["eventType"])}>{Object.entries(t.events).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                  <label>{t.purpose}<select value={form.purpose} disabled={immutable} onChange={(e) => change("purpose", e.target.value as BriefForm["purpose"])}><option value="invitation">{t.invitation}</option><option value="greeting">{t.personalGreeting}</option></select></label>
                  <label>{needsTwoNames ? t.firstName : t.recipient}<input autoComplete="off" required maxLength={100} value={form.firstName} disabled={immutable} onChange={(e) => change("firstName", e.target.value)} /></label>
                  <label>{t.secondName} {!needsTwoNames && <small>{t.optional}</small>}<input autoComplete="off" required={needsTwoNames} maxLength={100} value={form.secondName} disabled={immutable} onChange={(e) => change("secondName", e.target.value)} /></label>
                  <label className="pf-ai-full">{t.headline} <small>{t.optional}</small><input maxLength={200} value={form.headline} disabled={immutable} onChange={(e) => change("headline", e.target.value)} /></label>
                  {!isGreeting && <>
                  <label>{t.day} <small>{t.optional}</small><input type="date" value={form.day} disabled={immutable} onChange={(e) => change("day", e.target.value)} /></label>
                  <label>{t.time} <small>{t.optional}</small><input type="time" value={form.time} disabled={immutable} onChange={(e) => change("time", e.target.value)} /></label>
                  <label className="pf-ai-full">{t.timezone}<input required maxLength={100} value={form.timezone} disabled={immutable} onChange={(e) => change("timezone", e.target.value)} placeholder="Asia/Tashkent" /></label>
                  <label className="pf-ai-full">{t.venue} <small>{t.optional}</small><input maxLength={200} value={form.venue} disabled={immutable} onChange={(e) => change("venue", e.target.value)} /></label>
                  <label className="pf-ai-full">{t.address} <small>{t.optional}</small><input maxLength={500} value={form.address} disabled={immutable} onChange={(e) => change("address", e.target.value)} /></label>
                  </>}
                </div>
                <p className="pf-ai-hint">{isGreeting ? t.greetingHint : t.missing}</p>
              </>
            ) : (
              <>
                <div className="pf-ai-summary"><Icon name="heart" size={18} /><span>{[form.firstName, form.secondName].filter((name) => name.trim()).join(" & ")}</span>{!isGreeting && form.day && <time dateTime={form.day}>{form.day}</time>}</div>
                <label className="pf-ai-brief-label">{t.brief}<textarea rows={5} minLength={20} maxLength={2000} required disabled={immutable} value={form.brief} placeholder={t.placeholder} onChange={(e) => change("brief", e.target.value)} /></label>
                <div className="pf-ai-brief-meta"><span>{t.briefHint}</span><span>{form.brief.length}/2000</span></div>
                <fieldset className="pf-ai-references" disabled={immutable}>
                  <legend>{t.refs} <small>{t.optional}</small></legend>
                  <p className="pf-ai-hint">{t.refsHint}</p>
                  <div className="pf-ai-reference-list">
                    {snapshot.references.map((reference, index) => <div className="pf-ai-reference" key={reference.id}>
                      {/* Private owner-scoped media endpoint; no external image service. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reference.src} alt={`${t.refs} ${index + 1}`} />
                      <button type="button" className="pf-icon-button" aria-label={`${t.remove} ${index + 1}`} onClick={() => update({ ...current.current, references: current.current.references.filter((item) => item.id !== reference.id) })}><Icon name="close" size={16} /></button>
                    </div>)}
                    {snapshot.references.length < 3 && <button type="button" className="pf-ai-upload" onClick={() => fileInput.current?.click()}><Icon name="plus" size={20} /><span>{t.upload}</span></button>}
                  </div>
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void upload(e.target.files)} />
                </fieldset>
              </>
            )}
            {error && <div className="pf-ai-error" role="alert"><strong>{failed ? t.failed : t.error}</strong><p>{error}</p></div>}
            {busy && <div className="pf-ai-progress" role="status" aria-live="polite"><span className="pf-ai-spinner" aria-hidden="true" /><div><strong>{t[busy]}</strong><p>{busy === "loading" ? t.working : t.retained}</p></div></div>}
            {!busy && activeRequest && <div className="pf-ai-progress" role="status"><Icon name="clock" size={22} /><p>{pending ? t.pending : t.unknown}</p></div>}
            <footer className="pf-ai-footer">
              {snapshot.step === 0 ? <button className="pf-button pf-button-dark" type="submit" disabled={!canProceed || Boolean(busy)}>{t.next}<Icon name="arrow" size={17} /></button> : (
                <>
                  {!activeRequest && <button className="pf-button pf-button-outline" type="button" disabled={Boolean(busy)} onClick={() => update({ ...current.current, step: 0 })}>{t.back}</button>}
                  {activeRequest ? <div className="pf-ai-actions">
                    <button className="pf-button pf-button-dark" type="button" disabled={Boolean(busy)} onClick={() => void checkStatus()}>{t.check}</button>
                    {!busy && snapshot.job?.status !== "running" && <button className="pf-text-button" type="button" onClick={() => void generate(true)}>{t.resend}</button>}
                  </div> : <button className="pf-button pf-button-dark" type="submit" disabled={Boolean(busy) || form.brief.trim().length < 20}><Icon name="flower" size={18} />{busy ? t[busy] : failed ? t.retry : t.create}</button>}
                </>
              )}
            </footer>
            {failed && <p className="pf-ai-hint">{t.retryHint}</p>}
            {snapshot.invitationId && <div className="pf-ai-draft"><span>{t.saved}</span><button className="pf-link" type="button" disabled={Boolean(busy)} onClick={() => void openDraft()}>{t.openDraft}<Icon name="arrow" size={15} /></button></div>}
          </form>
        )}
      </div>
    </Modal>
  );
}
