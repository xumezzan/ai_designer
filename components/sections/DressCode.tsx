import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { DressPalette } from "./DressPalette";
import { ItalicAccents } from "@/components/craft/ItalicAccents";
import { FittedHeadingText } from "@/components/primitives/FittedHeadingText";

export function DressCode({ content, accentWords, headingMeasure }: SectionProps) {
  const dress = content.dressCode;
  if (!dress) return null;
  const t = (text: string) => <ItalicAccents text={typograph(text, content.locale)} words={accentWords} locale={content.locale} />;
  return <section id="dressCode" className="invitation-section dress-section" data-section="dressCode" aria-labelledby="dress-title">
    <h2 id="dress-title" data-studio-field="dressCode.title" data-level="display-sm" data-fit-display={headingMeasure !== undefined || undefined}><FittedHeadingText measure={headingMeasure}>{t(dress.title || labels[content.locale].dressCode)}</FittedHeadingText></h2>
    {dress.note && <p data-studio-field="dressCode.note" data-level="body">{t(dress.note)}</p>}
    {dress.swatches.length > 0 && <DressPalette swatches={dress.swatches} locale={content.locale} />}
  </section>;
}
