"use client";

import { useId, useRef, useState, type FormEvent } from "react";

const messages = {
  ru: {
    eyebrow: "Будем ждать вашего ответа",
    title: "Разделите с нами этот день",
    introduction:
      "Пожалуйста, сообщите, сможете ли вы прийти. Это поможет нам позаботиться о каждом госте.",
    name: "Ваше имя и фамилия",
    attendance: "Вы будете с нами?",
    yes: "С удовольствием приду",
    no: "Не смогу прийти",
    maybe: "Пока не определился",
    count: "Количество гостей, включая вас",
    countHint: "Укажите всех, кто придёт вместе с вами.",
    message: "Пожелание или комментарий",
    optional: "Необязательно",
    submit: "Отправить ответ",
    pending: "Отправляем…",
    saved:
      "Спасибо! Ваш ответ сохранён. Вы можете изменить его, отправив форму ещё раз.",
    error:
      "Не удалось сохранить ответ. Проверьте соединение и попробуйте ещё раз.",
    local:
      "Ответ сохранён. Этот браузер не разрешил сохранить ключ для дальнейшего изменения ответа.",
    privacy: "Ваш ответ увидит организатор мероприятия.",
  },
  "uz-latn": {
    eyebrow: "Javobingizni kutamiz",
    title: "Bu kunni biz bilan baham ko‘ring",
    introduction:
      "Kela olishingizni bizga bildiring. Bu har bir mehmon uchun tayyorgarlik ko‘rishimizga yordam beradi.",
    name: "Ism va familiyangiz",
    attendance: "Biz bilan bo‘lasizmi?",
    yes: "Albatta kelaman",
    no: "Kela olmayman",
    maybe: "Hali aniq emas",
    count: "Siz bilan birga jami mehmonlar soni",
    countHint: "O‘zingizni va siz bilan keladiganlarni hisoblang.",
    message: "Tilak yoki izoh",
    optional: "Ixtiyoriy",
    submit: "Javobni yuborish",
    pending: "Yuborilmoqda…",
    saved:
      "Rahmat! Javobingiz saqlandi. Uni shaklni qayta yuborib o‘zgartirishingiz mumkin.",
    error:
      "Javob saqlanmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.",
    local:
      "Javob saqlandi. Brauzer javobni keyin o‘zgartirish kalitini saqlashga ruxsat bermadi.",
    privacy: "Javobingizni tadbir tashkilotchisi ko‘radi.",
  },
};

type Attendance = "yes" | "no" | "maybe";

/** This form belongs exclusively to a published platform invitation. The
 * capability token is stored locally; it is never included in a share URL. */
export function PublicRsvp({
  slug,
  locale,
}: {
  slug: string;
  locale: "ru" | "uz-latn";
}) {
  const copy = messages[locale];
  const id = useId();
  const token = useRef<string | undefined>(undefined);
  const [attendance, setAttendance] = useState<Attendance>("yes");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const endpoint = `/api/platform/public/${encodeURIComponent(slug)}/rsvp`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const storageKey = `invitation:rsvp:${slug}`;
    let editToken = token.current;
    if (!editToken) {
      try {
        editToken = window.localStorage.getItem(storageKey) || undefined;
      } catch {
        /* A response can still be saved with browser storage disabled. */
      }
    }
    setPending(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          status: attendance,
          guestCount: attendance === "yes" ? Number(form.get("guestCount")) : 1,
          message: String(form.get("message") || "").trim() || undefined,
          editToken,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          locale === "ru" && typeof data?.error?.message === "string"
            ? data.error.message
            : copy.error,
        );
        return;
      }
      if (typeof data?.editToken !== "string" || !data.response?.id)
        throw new Error(copy.error);
      token.current = data.editToken;
      try {
        window.localStorage.setItem(storageKey, data.editToken);
        setNotice(copy.saved);
      } catch {
        setNotice(copy.local);
      }
    } catch {
      setError(copy.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="rsvp"
      className="platform-rsvp invitation-section"
      aria-labelledby={`${id}-title`}
    >
      <p className="platform-section-eyebrow">{copy.eyebrow}</p>
      <h2 id={`${id}-title`}>{copy.title}</h2>
      <p className="platform-rsvp-introduction">{copy.introduction}</p>
      <form
        onSubmit={submit}
        method="post"
        action={endpoint}
        className="platform-rsvp-form"
        aria-busy={pending}
      >
        <fieldset disabled={pending} className="platform-rsvp-fields">
          <label htmlFor={`${id}-name`}>
            {copy.name}
            <input
              id={`${id}-name`}
              name="name"
              required
              minLength={1}
              maxLength={120}
              autoComplete="name"
            />
          </label>
          <fieldset className="platform-rsvp-attendance">
            <legend>{copy.attendance}</legend>
            {(["yes", "no", "maybe"] as const).map((status) => (
              <label key={status} data-selected={attendance === status}>
                <input
                  type="radio"
                  name="status"
                  value={status}
                  checked={attendance === status}
                  onChange={() => setAttendance(status)}
                />
                <span>{copy[status]}</span>
                <span aria-hidden="true">
                  {attendance === status ? "●" : "○"}
                </span>
              </label>
            ))}
          </fieldset>
          {attendance === "yes" && (
            <label htmlFor={`${id}-count`}>
              {copy.count}
              <input
                id={`${id}-count`}
                name="guestCount"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                step={1}
                defaultValue={1}
                required
                aria-describedby={`${id}-count-hint`}
              />
              <span className="platform-field-hint" id={`${id}-count-hint`}>
                {copy.countHint}
              </span>
            </label>
          )}
          <label htmlFor={`${id}-message`}>
            {copy.message}
            <span className="platform-field-hint">{copy.optional}</span>
            <textarea
              id={`${id}-message`}
              name="message"
              rows={3}
              maxLength={1000}
            />
          </label>
          <button className="platform-rsvp-submit" type="submit">
            {pending ? copy.pending : copy.submit}
            <span aria-hidden="true">↗</span>
          </button>
        </fieldset>
        <p className="platform-rsvp-privacy">{copy.privacy}</p>
        {notice && (
          <p className="platform-rsvp-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="platform-rsvp-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
