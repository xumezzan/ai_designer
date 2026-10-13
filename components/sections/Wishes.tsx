import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";

export function Wishes({ content }: SectionProps) {
  if (!content.wishes?.trim()) return null;
  const t = (value: string) => typograph(value, content.locale);
  return <section id="wishes" className="invitation-section wishes-section" data-section="wishes" aria-labelledby="wishes-title">
    <h2 id="wishes-title" data-level="display-sm">{labels[content.locale].wishes}</h2>
    <div className="wishes-copy" data-studio-field="wishes">{content.wishes.split(/\n\s*\n/).map((paragraph, i) => <p data-level="body" key={i}>{t(paragraph)}</p>)}</div>
  </section>;
}
