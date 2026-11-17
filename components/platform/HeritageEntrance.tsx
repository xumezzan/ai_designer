"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Content } from "@/lib/schema/content";

const entranceCopy = {
  ru: {
    personal: "Приглашение для вас",
    wedding: "С радостью приглашаем вас",
    open: "Открыть приглашение",
    hint: "Коснитесь конверта — и наша история откроется",
    together: "Вместе с вами",
    replay: "Открыть конверт ещё раз",
  },
  "uz-latn": {
    personal: "Siz uchun taklifnoma",
    wedding: "Sizni mamnuniyat bilan taklif qilamiz",
    open: "Taklifnomani ochish",
    hint: "Konvertni bosing — hikoyamiz siz uchun ochiladi",
    together: "Siz bilan birga",
    replay: "Konvertni yana ochish",
  },
  en: {
    personal: "An invitation for you",
    wedding: "Joyfully invite you to celebrate",
    open: "Open the invitation",
    hint: "Touch the envelope to discover our story",
    together: "Together with you",
    replay: "Open the envelope again",
  },
};

/** Native dialog is a progressive enhancement: server-rendered content remains
 * available when scripting is disabled. Body scroll state is never mutated. */
export function HeritageEntrance({
  children,
  names,
  date,
  locale,
  enabled,
  embedded = false,
}: {
  children: ReactNode;
  names: string;
  date: string;
  locale: Content["locale"];
  enabled: boolean;
  embedded?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [opening, setOpening] = useState(false);
  const copy = entranceCopy[locale];

  useEffect(() => {
    const cover = dialog.current;
    if (
      !enabled ||
      embedded ||
      !cover ||
      window.location.hash ||
      typeof cover.showModal !== "function"
    )
      return;
    root.current?.setAttribute("data-enhanced", "true");
    cover.showModal();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cover.close();
    };
  }, [enabled, embedded]);

  function finishOpening() {
    if (timer.current) clearTimeout(timer.current);
    dialog.current?.close();
    setOpening(false);
    root.current
      ?.querySelector<HTMLElement>("[data-hp-focus]")
      ?.focus({ preventScroll: true });
  }

  function enter() {
    if (opening) return;
    setOpening(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      finishOpening();
    // Fallback also releases the dialog if motion is disabled mid-animation.
    else timer.current = setTimeout(finishOpening, 2400);
  }

  return (
    <div className="hp-experience" ref={root}>
      {children}
      {enabled && !embedded && (
        <>
          <div className="hp-replay-row">
            <button
              type="button"
              className="hp-replay"
              onClick={() => {
                setOpening(false);
                dialog.current?.showModal();
              }}
            >
              {copy.replay}
              <span aria-hidden="true"> ↗</span>
            </button>
          </div>
          <dialog
            ref={dialog}
            className="hp-entrance"
            data-opening={opening || undefined}
            aria-label={copy.open}
            onAnimationEnd={(event) => {
              if (
                event.target === event.currentTarget &&
                event.animationName === "hp-entrance-away"
              )
                finishOpening();
            }}
            onCancel={(event) => {
              event.preventDefault();
              enter();
            }}
          >
            <div className="hp-entrance-art hp-plum" aria-hidden="true" />
            <div className="hp-entrance-art hp-landscape" aria-hidden="true" />
            <div className="hp-entrance-inner">
              <p className="hp-eyebrow">{copy.personal}</p>
              <span className="hp-double-happiness" aria-hidden="true">
                囍 · 囍
              </span>
              <p className="hp-entrance-names">{names}</p>
              <p className="hp-entrance-subtitle">{copy.wedding}</p>
              <button
                type="button"
                className="hp-envelope-button"
                aria-label={copy.open}
                onClick={enter}
                disabled={opening}
              >
                <span className="hp-envelope" aria-hidden="true">
                  <span className="hp-envelope-back" />
                  <span className="hp-envelope-letter">
                    <span className="hp-letter-symbol">囍</span>
                    <span className="hp-letter-small">{copy.together}</span>
                    <span
                      className="hp-letter-names"
                      data-long-names={Array.from(names).length > 36 || undefined}
                    >
                      {names}
                    </span>
                  </span>
                  <span className="hp-envelope-front" />
                  <span className="hp-envelope-flap">
                    <span />
                  </span>
                  <span className="hp-envelope-seal">囍</span>
                </span>
              </button>
              <button
                type="button"
                className="hp-button hp-button-primary hp-entrance-open"
                onClick={enter}
                disabled={opening}
              >
                {copy.open}
                <span aria-hidden="true">→</span>
              </button>
              <p className="hp-entrance-hint">{copy.hint}</p>
              {date && <p className="hp-entrance-date">{date}</p>}
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
