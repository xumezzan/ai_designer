import { Fragment } from "react";
import { BotanicalSprig } from "./Icon";

export function Miniature({
  template = "classic",
  names = ["Азиз", "Малика"],
  date = "24 · 05 · 2027",
  small = false,
  purpose,
  locale = "ru",
}: {
  template?: string;
  names?: string[];
  date?: string;
  small?: boolean;
  purpose?: "invitation" | "greeting";
  locale?: "ru" | "uz-latn";
}) {
  const graphic = template === "modern";
  const corporate = template === "corporate";
  const displayedNames = names.filter((name) => name.trim());
  return (
    <div
      className={`pf-miniature pf-miniature-${template}${small ? " pf-miniature-small" : ""}`}
      aria-hidden="true"
    >
      {template === "sculpted-garden" && (
        // Decorative artwork belongs inside the invitation, under live type.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pf-mini-sculpture" src="/artwork/sculpted-garden/portrait.webp" alt="" />
      )}
      {template === "botanical" && (
        <>
          <BotanicalSprig className="pf-mini-branch pf-mini-branch-left" />
          <BotanicalSprig className="pf-mini-branch pf-mini-branch-right" />
        </>
      )}
      {template === "nocturne" && (
        <svg className="pf-mini-deco" viewBox="0 0 200 100" fill="none">
          <path
            d="M10 95 100 8l90 87M28 95l72-69 72 69M48 95l52-50 52 50M100 8v87M10 95h180"
            stroke="currentColor"
            strokeWidth=".7"
          />
        </svg>
      )}
      {template === "heritage" && <span className="pf-mini-happiness">囍</span>}
      {graphic && <span className="pf-mini-ribbon" />}
      {corporate && <span className="pf-mini-grid" />}
      <span className="pf-mini-kicker">{purpose === "greeting" ? (locale === "ru" ? "ДЛЯ ВАС С ТЕПЛОМ" : "SIZGA MEHR BILAN") : corporate ? "SPECIAL EVENT" : graphic || displayedNames.length < 2 ? "YOUR SPECIAL DAY" : "THE WEDDING OF"}</span>
      {template === "classic" && (
        <span className="pf-mini-monogram">
          {names.map((x) => Array.from(x)[0]).join("")}
          <i />
        </span>
      )}
      <span className="pf-mini-names">
        {displayedNames.length ? displayedNames.map((name, index) => <Fragment key={index}>{index > 0 && <em>&</em>}{name}</Fragment>) : "Имя"}
      </span>
      <span className="pf-mini-rule" />
      <span className="pf-mini-date">{date || "ВАША ОСОБЕННАЯ ДАТА"}</span>
      <span className="pf-mini-bottom">{purpose === "greeting" ? (locale === "ru" ? "С ЛУЧШИМИ ПОЖЕЛАНИЯМИ" : "ENG EZGU TILAKLAR BILAN") : corporate ? "IDEAS · PEOPLE · FUTURE" : graphic ? "A DAY TO REMEMBER" : "TOGETHER WITH OUR FAMILIES"}</span>
    </div>
  );
}
