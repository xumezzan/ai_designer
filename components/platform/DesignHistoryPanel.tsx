"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { InvitationDraft, InvitationRecord } from "@/lib/platform/schema";
import type { InvitationDesign, DesignHistoryItem as DesignVersion, DesignHistoryPage as HistoryResponse } from "@/lib/platform-design/schema";
import { platformRequest } from "@/lib/platform/client";
import { platformTemplates } from "@/lib/platform/i18n";
import { Icon } from "./Icon";
import { Miniature } from "./Miniature";
import "./design-history.css";

const copy = {
  ru: {
    title: "История оформления",
    introduction: "Выбирайте прежнее оформление: имена, дата, место и ваши тексты останутся текущими. Гостевая версия обновляется кнопкой публикации.",
    saved: "Сохранённый вариант", generated: "Создано ИИ", beforeGeneration: "До генерации", beforeRestore: "До восстановления",
    current: "Сейчас в черновике", preview: "Примерить", previewing: "В предпросмотре", selected: "Выбрано для предпросмотра",
    exit: "Выйти из предпросмотра", restore: "Вернуть оформление", restoring: "Возвращаем оформление…",
    saveLabel: "Название варианта", optional: "необязательно", savePlaceholder: "Например: Тёплый фарфор", save: "Сохранить оформление", saving: "Сохраняем оформление…",
    saveHelp: "Сохраните текущий черновик, чтобы вернуться к его оформлению позже.", savePreviewHelp: "Выйдите из предпросмотра, чтобы сохранить оформление своего черновика.", savedNotice: "Оформление сохранено в истории.", restoredNotice: "Оформление возвращено в черновик. Данные события сохранены.",
    loading: "Загружаем историю…", more: "Показать ещё", retry: "Обновить историю", empty: "Здесь появятся сохранённые варианты и результаты генерации.",
    loadError: "Не удалось загрузить историю. Попробуйте ещё раз.", mutationError: "Не удалось сохранить изменение. Проверьте соединение и повторите действие.",
    previewNote: "Предпросмотр не меняет сохранённый черновик.", same: "Это оформление уже используется в черновике.",
  },
  "uz-latn": {
    title: "Bezak tarixi",
    introduction: "Oldingi bezakni tanlang: ismlar, sana, joy va matnlaringiz o‘zgarmaydi. Mehmonlar versiyasi nashr tugmasi bilan yangilanadi.",
    saved: "Saqlangan variant", generated: "AI yaratgan", beforeGeneration: "Yaratishdan oldin", beforeRestore: "Qaytarishdan oldin",
    current: "Hozirgi qoralamada", preview: "Ko‘rib chiqish", previewing: "Ko‘rish rejimida", selected: "Ko‘rish uchun tanlandi",
    exit: "Ko‘rish rejimidan chiqish", restore: "Bezakni qaytarish", restoring: "Bezak qaytarilmoqda…",
    saveLabel: "Variant nomi", optional: "ixtiyoriy", savePlaceholder: "Masalan: Iliq chinni", save: "Bezakni saqlash", saving: "Bezak saqlanmoqda…",
    saveHelp: "Bezakka keyinroq qaytish uchun hozirgi qoralamani saqlang.", savePreviewHelp: "Qoralamangiz bezagini saqlash uchun ko‘rish rejimidan chiqing.", savedNotice: "Bezak tarixda saqlandi.", restoredNotice: "Bezak qoralamaga qaytarildi. Tadbir maʼlumotlari saqlandi.",
    loading: "Tarix yuklanmoqda…", more: "Yana ko‘rsatish", retry: "Tarixni yangilash", empty: "Saqlangan variantlar va yaratilgan natijalar shu yerda ko‘rinadi.",
    loadError: "Tarixni yuklab bo‘lmadi. Qayta urinib ko‘ring.", mutationError: "O‘zgarishni saqlab bo‘lmadi. Aloqani tekshirib, qayta urinib ko‘ring.",
    previewNote: "Ko‘rish rejimi saqlangan qoralamani o‘zgartirmaydi.", same: "Bu bezak hozir qoralamada ishlatilmoqda.",
  },
} as const;

