import type { SectionProps } from "./types";
import { labels, experienceLabels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { ItalicAccents } from "@/components/craft/ItalicAccents";

export function Footer({ content, accentWords }: SectionProps) {
  const t = (text: string) => <ItalicAccents text={typograph(text, content.locale)} words={accentWords} locale={content.locale} />;
  return <footer id="footer" className="invitation-footer" data-section="footer">
    <p data-studio-field={content.closing ? "closing" : undefined} data-level="display-sm">{t(content.closing || labels[content.locale].footer)}</p><p data-level="body">{t(content.hosts.map((host) => host.name).join(" & "))}</p>
    <a href="#hero" className="footer-top" aria-label={experienceLabels[content.locale][content.eventType]}>↑</a>
  </footer>;
}
