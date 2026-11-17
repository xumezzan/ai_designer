"use client";

import { useEffect, useRef, useState } from "react";
import type { InvitationDraft, InvitationRecord } from "@/lib/platform/schema";
import type { GenerationView } from "@/lib/platform-ai/schema";
import { platformRequest, PlatformRequestError } from "@/lib/platform/client";
import "./ai-refine.css";

export function AiRefinePanel({ record, locale, disabled, previousDraft, prepare, onResult, onRestore, onBusy }: {
  record: InvitationRecord;
  locale: "ru" | "uz-latn";
  disabled: boolean;
  previousDraft?: InvitationDraft;
  prepare: () => Promise<InvitationRecord | null>;
  onResult: (record: InvitationRecord, previous?: InvitationDraft) => void;
  onRestore: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const ru = locale === "ru";
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<string>();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  const locked = useRef(false);
  const interaction = useRef(0);
  const storageKey = `atelier-generation:${record.ownerId}:${record.id}`;
  useEffect(() => {
    mounted.current = true;
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(storageKey); } catch { /* Discover the server job even without browser storage. */ }
    if (saved && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved)) saved = null;
    if (saved) setPending(saved);
    const controller = new AbortController();
    const epoch = interaction.current;
    // Pending jobs belong to the account, not the lifetime of a browser tab.
    void platformRequest<{ generation: GenerationView | null }>(`/invitations/${record.id}/generate?latest=1`, { signal: controller.signal })
      .then(({ generation }) => {
        if (controller.signal.aborted || !mounted.current || interaction.current !== epoch || saved) return;
        if (generation?.job.status === "running") {
          setPending(generation.job.requestId);
          try { sessionStorage.setItem(storageKey, generation.job.requestId); } catch { /* Server discovery remains available. */ }
          setMessage(ru ? "Предыдущее оформление ещё создаётся. Можно проверить его статус." : "Oldingi bezak hali yaratilmoqda. Uning holatini tekshirishingiz mumkin.");
        }
      })
      .catch(() => { /* Manual generation/status actions surface actionable errors. */ });
    return () => { mounted.current = false; controller.abort(); };
  }, [storageKey, record.id, ru]);
  function remember(id?: string) {
    setPending(id);
    try {
      if (id) sessionStorage.setItem(storageKey, id);
      else sessionStorage.removeItem(storageKey);
    } catch { /* The durable server job remains available. */ }
  }
  function accept(result: GenerationView) {
    if (!mounted.current) return;
    if (result.job.status === "running") {
      remember(result.job.requestId);
      setMessage(ru ? "Генерация ещё выполняется. Проверьте её статус — новый запрос к ИИ не запускается." : "Yaratish davom etmoqda. Holatini tekshiring — yangi AI so‘rovi yuborilmaydi.");
      setFailed(false);
      return;
    }
    remember();
    if (result.job.status === "failed") {
      setFailed(true);
      setMessage(result.job.error?.message || (ru ? "Генерация не завершилась. Предыдущий вариант сохранён." : "Yaratish yakunlanmadi. Oldingi variant saqlandi."));
    } else if (result.invitation) {
      onResult(result.invitation, result.previousDraft);
      setFailed(false);
      setMessage(result.job.summary || (ru ? "Новое оформление сохранено в черновике." : "Yangi bezak qoralamada saqlandi."));
    }
  }
  async function run(checkOnly = false) {
    if (locked.current) return;
    locked.current = true;
    interaction.current += 1;
    setBusy(true);
    setChecking(checkOnly && Boolean(pending));
    onBusy(true);
    setFailed(false);
    setMessage("");
    let requestId = pending;
    try {
      // Flush local edits before GET recovery too. The API returns the current
      // record; applying it must never discard text still inside the debounce.
      const saved = await prepare();
      if (!saved) return;
      if (checkOnly && requestId) {
        accept(await platformRequest<GenerationView>(`/invitations/${record.id}/generate?requestId=${requestId}`));
        return;
      }
      requestId = crypto.randomUUID();
      remember(requestId);
      const result = await platformRequest<GenerationView>(`/invitations/${record.id}/generate`, {
        method: "POST",
        body: JSON.stringify({ requestId, expectedUpdatedAt: saved.updatedAt, brief }),
      });
      accept(result);
    } catch (error) {
      if (!mounted.current) return;
      // A server or transport failure can hide a successful paid request.
      // Keep its ID and offer only GET until the outcome is resolved.
      if (error instanceof PlatformRequestError) {
        if (error.status < 500 || error.code === "AI_NOT_CONFIGURED") remember();
        setMessage(error.message);
      } else {
        setMessage(ru ? "Связь прервалась. Проверьте статус текущей генерации перед новым запуском." : "Aloqa uzildi. Qayta boshlashdan oldin joriy yaratish holatini tekshiring.");
      }
      setFailed(true);
    } finally {
      locked.current = false;
      if (mounted.current) {
        setBusy(false);
        setChecking(false);
        onBusy(false);
      }
    }
  }
  return <section className="pf-ai-refine pf-form" aria-labelledby="pf-refine-title">
    <span className="pf-eyebrow">IVORY ATELIER / AI</span>
    <h3 id="pf-refine-title">{ru ? "Новое оформление сайта" : "Sayt uchun yangi bezak"}</h3>
    <p>{ru ? "Опишите композицию, шрифты, цвета и настроение. Имена, факты и ваши тексты сохранятся. Публикация обновляется отдельной кнопкой." : "Kompozitsiya, shriftlar, ranglar va kayfiyatni tasvirlang. Ismlar, maʼlumotlar va matnlaringiz saqlanadi. Nashr alohida tugma bilan yangilanadi."}</p>
    <label>{ru ? "Что изменить в дизайне" : "Dizaynda nimani o‘zgartirish kerak"}
      <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} minLength={20} maxLength={2000} disabled={disabled || busy || Boolean(pending)} placeholder={ru ? "Крупная типографика, тёплая бумага, воздушные интервалы и тонкие ботанические детали…" : "Yirik shriftlar, iliq qog‘oz, keng oraliqlar va nozik botanik detallar…"} />
    </label>
    <small>{ru ? "Генерация занимает несколько минут и использует лимит ИИ." : "Yaratish bir necha daqiqa davom etadi va AI limitini sarflaydi."}</small>
    <button className="pf-button pf-button-dark" type="button" disabled={disabled || busy || (!pending && brief.trim().length < 20)} onClick={() => void run(Boolean(pending))}>
      {busy ? checking ? (ru ? "Проверяем статус…" : "Holat tekshirilmoqda…") : (ru ? "Создаём оформление…" : "Bezak yaratilmoqda…") : pending ? (ru ? "Проверить статус" : "Holatini tekshirish") : (ru ? "Создать оформление" : "Bezak yaratish")}
    </button>
    {message && <p role={failed ? "alert" : "status"} className={failed ? "pf-inline-error" : "pf-muted"}>{message}</p>}
    {previousDraft && <button className="pf-text-button" type="button" disabled={disabled || busy || Boolean(pending)} onClick={() => {
      onRestore();
      setFailed(false);
      setMessage(ru ? "Предыдущий вариант возвращён." : "Oldingi variant qaytarildi.");
    }}>{ru ? "Вернуть вариант до генерации" : "Yaratishdan oldingi variantni qaytarish"}</button>}
  </section>;
}
