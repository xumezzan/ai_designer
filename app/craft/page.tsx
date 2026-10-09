import type { CSSProperties } from "react";
import Link from "next/link";
import { FontPreloads } from "@/components/craft/FontPreloads";
import { Reveal } from "@/components/craft/Reveal";
import { Theme } from "@/lib/schema/theme";
import { toCssVars } from "@/lib/theme/toCssVars";
import { typograph } from "@/lib/typography/ru";
import { getTypeSet } from "@/registry/typesets";
import "./specimen.css";

export const metadata = { title: "Оформление · Invitation Studio" };

/** Craft specimen, not an invitation template or a saved client project. */
export default async function CraftPage({ searchParams }: {
  searchParams: Promise<{ set?: string }>;
}) {
  const params = await searchParams;
  const id = params.set === "editorial" ? "editorial" : "ceremony";
  const typeSet = getTypeSet(id)!;
  const theme = Theme.parse({
    meta: { name: "Бумага и голос", mood: ["quiet"], rationale: "Craft specimen for the two prepared type sets." },
    palette: { bg: "#F4F7EF", surface: "#E9EDE2", ink: "#27241E", muted: "#625D53", accent: "#6E2330", accentAlt: "#5F6F49" },
    typeSet: id, materialSet: "paper", foil: { enabled: false, color: "#B08A4A" },
    ornament: { pack: "none", density: "light", placement: [], color: "accent" },
    layout: { preset: "scroll-narrative", hero: "typographic", sectionOrder: ["hero", "greeting", "footer"] },
    motion: { preset: "still", ambient: "none" },
  });
  return (
    <>
      <FontPreloads typeSet={id} locale="ru" />
      <header className="specimen-toolbar">
        <Link href="/">← Invitation Studio</Link>
        <nav aria-label="Типографическая пара">
          <Link href="/craft?set=ceremony" aria-current={id === "ceremony" ? "page" : undefined}>Ceremony</Link>
          <Link href="/craft?set=editorial" aria-current={id === "editorial" ? "page" : undefined}>Editorial</Link>
        </nav>
        <span>Проверка оформления · M0.5</span>
      </header>
      <main className="specimen-paper" style={toCssVars(theme) as CSSProperties} lang="ru">
        <div className="specimen-content">
          <section className="specimen-hero" aria-labelledby="specimen-title">
            <Reveal><p data-level="caps" className="specimen-eyebrow">{typograph("Приглашение · 24 октября 2026")}</p></Reveal>
            <Reveal delay={90}>
              <h1 data-level="display" id="specimen-title">Джафар<br /><span className="specimen-amp">&amp;</span> Ситора</h1>
            </Reveal>
            <Reveal delay={180}><p data-level="body" className="specimen-intro">{typograph("Один день, который мы разделим с самыми близкими.")}</p></Reveal>
          </section>
          <section className="specimen-block" aria-labelledby="specimen-greeting">
            <Reveal>
              <p data-level="caps" className="specimen-eyebrow">Слова и пространство</p>
              <h2 data-level="display-sm" id="specimen-greeting">Дорогие родные<br />{typograph("и друзья")}</h2>
              <p data-level="lead">{typograph("Мы будем счастливы, если этот вечер останется и в вашей памяти.")}</p>
              <p data-level="body">{typograph('Ждём вас 24 октября в 17:00. Пусть у этого дня будет простое имя — «любовь». Здесь важны голос, паузы и место для каждого слова.')}</p>
            </Reveal>
            <Reveal>
              <div className="specimen-language" lang="uz-Latn">
                <p data-level="caps">Oila va doʻstlar</p>
                <p data-level="body">{typograph("O'zbekiston. To'y marosimimizda sizni ko'rishdan xursand bo'lamiz. G'ayrat va mehr bilan.", "uz-latn")}</p>
              </div>
            </Reveal>
          </section>
          <footer className="specimen-footer">
            <p data-level="small">{typeSet.name} · {typeSet.measure} знаков в строке · бумага</p>
            <p data-level="small">Образец типографики, материала и появления текста.</p>
          </footer>
        </div>
      </main>
    </>
  );
}
