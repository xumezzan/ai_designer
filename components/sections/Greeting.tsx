import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { ItalicAccents } from "@/components/craft/ItalicAccents";
import { FittedHeadingText } from "@/components/primitives/FittedHeadingText";

export function Greeting({ content, guest, accentWords, heading, headingMeasure }: SectionProps & { guest?: string }) {
  if (!content.greeting) return null;
  const t = (text: string) => <ItalicAccents text={typograph(text, content.locale)} words={accentWords} locale={content.locale} />;
  return <section id="greeting" className="invitation-section greeting-section" data-section="greeting" aria-labelledby="greeting-title">
    <h2 id="greeting-title" data-level="display-sm" data-fit-display={headingMeasure !== undefined || undefined}><FittedHeadingText measure={headingMeasure}>{t(guest || heading || labels[content.locale].greeting)}</FittedHeadingText></h2>
    <div className="greeting-copy" data-studio-field="greeting">{content.greeting?.split(/\n\s*\n/).map((paragraph, index) => <p key={index} data-level={index === 0 ? "lead" : "body"}>{t(paragraph)}</p>)}</div>
  </section>;
}
