"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createEmptyDraft, type InvitationDraft, type InvitationRecord } from "@/lib/platform/schema";
import { resolvePlatformDesignSelection } from "@/lib/platform-render/theme";
import { STUDIO_HERO_LAYOUTS, STUDIO_PHOTO_SHAPES, STUDIO_SURFACE_STYLES, STUDIO_SPACING_SCALES, STUDIO_TYPOGRAPHY_ACCENTS, STUDIO_ORNAMENT_SET_IDS, STUDIO_MOTION_PRESETS, STUDIO_SECTION_ORDERS, STUDIO_SECTION_VARIANTS, type StudioComposition } from "@/lib/schema/studioTemplate";
import { resolveStudioComposition, studioFontPairTags, studioPalettes, studioSelectionCompatibility, studioTemplates } from "@/registry/studioTemplates";
import { moodProfiles, resolveMoodProfile } from "@/registry/moodProfiles";
import {
  platformCopy,
  platformTemplates,
  type PlatformLocale,
} from "@/lib/platform/i18n";
import { platformRequest } from "@/lib/platform/client";
import { Icon } from "./Icon";
import { AiRefinePanel } from "./AiRefinePanel";
import { DesignHistoryPanel } from "./DesignHistoryPanel";
import { applyInvitationDesign, invitationDesign, type InvitationDesign } from "@/lib/platform-design/schema";

type Tab = "general" | "content" | "details" | "appearance" | "history";

export function applyAppearancePatch(draft: InvitationDraft, patch: Partial<InvitationDraft>): InvitationDraft {
  const next = { ...draft, ...patch };
  if (next.purpose === "greeting" || (next.templateId !== "sculpted-garden" && next.templateId !== "heritage")) {
    const selection = resolvePlatformDesignSelection(next);
    if (next.composition?.typographyAccent === "italic-serif-accent" && !studioFontPairTags[selection.fontPairId].includes("serif")) {
      next.composition = { ...next.composition, typographyAccent: "uppercase-wide-tracking" };
    }
    if (studioSelectionCompatibility(resolvePlatformDesignSelection(next)).length) next.ornamentSetId = "editorial-rules";
  }
  return next;
}

/** Quick undo follows design history: only appearance moves back in time. */
export function restoreBeforeGeneration(current: InvitationDraft, before: InvitationDraft): InvitationDraft {
  return applyInvitationDesign(current, invitationDesign(before));
}

