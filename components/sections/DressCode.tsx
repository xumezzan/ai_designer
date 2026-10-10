import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";

export function DressCode({ content }: SectionProps) {
  const dress = content.dressCode;
  if (!dress) return null;
  const t = (text: string) => typograph(text, content.locale);
  return <section id="dressCode" className="invitation-section dress-section" data-section="dressCode" aria-labelledby="dress-title">
    <h2 id="dress-title" data-level="display-sm">{t(dress.title || labels[content.locale].dressCode)}</h2>
    {dress.note && <p data-level="body">{t(dress.note)}</p>}
    {dress.swatches.length > 0 && <ul className="dress-swatches">{dress.swatches.map((hex, index) => <li key={index}>
      <span className="dress-swatch" style={{ backgroundColor: hex }} aria-hidden="true" /><span data-level="small">{hex}</span>
    </li>)}</ul>}
  </section>;
}
