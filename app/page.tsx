import { Reveal } from "@/components/craft/Reveal";
import { spaceScale, spaceVars } from "@/lib/layout/space";
import { getTypeSet } from "@/registry/typesets";
import { NBSP, THIN_SPACE, typograph } from "@/lib/typography/ru";

/**
 * M0.5 placeholder. The studio shell arrives in M2; until then this page shows
 * the craft layer (SPEC §7.1) working, so it can be looked at rather than
 * believed. Every value on the page is produced by the library code.
 */

const SAMPLES: { label: string; text: string; locale?: "ru" | "uz-latn" }[] = [
  {
    label: "ru",
    text: 'А. П. Чехов писал в Ташкенте - город ждал гостей 12 июня 2027, зал на 120 мест, 5 км от центра.',
  },
  { label: "uz-latn", text: "O'zbekiston va san'at", locale: "uz-latn" },
];

const SPACE_STEPS = ["unit", "inside", "block", "section"] as const;

/** Non-breaking and thin spaces are invisible — show them as marks. */
function Typed({ text }: { text: string }) {
  const parts = text.split(/([  ])/g);
  return (
    <>
      {parts.map((part, i) =>
        part === NBSP ? (
          <span
            key={i}
            title="U+00A0 non-breaking space"
            className="mx-[1px] rounded bg-amber-200 px-1 align-middle text-[10px] font-medium text-amber-900"
          >
            nbsp
          </span>
        ) : part === THIN_SPACE ? (
          <span
            key={i}
            title="U+2009 thin space"
            className="mx-[1px] rounded bg-sky-200 px-1 align-middle text-[10px] font-medium text-sky-900"
          >
            thin
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function Home() {
  const typeSet = getTypeSet("ceremony");
  if (!typeSet) throw new Error('Type set "ceremony" is not registered');
  const scale = spaceScale(typeSet);

  return (
    <main
      className="mx-auto flex max-w-2xl flex-col gap-16 px-6 py-20"
      style={spaceVars(scale) as React.CSSProperties}
    >
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">Invitation Studio</h1>
        <p className="text-neutral-600">
          {typograph(
            'Внутренняя студия приглашений для событий. Интерфейс студии появится в вехе M2; здесь показан слой мастерства §7.1 — он всегда включён и не является полем темы.',
          )}
        </p>
      </header>

      <Reveal>
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Микротипографика</h2>
          <p className="text-sm text-neutral-600">
            Строка проходит через <code>typograph()</code> перед рендером. Выдача
            показана с метками на неразрывных и тонких пробелах.
          </p>
          <ul className="flex flex-col gap-5">
            {SAMPLES.map((sample) => (
              <li key={sample.text} className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-neutral-400">
                  {sample.label} · было
                </span>
                <p className="font-mono text-xs break-words text-neutral-500">
                  {sample.text}
                </p>
                <span className="text-xs uppercase tracking-wide text-neutral-400">
                  {sample.label} · стало
                </span>
                <p data-level="body" className="text-lg">
                  <Typed text={typograph(sample.text, sample.locale)} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Шкала пространств</h2>
          <p className="text-sm text-neutral-600">
            Производная от типографической шкалы ({typeSet.name}): атом — строка
            основного текста, множители задаёт отношение display/body ={" "}
            {(spaceScale(typeSet).block / scale.inside).toFixed(1)}× внутри блока.
          </p>
          <ul className="flex flex-col gap-3">
            {SPACE_STEPS.map((step) => (
              <li key={step} className="flex items-center gap-3">
                <span className="w-20 shrink-0 font-mono text-xs text-neutral-500">
                  {step}
                </span>
                <span className="flex-1">
                  <span
                    className="block w-full bg-neutral-800"
                    style={{ height: `var(--space-${step})` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right font-mono text-xs text-neutral-500">
                  {scale[step]}rem
                </span>
              </li>
            ))}
          </ul>
          <div className="flex h-40 w-24 flex-col overflow-hidden rounded border border-neutral-300">
            <div
              className="bg-neutral-100"
              style={{ height: "var(--space-hero-empty)" }}
            />
            <div
              className="bg-neutral-800"
              style={{ height: "var(--space-hero-content)" }}
            />
          </div>
          <p className="text-xs text-neutral-500">
            Герой: {scale.heroEmpty}svh пустых, {100 - scale.heroEmpty}svh под
            содержание.
          </p>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Хореография загрузки</h2>
          <p className="text-sm text-neutral-600">
            Каждый блок проявляется один раз при входе в область видимости.
            С отключённым JS метка <code>data-craft</code> не ставится, и блоки
            просто присутствуют.
          </p>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Порог качества</h2>
          <ul className="flex flex-col gap-2 text-sm text-neutral-600">
            <li>Видимый фокус с клавиатуры — обведите Tab по этой странице.</li>
            <li>
              <code>prefers-reduced-motion: reduce</code> — движение не
              проигрывается.
            </li>
            <li>
              Контраст AA, <code>lang</code>, осмысленный <code>alt</code> —
              проверяются в коде и в QA вехи M6.
            </li>
          </ul>
        </section>
      </Reveal>

      <Reveal delay={80}>
        <p className="text-sm text-neutral-500">
          Полное описание — в SPEC.md. Статус вех и решения — в docs/decisions.md.
        </p>
      </Reveal>
    </main>
  );
}