export function InvitationEditor({
  initial,
  locale,
  onClose,
  initialPreviousDraft,
}: {
  initial: InvitationRecord;
  locale: PlatformLocale;
  onClose: () => void;
  initialPreviousDraft?: InvitationDraft;
}) {
  const t = platformCopy[locale];
  const [record, setRecord] = useState(initial);
  const [draft, setDraft] = useState(initial.draft);
  const [tab, setTab] = useState<Tab>("general");
  const [viewport, setViewport] = useState<"mobile" | "desktop">("mobile");
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "dirty" | "error"
  >("saved");
  const [error, setError] = useState("");
  const [action, setAction] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [previousDraft, setPreviousDraft] = useState(initialPreviousDraft);
  const [previewDesign, setPreviewDesign] = useState<InvitationDesign>();
  const previewDesignRef = useRef(previewDesign);
  previewDesignRef.current = previewDesign;
  const iframe = useRef<HTMLIFrameElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const draftRef = useRef(draft);
  const recordRef = useRef(record);
  const lastSaved = useRef(JSON.stringify(initial.draft));
  const inFlight = useRef<Promise<boolean> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  draftRef.current = draft;

  const persist = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) {
      if (!(await inFlight.current)) return false;
    }
    const snapshot = JSON.stringify(draftRef.current);
    if (snapshot === lastSaved.current) return true;
    setSaveState("saving");
    setError("");
    const task = (async () => {
      try {
        const result = await platformRequest<{ invitation: InvitationRecord }>(
          `/invitations/${initial.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              draft: JSON.parse(snapshot),
              expectedUpdatedAt: recordRef.current.updatedAt,
            }),
          },
        );
        recordRef.current = result.invitation;
        setRecord(result.invitation);
        lastSaved.current = snapshot;
        setSaveState(
          JSON.stringify(draftRef.current) === snapshot ? "saved" : "dirty",
        );
        return true;
      } catch (e) {
        setError((e as Error).message);
        setSaveState("error");
        return false;
      }
    })();
    inFlight.current = task;
    const success = await task;
    inFlight.current = null;
    return success;
  }, [initial.id]);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    setPublicUrl(`${window.location.origin}/i/${record.slug}`);
  }, [record.slug]);
  useEffect(() => {
    if (JSON.stringify(draft) === lastSaved.current) return;
    setSaveState("dirty");
    const timer = window.setTimeout(() => {
      void persist();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, persist]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(draftRef.current) !== lastSaved.current)
        e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  function sendPreview() {
    let invitation = draftRef.current;
    if (previewDesignRef.current) {
      try { invitation = applyInvitationDesign(invitation, previewDesignRef.current); }
      catch { /* The iframe reports unfinished fields without crashing the editor. */ }
    }
    iframe.current?.contentWindow?.postMessage(
      { type: "platform-preview", invitation },
      window.location.origin,
    );
  }
  useEffect(() => {
    sendPreview();
  }, [draft, previewDesign]);
  useEffect(() => {
    const ready = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === iframe.current?.contentWindow &&
        event.data?.type === "platform-preview-ready"
      )
        sendPreview();
    };
    window.addEventListener("message", ready);
    return () => window.removeEventListener("message", ready);
  }, []);
  function update(patch: Partial<InvitationDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }
  function updateDesign(patch: Partial<InvitationDraft>) {
    setDraft(applyAppearancePatch(draft, patch));
  }
  function updateComposition(patch: Partial<NonNullable<InvitationDraft["composition"]>>) {
    const selection = resolvePlatformDesignSelection(draft);
    updateDesign({ composition: { ...resolveStudioComposition(selection.templateId, draft.composition), ...patch } });
  }
  function changePurpose(purpose: "invitation" | "greeting") {
    const dedicated = draft.templateId === "heritage" || draft.templateId === "sculpted-garden";
    const next: InvitationDraft = { ...draft, purpose, enabledSections: purpose === "greeting" ? ["opening", "greeting", "story", "closing"] : createEmptyDraft(draft.templateId).enabledSections };
    if (draft.enabledSections.includes("wishes")) next.enabledSections.push("wishes");
    if (purpose === "greeting" && dedicated) {
      next.templateId = "editorial";
      next.ornamentSetId = "editorial-rules";
      next.composition = resolveStudioComposition("editorial");
      if (["modern", "modernist", "gallery"].includes(next.fontPairId)) next.composition.typographyAccent = "uppercase-wide-tracking";
    }
    setDraft(next);
  }
  function acceptGeneration(next: InvitationRecord, previous?: InvitationDraft) {
    previewDesignRef.current = undefined;
    setPreviewDesign(undefined);
    recordRef.current = next;
    draftRef.current = next.draft;
    lastSaved.current = JSON.stringify(next.draft);
    setRecord(next);
    setDraft(next.draft);
    setPreviousDraft(previous);
    setSaveState("saved");
    setError("");
  }
  async function close() {
    setAction(true);
    if (
      (await persist()) &&
      JSON.stringify(draftRef.current) === lastSaved.current
    ) {
      onClose();
      return;
    }
    setAction(false);
  }
  async function lifecycle(kind: "publish" | "unpublish" | "archive") {
    setAction(true);
    setError("");
    try {
      if (!(await persist())) return;
      const result = await platformRequest<{ invitation: InvitationRecord }>(
        `/invitations/${record.id}/${kind}`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedUpdatedAt: recordRef.current.updatedAt,
          }),
        },
      );
      setRecord(result.invitation);
      recordRef.current = result.invitation;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAction(false);
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        locale === "ru"
          ? "Скопируйте ссылку из поля вручную."
          : "Havolani maydondan qo‘lda nusxalang.",
      );
    }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError(t.uploadNote);
      e.target.value = "";
      return;
    }
    setAction(true);
    setError("");
    try {
      if (!(await persist())) return;
      const data = new FormData();
      data.append("file", file);
      const result = await platformRequest<{
        media: InvitationDraft["media"][number];
      }>(`/invitations/${record.id}/media`, { method: "POST", body: data });
      update({ media: [...draftRef.current.media, result.media] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAction(false);
      e.target.value = "";
    }
  }
  const tabs = ["general", "content", "details", "appearance", "history"] as const;
  const tabLabels = { general: t.general, content: t.content, details: t.details,
    appearance: t.appearance, history: locale === "ru" ? "Версии" : "Variantlar" };
  const isGreeting = draft.purpose === "greeting";
  const dedicated = !isGreeting && (draft.templateId === "sculpted-garden" || draft.templateId === "heritage");
  const sectionLabels = {
    opening: t.intro,
    greeting: isGreeting ? t.greetingText : t.greeting,
    story: t.story,
    date: t.date,
    venue: t.venue,
    timeline: t.programme,
    dressCode: t.dressCode,
    wishes: t.wishes,
    rsvp: t.rsvp,
    closing: isGreeting ? t.farewell : t.closing,
  };
  const eventNames =
    locale === "ru"
      ? {
          wedding: "Свадьба",
          engagement: "Помолвка",
          anniversary: "Юбилей",
          birthday: "День рождения",
          corporate: "Корпоративное событие",
          other: "Другое событие",
        }
      : {
          wedding: "To‘y",
          engagement: "Fotiha",
          anniversary: "Yubiley",
          birthday: "Tug‘ilgan kun",
          corporate: "Korporativ tadbir",
          other: "Boshqa tadbir",
        };
  const fonts =
    locale === "ru"
      ? {
          editorial: "Редакционная · Cormorant",
          classic: "Классическая · EB Garamond",
          modern: "Современная · Tenor Sans",
          romantic: "Рукописная · Marck Script",
          ceremony: "Торжественная · Cormorant + Garamond",
          poetic: "Поэтическая · Prata",
          modernist: "Современная · Unbounded",
          gallery: "Галерейная · Tenor Sans",
          "modern-editorial": "Modern Editorial · Cormorant + Inter",
          "botanical-haute": "Botanical Haute · Prata + Manrope",
          "velvet-noir": "Velvet Noir · Bodoni Moda + Montserrat",
        }
      : {
          editorial: "Tahririy · Cormorant",
          classic: "Klassik · EB Garamond",
          modern: "Zamonaviy · Tenor Sans",
          romantic: "Qo‘lyozma · Marck Script",
          ceremony: "Tantanali · Cormorant + Garamond",
          poetic: "Sheʼriy · Prata",
          modernist: "Zamonaviy · Unbounded",
          gallery: "Galereya · Tenor Sans",
          "modern-editorial": "Modern Editorial · Cormorant + Inter",
          "botanical-haute": "Botanical Haute · Prata + Manrope",
          "velvet-noir": "Velvet Noir · Bodoni Moda + Montserrat",
        };
  const paletteNamesUz: Record<string, string> = { ivory: "Fil suyagi", sage: "Mavrak", midnight: "Yarim tun", rose: "Atirgul", cinnabar: "Qizil kinovar", champagne: "Shampan", terracotta: "Terrakota", ink: "Siyoh", wine: "Sharob", slate: "Slanets", cobalt: "Kobalt", clay: "Gil", forest: "O‘rmon", "modern-editorial": "Jurnal qog‘ozi", "botanical-haute": "Zig‘ir va mavrak", "velvet-noir": "Ko‘mir va oltin" };
  const palettes = [{ id: "midnight" as const, color: "#262c36", name: locale === "ru" ? "Полночь" : paletteNamesUz.midnight }, ...Object.entries(studioPalettes).map(([id, palette]) => ({ id: id as InvitationDraft["paletteId"], color: palette.bg, name: locale === "ru" ? palette.name : paletteNamesUz[id] ?? palette.name }))];
  const compositionLabels = locale === "ru" ? {
    hero: "Первая сцена", photo: "Форма фотографии", surface: "Поверхность", spacing: "Ритм страницы", accent: "Акцент типографики", ornaments: "Декор",
    "fullscreen-cover": "Обложка на весь экран", "split-editorial": "Журнальный разворот", "framed-arch": "Арочная рамка", "typographic-poster": "Типографический плакат", "minimal-card": "Лаконичная карточка",
    sharp: "Прямые углы", rounded: "Скруглённая", arch: "Арка", pill: "Капсула", circle: "Круг", polaroid: "Моментальное фото",
    flat: "Матовая", glassmorphism: "Матовое стекло", "bordered-hairline": "Тонкая рамка", "elevated-card": "Приподнятая бумага", "soft-gradient": "Мягкий свет",
    "compact-poster": "Компактный плакат", balanced: "Сбалансированный", "airy-gallery": "Воздушная галерея",
    "italic-serif-accent": "Курсивная антиква", "uppercase-wide-tracking": "Разреженные прописные", "oversized-display": "Крупный заголовок", "classic-centered": "Классический центр",
    "editorial-rules": "Журнальные линии", "botanical-engraving": "Ботаническая гравюра", "classic-monogram": "Классический вензель", "graphic-ribbon": "Графическая лента", "corporate-grid": "Деловая сетка", "deco-lines": "Линии ар-деко", "chinese-garden": "Акварельный сад",
    motion: "Анимация", order: "Порядок разделов",
    still: "Без анимации", drift: "Мягкое появление", unfold: "Конверт и мягкое появление",
    "story-first": "Сначала история", "event-first": "Сначала детали события", "programme-first": "Программа перед местом",
  } : {
    hero: "Birinchi sahna", photo: "Fotosurat shakli", surface: "Sirt", spacing: "Sahifa ritmi", accent: "Tipografik urg‘u", ornaments: "Bezak",
    "fullscreen-cover": "To‘liq ekran muqovasi", "split-editorial": "Jurnal sahifasi", "framed-arch": "Ravoqli ramka", "typographic-poster": "Tipografik plakat", "minimal-card": "Ixcham kartochka",
    sharp: "To‘g‘ri burchaklar", rounded: "Yumaloq burchaklar", arch: "Ravoq", pill: "Kapsula", circle: "Doira", polaroid: "Tezkor surat",
    flat: "Xira", glassmorphism: "Xira shisha", "bordered-hairline": "Ingichka ramka", "elevated-card": "Ko‘tarilgan qog‘oz", "soft-gradient": "Mayin yorug‘lik",
    "compact-poster": "Ixcham plakat", balanced: "Muvozanatli", "airy-gallery": "Keng galereya",
    "italic-serif-accent": "Kursiv antikva", "uppercase-wide-tracking": "Keng katta harflar", "oversized-display": "Yirik sarlavha", "classic-centered": "Klassik markaz",
    "editorial-rules": "Jurnal chiziqlari", "botanical-engraving": "Botanik gravyura", "classic-monogram": "Klassik monogramma", "graphic-ribbon": "Grafik tasma", "corporate-grid": "Ishbilarmon to‘r", "deco-lines": "Art-deko chiziqlari", "chinese-garden": "Akvarel bog‘i",
    motion: "Animatsiya", order: "Bo‘limlar tartibi",
    still: "Animatsiyasiz", drift: "Mayin paydo bo‘lish", unfold: "Konvert va mayin paydo bo‘lish",
    "story-first": "Avval hikoya", "event-first": "Avval tadbir tafsilotlari", "programme-first": "Dastur manzildan oldin",
  };
  const blockLabels = {
    countdown: t.countdown, program: t.programme, venue: t.venue,
    gallery: t.photos, rsvp: t.rsvp, story: t.story, dressCode: t.dressCode, wishes: t.wishes,
  };
  const variantLabels = locale === "ru" ? {
    tiles: "Числа в ячейках", "date-led": "Акцент на дате", inline: "В одну строку",
    timeline: "Временная шкала", cards: "Карточки", "editorial-list": "Журнальный список",
    stacked: "Вертикальная композиция", split: "Раздельная композиция", card: "Карточка",
    grid: "Сетка", filmstrip: "Фотолента", editorial: "Журнальная композиция",
    minimal: "Лаконичный", narrative: "Рассказ", letter: "Письмо",
    classic: "Классический", "swatch-led": "Акцент на цвете", note: "Заметка", dedication: "Посвящение",
  } : {
    tiles: "Kataklardagi raqamlar", "date-led": "Sanaga urg‘u", inline: "Bitta qatorda",
    timeline: "Vaqt chizig‘i", cards: "Kartochkalar", "editorial-list": "Jurnal ro‘yxati",
    stacked: "Vertikal kompozitsiya", split: "Ikki qismli kompozitsiya", card: "Kartochka",
    grid: "To‘r", filmstrip: "Fotosuratlar tasmasi", editorial: "Jurnal kompozitsiyasi",
    minimal: "Ixcham", narrative: "Hikoya", letter: "Maktub",
    classic: "Klassik", "swatch-led": "Rangga urg‘u", note: "Qisqa izoh", dedication: "Bag‘ishlov",
  };
  const selection = dedicated ? undefined : resolvePlatformDesignSelection(draft);
  const moodProfile = !draft.artDirection && draft.composition && selection ? resolveMoodProfile(selection) : undefined;
  const composition = selection ? resolveStudioComposition(selection.templateId, draft.composition) : undefined;


  return (
    <dialog
      ref={dialog}
      className="pf-editor"
      aria-label={t.edit}
      onCancel={(e) => {
        e.preventDefault();
        void close();
      }}
    >
      <header className="pf-editor-header">
        <button
          className="pf-editor-back"
          onClick={() => void close()}
          disabled={action}
        >
          <Icon
            name="arrow"
            size={18}
            style={{ transform: "rotate(180deg)" }}
          />
          <span>taklif.</span>
        </button>
        <div className="pf-editor-heading">
          <span>{draft.title}</span>
          <small aria-live="polite">
            <Icon name={saveState === "saved" ? "check" : "clock"} size={13} />
            {saveState === "saved"
              ? t.saved
              : saveState === "saving"
                ? t.saving
                : t.unsaved}
          </small>
        </div>
        <div className="pf-editor-actions">
          {saveState === "error" && (
            <button
              className="pf-link"
              onClick={() => void persist()}
              disabled={action}
            >
              {t.retry}
            </button>
          )}
          <button
            className="pf-button pf-button-dark"
            disabled={action || record.status === "archived" || Boolean(previewDesign)}
            onClick={() => void lifecycle("publish")}
          >
            {action
              ? t.loading
              : record.status === "published"
                ? t.updatePublication
                : t.publish}
            <Icon name="external" size={16} />
          </button>
          <button
            className="pf-icon-button"
            onClick={() => void close()}
            disabled={action}
            aria-label={t.close}
          >
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div className="pf-editor-body">
        <div className="pf-editor-panel">
          <div className="pf-editor-tabs" role="tablist" aria-label={t.edit}>
            {tabs.map((id, index) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                disabled={action}
                onClick={() => {
                  setTab(id);
                  if (id !== "history") setPreviewDesign(undefined);
                }}
              >
                <small>0{index + 1}</small>
                {tabLabels[id]}
              </button>
            ))}
          </div>
          {error && (
            <p className="pf-inline-error pf-editor-error" role="alert">
              {error}
            </p>
          )}
          {tab !== "history" && <fieldset
            className="pf-editor-fields pf-form"
            disabled={action || record.status === "archived"}
          >
            <legend className="pf-sr-only">{tabLabels[tab]}</legend>
            {tab === "general" && (
              <>
                <div className="pf-editor-section-title">
                  <span className="pf-eyebrow">01 / {t.progress}</span>
                  <h2>{t.general}</h2>
                </div>
                <label>
                  {t.title}
                  <input
                    value={draft.title}
                    maxLength={120}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </label>
                <label>{t.purpose}<select value={draft.purpose || "invitation"} onChange={(e) => changePurpose(e.target.value as "invitation" | "greeting")}><option value="invitation">{t.invitationPurpose}</option><option value="greeting">{t.greetingPurpose}</option></select></label>
                <label>{t.headline} <small>({t.optional})</small><input value={draft.headline || ""} maxLength={200} onChange={(e) => update({ headline: e.target.value || undefined })} /></label>
                <label>
                  {t.event}
                  <select
                    value={draft.eventType}
                    onChange={(e) =>
                      update({
                        eventType: e.target
                          .value as InvitationDraft["eventType"],
                      })
                    }
                  >
                    {Object.entries(eventNames).map(([id, name]) => (
                      <option value={id} key={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="pf-field-heading">{t.names}</div>
                <div className="pf-field-pair">
                  {draft.names.map((name, index) => (
                    <label key={index}>
                      {index === 0
                        ? t.firstName
                        : index === 1
                          ? t.secondName
                          : `${t.name} ${index + 1}`}
                      <span className="pf-host-field">
                        <input
                          value={name}
                          maxLength={100}
                          placeholder={index === 0 ? (locale === "ru" ? "Имя или название" : "Ism yoki nom") : ""}
                          onChange={(e) =>
                            update({
                              names: draft.names.map((x, i) =>
                                index === i ? e.target.value : x,
                              ),
                            })
                          }
                        />
                        {draft.names.length > 1 && (
                          <button
                            type="button"
                            className="pf-host-remove"
                            aria-label={`${t.remove} ${t.name} ${index + 1}`}
                            onClick={() =>
                              update({
                                names: draft.names.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            <Icon name="close" size={13} />
                          </button>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="pf-link"
                  disabled={draft.names.length >= 6}
                  onClick={() => update({ names: [...draft.names, ""] })}
                >
                  <Icon name="plus" size={14} />
                  {t.addName}
                </button>
                {!isGreeting && <><div className="pf-field-pair">
                  <label>
                    {t.date}
                    <input
                      type="date"
                      value={draft.date.day}
                      onChange={(e) =>
                        update({ date: { ...draft.date, day: e.target.value } })
                      }
                    />
                  </label>
                  <label>
                    {t.time}
                    <input
                      type="time"
                      value={draft.date.time}
                      onChange={(e) =>
                        update({
                          date: { ...draft.date, time: e.target.value },
                        })
                      }
                    />
                  </label>
                </div>
                <small className="pf-muted">{t.timezone}</small></>}
                <label>
                  {t.invitationLanguage}
                  <select
                    value={draft.locale}
                    onChange={(e) =>
                      update({
                        locale: e.target.value as InvitationDraft["locale"],
                      })
                    }
                  >
                    <option value="ru">Русский</option>
                    <option value="uz-latn">O‘zbekcha</option>
                  </select>
                </label>
                {!isGreeting && <label className="pf-toggle">
                  <span>{t.countdown}</span>
                  <input
                    type="checkbox"
                    checked={draft.date.showCountdown}
                    onChange={(e) =>
                      update({
                        date: {
                          ...draft.date,
                          showCountdown: e.target.checked,
                        },
                      })
                    }
                  />
                  <i />
                </label>}
              </>
            )}
            {tab === "content" && (
              <>
                <div className="pf-editor-section-title">
                  <span className="pf-eyebrow">02 / {t.progress}</span>
                  <h2>{t.content}</h2>
                </div>
                <label>
                  {isGreeting ? t.greetingText : t.greeting}
                  <textarea
                    rows={5}
                    value={draft.greeting}
                    maxLength={4000}
                    onChange={(e) => update({ greeting: e.target.value })}
                    placeholder={
                      isGreeting ? (locale === "ru" ? "С вашим особенным днём! Пусть впереди будет много счастливых мгновений…" : "Sizning alohida kuningiz muborak! Oldinda ko‘plab baxtli lahzalar bo‘lsin…") : locale === "ru"
                        ? "Дорогие родные и близкие! Мы будем счастливы разделить этот день с вами…"
                        : "Aziz yaqinlar! Ushbu quvonchli kunni siz bilan baham ko‘rishdan xursandmiz…"
                    }
                  />
                </label>
                <label>
                  {t.story} <small>({t.optional})</small>
                  <textarea
                    rows={5}
                    value={draft.story || ""}
                    maxLength={10000}
                    onChange={(e) =>
                      update({
                        story: e.target.value,
                        enabledSections:
                          e.target.value &&
                          !draft.enabledSections.includes("story")
                            ? [...draft.enabledSections, "story"]
                            : draft.enabledSections,
                      })
                    }
                  />
                </label>
                <label>
                  {t.wishes} <small>({t.optional})</small>
                  <textarea rows={4} value={draft.wishes || ""} maxLength={10000} onChange={(e) => {
                    const wishes = e.target.value;
                    update({
                      wishes,
                      enabledSections: wishes && !draft.enabledSections.includes("wishes")
                        ? [...draft.enabledSections, "wishes"] : draft.enabledSections,
                    });
                  }} />
                </label>
                <label>
                  {isGreeting ? t.farewell : t.closing}
                  <textarea
                    rows={3}
                    value={draft.closing}
                    maxLength={2000}
                    onChange={(e) => update({ closing: e.target.value })}
                  />
                </label>
                <div className="pf-field-heading">{t.photos}</div>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp"
                  onChange={upload}
                />
                <button
                  type="button"
                  className="pf-upload"
                  disabled={draft.media.length >= 12}
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="plus" size={23} />
                  <span>{t.upload}</span>
                  <small>{t.uploadNote}</small>
                </button>
                <div className="pf-editor-photos">
                  {draft.media.map((media, index) => (
                    <div key={media.id}>
                      <Image
                        src={media.src}
                        alt={`${t.photos} ${index + 1}`}
                        width={120}
                        height={120}
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() =>
                          update({
                            media: draft.media.filter((x) => x.id !== media.id),
                          })
                        }
                        aria-label={`${t.remove} ${index + 1}`}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {tab === "details" && (
              <>
                <div className="pf-editor-section-title">
                  <span className="pf-eyebrow">03 / {t.progress}</span>
                  <h2>{t.details}</h2>
                </div>
                {isGreeting ? <p className="pf-muted">{t.greetingDetails}</p> : <><label>
                  {t.venue}
                  <input
                    value={draft.venue.name}
                    maxLength={200}
                    onChange={(e) =>
                      update({
                        venue: { ...draft.venue, name: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  {t.address}
                  <input
                    value={draft.venue.address}
                    maxLength={500}
                    onChange={(e) =>
                      update({
                        venue: { ...draft.venue, address: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  {t.map} <small>({t.optional})</small>
                  <input
                    type="url"
                    value={draft.venue.mapUrl || ""}
                    placeholder="https://maps.google.com/…"
                    onChange={(e) =>
                      update({
                        venue: {
                          ...draft.venue,
                          mapUrl: e.target.value || undefined,
                        },
                      })
                    }
                  />
                </label>
                <div className="pf-field-heading">{t.programme}</div>
                {draft.timeline.map((moment, index) => (
                  <div key={index} className="pf-timeline-editor">
                    <label>
                      <span className="pf-sr-only">{t.time}</span>
                      <input
                        type="time"
                        value={moment.time}
                        onChange={(e) =>
                          update({
                            timeline: draft.timeline.map((x, i) =>
                              i === index ? { ...x, time: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      <span className="pf-sr-only">{t.title}</span>
                      <input
                        maxLength={160}
                        value={moment.title}
                        placeholder={
                          locale === "ru"
                            ? "Сбор гостей"
                            : "Mehmonlarni kutib olish"
                        }
                        onChange={(e) =>
                          update({
                            timeline: draft.timeline.map((x, i) =>
                              i === index ? { ...x, title: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="pf-icon-button"
                      aria-label={t.remove}
                      onClick={() =>
                        update({
                          timeline: draft.timeline.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="pf-link"
                  disabled={draft.timeline.length >= 30}
                  onClick={() =>
                    update({
                      timeline: [
                        ...draft.timeline,
                        { time: "18:00", title: "" },
                      ],
                    })
                  }
                >
                  <Icon name="plus" size={15} />
                  {t.addMoment}
                </button>
                <label>
                  {t.dressCode}
                  <input
                    value={draft.dressCode?.title || ""}
                    maxLength={200}
                    placeholder="Black tie / Cocktail"
                    onChange={(e) =>
                      update({
                        dressCode: {
                          title: e.target.value,
                          note: draft.dressCode?.note,
                          swatches: draft.dressCode?.swatches || [
                            "#E8DFCD",
                            "#A6B29B",
                            "#BF9C91",
                          ],
                        },
                        enabledSections:
                          e.target.value &&
                          !draft.enabledSections.includes("dressCode")
                            ? [...draft.enabledSections, "dressCode"]
                            : draft.enabledSections,
                      })
                    }
                  />
                </label>
                <label>
                  {t.dressNote}
                  <textarea
                    rows={3}
                    value={draft.dressCode?.note || ""}
                    maxLength={2000}
                    onChange={(e) =>
                      update({
                        dressCode: {
                          title: draft.dressCode?.title || "",
                          note: e.target.value,
                          swatches: draft.dressCode?.swatches || [],
                        },
                      })
                    }
                  />
                </label></>}
              </>
            )}
            {tab === "appearance" && (
              <>
                <div className="pf-editor-section-title">
                  <span className="pf-eyebrow">04 / {t.progress}</span>
                  <h2>{t.appearance}</h2>
                </div>
                <fieldset className="pf-mood-profiles">
                  <legend className="pf-field-heading">{locale === "ru" ? "Пресеты дизайна" : "Dizayn uslublari"}</legend>
                  {moodProfiles.map((profile) => {
                    const { bg, surface, ink, accent } = studioPalettes[profile.selection.paletteId];
                    const descriptionId = `pf-mood-description-${profile.id}`;
                    return (
                      <button key={profile.id} className="pf-mood-profile" type="button" aria-label={profile.name} aria-describedby={descriptionId} aria-pressed={moodProfile?.id === profile.id} onClick={() => setDraft((current) => applyInvitationDesign(current, profile.selection))}>
                        <span className="pf-mood-swatches" aria-hidden="true">{[bg, surface, accent, ink].map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
                        <span className="pf-mood-label"><strong>{profile.name}</strong><small id={descriptionId}>{profile.description[locale]}</small></span>
                      </button>
                    );
                  })}
                </fieldset>
                {draft.artDirection && <>
                  <div className="pf-field-heading">{locale === "ru" ? "Авторская концепция" : "Mualliflik konsepsiyasi"}</div>
                  <p className="pf-muted">{draft.artDirection.title}</p>
                  <label>{locale === "ru" ? "Композиция сайта" : "Sayt kompozitsiyasi"}<select value={draft.artDirection.layout} onChange={(e) => updateDesign({ artDirection: { ...draft.artDirection!, layout: e.target.value as NonNullable<InvitationDraft["artDirection"]>["layout"] } })}>
                    <option value="editorial">{locale === "ru" ? "Редакционная история" : "Tahririy hikoya"}</option><option value="immersive">{locale === "ru" ? "Погружение в атмосферу" : "Muhitga sho‘ng‘ish"}</option><option value="keepsake">{locale === "ru" ? "Личное послание" : "Shaxsiy maktub"}</option>
                  </select></label>
                  <small className="pf-muted">{locale === "ru" ? "Чтобы изменить материал, фон или свет, опишите новое оформление в разделе ИИ." : "Material, fon yoki yorug‘likni o‘zgartirish uchun AI bo‘limida yangi bezakni tasvirlang."}</small>
                </>}
                {!draft.artDirection && <><label>
                  {t.template}
                  <select
                    value={isGreeting && ["heritage", "sculpted-garden"].includes(draft.templateId) ? "editorial" : draft.templateId}
                    onChange={(e) => {
                      const templateId = e.target.value as InvitationDraft["templateId"];
                      if (templateId === "heritage" || templateId === "sculpted-garden") update({ templateId, composition: undefined, ornamentSetId: undefined, paletteId: templateId === "heritage" ? "cinnabar" : "ivory", fontPairId: templateId === "heritage" ? "romantic" : "editorial" });
                      else {
                        const descriptor = studioTemplates.find((item) => item.id === templateId)!;
                        updateDesign({ templateId, composition: resolveStudioComposition(descriptor.id), ornamentSetId: descriptor.ornamentSetId });
                      }
                    }}
                  >
                    {platformTemplates.filter((template) => !isGreeting || !["heritage", "sculpted-garden"].includes(template.id)).map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="pf-field-heading">{t.palette}</div>
                <div className="pf-palette-picker">
                  {palettes.filter((palette) => !dedicated || palette.id === draft.paletteId || ["ivory", "sage", "midnight", "rose", "cinnabar"].includes(palette.id)).map((palette) => (
                    <button
                      type="button"
                      key={palette.id}
                      aria-pressed={draft.paletteId === palette.id}
                      onClick={() => updateDesign({ paletteId: palette.id })}
                    >
                      <span style={{ backgroundColor: palette.color }}>
                        {draft.paletteId === palette.id && (
                          <Icon name="check" size={18} />
                        )}
                      </span>
                      {palette.name}
                    </button>
                  ))}
                </div>
                </>}
                <label>
                  {t.font}
                  <select
                    value={draft.fontPairId}
                    onChange={(e) =>
                      updateDesign({
                        fontPairId: e.target
                          .value as InvitationDraft["fontPairId"],
                      })
                    }
                  >
                    {Object.entries(fonts)
                      .filter(
                        ([id]) =>
                          id === draft.fontPairId || ((!dedicated || ["editorial", "classic", "modern", "romantic"].includes(id)) && (id !== "romantic" || draft.templateId === "heritage")),
                      )
                      .map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                  </select>
                </label>
                {!draft.artDirection && composition && selection && <>
                  <div className="pf-field-heading">{t.composition}</div><small className="pf-muted">{t.compositionHint}</small>
                  {([
                    ["heroLayout", compositionLabels.hero, STUDIO_HERO_LAYOUTS],
                    ["photoShape", compositionLabels.photo, STUDIO_PHOTO_SHAPES],
                    ["surfaceStyle", compositionLabels.surface, STUDIO_SURFACE_STYLES],
                    ["spacingScale", compositionLabels.spacing, STUDIO_SPACING_SCALES],
                    ["typographyAccent", compositionLabels.accent, STUDIO_TYPOGRAPHY_ACCENTS],
                  ] as const).map(([key, label, options]) => <label key={key}>{label}<select value={composition[key]} onChange={(e) => updateComposition({ [key]: e.target.value })}>{options.map((id) => <option key={id} value={id} disabled={id === "italic-serif-accent" && !studioFontPairTags[selection.fontPairId].includes("serif")}>{compositionLabels[id]}</option>)}</select></label>)}
                  <label>{compositionLabels.ornaments}<select value={selection.ornamentSetId} onChange={(e) => updateDesign({ ornamentSetId: e.target.value as InvitationDraft["ornamentSetId"], composition })}>{STUDIO_ORNAMENT_SET_IDS.filter((id) => !studioSelectionCompatibility({ ...selection, composition, ornamentSetId: id }).length).map((id) => <option key={id} value={id}>{compositionLabels[id]}</option>)}</select></label>
                  <label>
                    {compositionLabels.motion}
                    <select value={composition.motionPreset || ""} onChange={(e) => updateComposition({ motionPreset: e.target.value as StudioComposition["motionPreset"] || undefined })}>
                      <option value="">{locale === "ru" ? "Как в теме" : "Mavzudagidek"}</option>
                      {STUDIO_MOTION_PRESETS.filter((id) => !isGreeting || id !== "unfold").map((id) => <option key={id} value={id}>{compositionLabels[id]}</option>)}
                    </select>
                  </label>
                  {!isGreeting && <label>
                    {compositionLabels.order}
                    <select value={composition.sectionOrder || "story-first"} onChange={(e) => updateComposition({ sectionOrder: e.target.value as StudioComposition["sectionOrder"] })}>
                      {STUDIO_SECTION_ORDERS.map((id) => <option key={id} value={id}>{compositionLabels[id]}</option>)}
                    </select>
                  </label>}
                  <fieldset className="pf-block-variants">
                    <legend className="pf-field-heading">{locale === "ru" ? "Варианты блоков" : "Blok variantlari"}</legend>
                    {(Object.keys(STUDIO_SECTION_VARIANTS) as (keyof typeof STUDIO_SECTION_VARIANTS)[])
                      .filter((key) => !isGreeting || key === "story" || key === "gallery" || key === "wishes")
                      .map((key) => <label key={key}>
                        {blockLabels[key]}
                        <select value={composition.sectionVariants[key] ?? STUDIO_SECTION_VARIANTS[key][0]} onChange={(e) => {
                          updateComposition({ sectionVariants: { ...composition.sectionVariants, [key]: e.target.value } });
                        }}>
                          {STUDIO_SECTION_VARIANTS[key].map((id) => <option key={id} value={id}>{variantLabels[id]}</option>)}
                        </select>
                      </label>)}
                  </fieldset>
                </>}
                <div className="pf-field-heading">{t.sections}</div>
                <div className="pf-section-toggles">
                  {Object.entries(sectionLabels).filter(([id]) => !isGreeting || ["opening", "greeting", "story", "wishes", "closing"].includes(id)).map(([id, label]) => (
                    <label className="pf-toggle" key={id}>
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={draft.enabledSections.includes(
                          id as InvitationDraft["enabledSections"][number],
                        )}
                        onChange={(e) =>
                          update({
                            enabledSections: e.target.checked
                              ? [
                                  ...draft.enabledSections,
                                  id as InvitationDraft["enabledSections"][number],
                                ]
                              : draft.enabledSections.filter((x) => x !== id),
                          })
                        }
                      />
                      <i />
                    </label>
                  ))}
                </div>
              </>
            )}
          </fieldset>}
          {tab === "history" && <DesignHistoryPanel
            record={record}
            locale={locale}
            disabled={action || record.status === "archived"}
            previewDesign={previewDesign}
            prepare={async () => await persist() ? recordRef.current : null}
            onBusy={setAction}
            onPreview={setPreviewDesign}
            onRestored={(next) => acceptGeneration(next)}
          />}
          {tab !== "history" && <AiRefinePanel
            record={record}
            locale={locale}
            disabled={action || record.status === "archived"}
            previousDraft={previousDraft}
            prepare={async () => await persist() ? recordRef.current : null}
            onBusy={setAction}
            onResult={acceptGeneration}
            onRestore={() => {
              if (!previousDraft) return;
              const restored = restoreBeforeGeneration(draftRef.current, previousDraft);
              draftRef.current = restored;
              setDraft(restored);
              setPreviousDraft(undefined);
            }}
          />}
          <div className="pf-editor-publication">
            {record.status === "published" && (
              <>
                <span className="pf-status pf-status-published">
                  <span />
                  {t.publishedNotice}
                </span>
                <p>{t.publishedVersion}</p>
                <label>
                  {t.publicLink}
                  <input
                    readOnly
                    value={publicUrl}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <div className="pf-editor-link-actions">
                  <button
                    className="pf-button pf-button-outline"
                    onClick={copyLink}
                  >
                    <Icon name="copy" size={15} />
                    {copied ? t.copied : t.copy}
                  </button>
                  <a
                    className="pf-button pf-button-outline"
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="external" size={15} />
                    {t.preview}
                  </a>
                </div>
                <button
                  className="pf-text-button"
                  disabled={action}
                  onClick={() => void lifecycle("unpublish")}
                >
                  {t.unpublish}
                </button>
              </>
            )}
            {record.status === "archived" ? (
              <>
                <p className="pf-muted">{t.archived}</p>
                <button
                  className="pf-button pf-button-outline"
                  disabled={action}
                  onClick={() => void lifecycle("unpublish")}
                >
                  {t.restore}
                </button>
              </>
            ) : (
              <button
                className="pf-archive-button"
                disabled={action}
                onClick={() => void lifecycle("archive")}
              >
                {t.archive}
              </button>
            )}
          </div>
        </div>
        <div className="pf-editor-preview">
          <div className="pf-preview-toolbar">
            <span>
              <i />
              LIVE PREVIEW
            </span>
            <div>
              <button
                className="pf-icon-button"
                aria-label={t.mobile}
                aria-pressed={viewport === "mobile"}
                onClick={() => setViewport("mobile")}
              >
                <Icon name="phone" size={18} />
              </button>
              <button
                className="pf-icon-button"
                aria-label={t.desktop}
                aria-pressed={viewport === "desktop"}
                onClick={() => setViewport("desktop")}
              >
                <Icon name="desktop" size={19} />
              </button>
            </div>
          </div>
          {previewDesign && <div className="pf-history-preview-notice" role="status">
            <span>{locale === "ru" ? "Просмотр оформления · черновик ещё не изменён" : "Bezakni ko‘rish · qoralama hali o‘zgarmagan"}</span>
            <button type="button" className="pf-text-button" onClick={() => setPreviewDesign(undefined)}>
              {locale === "ru" ? "Показать мой черновик" : "Qoralamamni ko‘rsatish"}
            </button>
          </div>}
          <div
            className={`pf-preview-viewport pf-preview-viewport-${viewport}`}
          >
            <iframe
              ref={iframe}
              title={t.preview}
              src="/dashboard/preview"
              onLoad={sendPreview}
            />
          </div>
          <p className="pf-preview-note">{t.complete}</p>
        </div>
      </div>
    </dialog>
  );
}