/** Compare only the bounded appearance fields, never event facts or copy. */
function designKey(design: InvitationDesign | InvitationDraft) {
  return JSON.stringify([
    design.templateId, design.paletteId, design.fontPairId, design.ornamentSetId ?? null, design.composition ?? null, design.artDirection ?? null,
    design.artwork?.id ?? null, design.artwork?.src ?? null,
    design.artworkWide?.id ?? null, design.artworkWide?.src ?? null,
  ]);
}

export function DesignHistoryPanel({ record, locale, disabled, prepare, onBusy, onPreview, onRestored, previewDesign }: {
  record: InvitationRecord;
  locale: "ru" | "uz-latn";
  disabled: boolean;
  prepare: () => Promise<InvitationRecord | null>;
  onBusy: (busy: boolean) => void;
  onPreview: (design?: InvitationDesign) => void;
  onRestored: (record: InvitationRecord) => void;
  previewDesign?: InvitationDesign;
}) {
  const t = copy[locale];
  const headingId = useId();
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [selected, setSelected] = useState<DesignVersion>();
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"save" | "restore" | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [notice, setNotice] = useState<"saved" | "restored" | null>(null);
  const mounted = useRef(true);
  const invitationId = useRef(record.id);
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const callbacks = useRef({ prepare, onBusy, onPreview, onRestored });
  callbacks.current = { prepare, onBusy, onPreview, onRestored };
  invitationId.current = record.id;
  const currentDesignKey = designKey(record.draft);
  const previewDesignKey = previewDesign ? designKey(previewDesign) : undefined;
  const previousIdentity = useRef({ id: record.id, designKey: currentDesignKey });

  const readHistory = useCallback(async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setLoadError(false);
    const id = record.id;
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const result = await platformRequest<HistoryResponse>(`/invitations/${id}/design-history${query}`, { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted || invitationId.current !== id || request.current !== controller) return;
      const page = result.versions.slice(0, 20);
      setVersions((previous) => cursor
        ? [...previous, ...page.filter((version) => !previous.some((item) => item.key === version.key))]
        : page);
      setNextCursor(result.nextCursor);
    } catch {
      if (mounted.current && !controller.signal.aborted && invitationId.current === id && request.current === controller) setLoadError(true);
    } finally {
      if (mounted.current && request.current === controller) setLoading(false);
    }
  }, [record.id]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  useEffect(() => {
    void readHistory();
    return () => request.current?.abort();
  }, [record.updatedAt, readHistory]);

  useEffect(() => {
    const previous = previousIdentity.current;
    if (previous.id !== record.id || previous.designKey !== currentDesignKey) {
      setSelected(undefined);
      callbacks.current.onPreview(undefined);
      setMutationError("");
      if (previous.id !== record.id) {
        setVersions([]);
        setNextCursor(undefined);
        setLabel("");
        setNotice(null);
      }
    }
    previousIdentity.current = { id: record.id, designKey: currentDesignKey };
  }, [record.id, currentDesignKey]);

  useEffect(() => {
    if (!previewDesignKey) {
      setSelected(undefined);
    } else {
      setSelected((previous) => previous && designKey(previous.design) === previewDesignKey
        ? previous
        : versions.find((version) => designKey(version.design) === previewDesignKey));
    }
  }, [previewDesignKey, versions]);

  function preview(version?: DesignVersion) {
    setSelected(version);
    setMutationError("");
    setNotice(null);
    callbacks.current.onPreview(version?.design);
  }

  async function mutate(kind: "save" | "restore") {
    if (locked.current || (kind === "restore" && !selected)) return;
    locked.current = true;
    setAction(kind);
    setMutationError("");
    setNotice(null);
    callbacks.current.onBusy(true);
    const id = record.id;
    const reference = selected?.reference;
    try {
      const saved = await callbacks.current.prepare();
      if (!saved || saved.id !== id || invitationId.current !== id || !mounted.current) return;
      const result = await platformRequest<{ invitation: InvitationRecord }>(`/invitations/${id}/design-history`, {
        method: "POST",
        body: JSON.stringify({
          action: kind,
          expectedUpdatedAt: saved.updatedAt,
          ...(kind === "restore" ? { reference } : { label: label.trim() || undefined }),
        }),
      });
      if (!mounted.current || invitationId.current !== id) return;
      if (kind === "restore") {
        setSelected(undefined);
        callbacks.current.onPreview(undefined);
        callbacks.current.onRestored(result.invitation);
      } else {
        setLabel("");
      }
      setNotice(kind === "save" ? "saved" : "restored");
      await readHistory();
    } catch (error) {
      if (mounted.current && invitationId.current === id) setMutationError(error instanceof Error ? error.message : t.mutationError);
    } finally {
      locked.current = false;
      if (mounted.current && invitationId.current === id) {
        setAction(null);
        callbacks.current.onBusy(false);
      }
    }
  }

  const sourceLabel = (version: DesignVersion) => ({
    "before-generation": t.beforeGeneration,
    generated: t.generated,
    saved: t.saved,
    "before-restore": t.beforeRestore,
  })[version.source];
  const paletteLabel = (design: InvitationDesign) => ({
    ivory: locale === "ru" ? "Слоновая кость" : "Fil suyagi",
    sage: locale === "ru" ? "Шалфей" : "Mavrak",
    midnight: locale === "ru" ? "Полночь" : "Yarim tun",
    rose: locale === "ru" ? "Пыльная роза" : "Atirgul",
    cinnabar: locale === "ru" ? "Киноварь" : "Qizil kinovar",
    champagne: locale === "ru" ? "Шампань" : "Shampan",
    terracotta: locale === "ru" ? "Терракота" : "Terrakota",
    ink: locale === "ru" ? "Чернила" : "Siyoh",
    wine: locale === "ru" ? "Винный" : "Sharob",
    slate: locale === "ru" ? "Сланец" : "Slanets",
    cobalt: locale === "ru" ? "Кобальт" : "Kobalt",
    clay: locale === "ru" ? "Глина" : "Gil",
    forest: locale === "ru" ? "Лесной" : "O‘rmon",
    "modern-editorial": locale === "ru" ? "Журнальная бумага" : "Jurnal qog‘ozi",
    "botanical-haute": locale === "ru" ? "Лён и шалфей" : "Zig‘ir va mavrak",
    "velvet-noir": locale === "ru" ? "Уголь и золото" : "Ko‘mir va oltin",
  })[design.paletteId];
  const fontLabel = (design: InvitationDesign) => ({
    editorial: "Cormorant", classic: "EB Garamond", modern: "Tenor Sans", romantic: "Marck Script", ceremony: "Cormorant + Garamond", poetic: "Prata", modernist: "Unbounded", gallery: "Tenor Sans + Golos",
    "modern-editorial": "Cormorant + Inter", "botanical-haute": "Prata + Manrope", "velvet-noir": "Bodoni Moda + Montserrat",
  })[design.fontPairId];
  const dateLabel = (createdAt: string) => new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "uz-Latn", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(createdAt));
  const selectionIsCurrent = selected ? designKey(selected.design) === currentDesignKey : false;
  const controlsDisabled = disabled || Boolean(action);

  return <section className="pf-design-history" aria-labelledby={headingId}>
    <div className="pf-design-history-heading"><Icon name="clock" size={18} /><h3 id={headingId}>{t.title}</h3></div>
    <p className="pf-design-history-intro">{t.introduction}</p>
    <div className="pf-design-history-save pf-form">
      <label>{t.saveLabel} <small>({t.optional})</small><input value={label} maxLength={80} placeholder={t.savePlaceholder} disabled={controlsDisabled || Boolean(previewDesign)} onChange={(event) => setLabel(event.target.value)} /></label>
      <small>{previewDesign ? t.savePreviewHelp : t.saveHelp}</small>
      <button type="button" className="pf-button pf-button-outline" disabled={controlsDisabled || Boolean(previewDesign)} onClick={() => void mutate("save")}><Icon name="plus" size={15} />{action === "save" ? t.saving : t.save}</button>
    </div>
    {notice && <p className="pf-design-history-notice" role="status"><Icon name="check" size={14} />{notice === "saved" ? t.savedNotice : t.restoredNotice}</p>}
    {mutationError && <p className="pf-inline-error" role="alert">{mutationError}</p>}
    {loadError && <div className="pf-design-history-error"><p className="pf-inline-error" role="alert">{t.loadError}</p><button type="button" className="pf-text-button" disabled={loading || controlsDisabled} onClick={() => void readHistory()}>{t.retry}</button></div>}
    {!versions.length && !loading && !loadError && <p className="pf-design-history-empty">{t.empty}</p>}
    <div className="pf-design-history-grid" aria-busy={loading}>
      {versions.map((version) => {
        const isCurrent = designKey(version.design) === currentDesignKey;
        const isSelected = selected?.key === version.key;
        const name = version.label || sourceLabel(version);
        const templateName = platformTemplates.find((template) => template.id === version.design.templateId)?.name ?? "";
        const artwork = version.design.templateId === "sculpted-garden" ? version.design.artwork ?? version.design.artworkWide : undefined;
        return <button type="button" className={`pf-design-history-card${isSelected ? " is-selected" : ""}`} key={version.key} aria-pressed={isSelected} aria-label={`${t.preview}: ${name}, ${dateLabel(version.createdAt)}${isCurrent ? `, ${t.current}` : ""}`} disabled={controlsDisabled} onClick={() => preview(version)}>
          <span className="pf-design-history-thumbnail" data-palette={version.design.paletteId} aria-hidden="true">
            {artwork ? (
              // eslint-disable-next-line @next/next/no-img-element -- Owner-scoped history media must bypass the public image optimizer cache.
              <img src={artwork.src} alt="" loading="lazy" decoding="async" />
            ) : <Miniature template={version.design.templateId} purpose={record.draft.purpose} locale={locale} names={record.draft.names} date={record.draft.date.day} small />}
            {isCurrent && <span className="pf-design-history-current"><Icon name="check" size={12} />{t.current}</span>}
          </span>
          <span className="pf-design-history-card-copy"><span className="pf-design-history-name">{name}</span><span className="pf-design-history-source">{sourceLabel(version)} · {templateName}</span><span className="pf-design-history-appearance">{paletteLabel(version.design)} · {fontLabel(version.design)}</span><time dateTime={version.createdAt}>{dateLabel(version.createdAt)}</time>{isSelected && <span className="pf-design-history-preview-tag">{t.previewing}</span>}</span>
        </button>;
      })}
    </div>
    {loading && <p className="pf-design-history-loading" role="status">{t.loading}</p>}
    {nextCursor && <button type="button" className="pf-text-button pf-design-history-more" disabled={loading || controlsDisabled} onClick={() => void readHistory(nextCursor)}>{t.more}</button>}
    {selected && <div className="pf-design-history-selection">
      <span className="pf-eyebrow">{t.selected}</span>
      <strong>{selected.label || sourceLabel(selected)}</strong>
      <p>{selectionIsCurrent ? t.same : t.previewNote}</p>
      <button type="button" className="pf-button pf-button-dark" disabled={controlsDisabled || selectionIsCurrent} onClick={() => void mutate("restore")}>{action === "restore" ? t.restoring : t.restore}</button>
      <button type="button" className="pf-text-button" disabled={controlsDisabled} onClick={() => preview()}>{t.exit}</button>
    </div>}
  </section>;
}
