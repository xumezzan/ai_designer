import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { DressPalette } from "./DressPalette";

export function DressCode({ content }: SectionProps) {
  const dress = content.dressCode;
  if (!dress) return null;
  const t = (text: string) => typograph(text, content.locale);
  return <section id="dressCode" className="invitation-section dress-section" data-section="dressCode" aria-labelledby="dress-title">
    <h2 id="dress-title" data-level="display-sm">{t(dress.title || labels[content.locale].dressCode)}</h2>
    {dress.note && <p data-level="body">{t(dress.note)}</p>}
    {dress.swatches.length > 0 && <DressPalette swatches={dress.swatches} locale={content.locale} />}
  </section>;
}
