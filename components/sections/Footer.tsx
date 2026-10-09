import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";

export function Footer({ content }: SectionProps) {
  const t = (text: string) => typograph(text, content.locale);
  return <footer id="footer" className="invitation-footer" data-section="footer">
    <p data-level="display-sm">{t(labels[content.locale].footer)}</p><p data-level="body">{t(content.hosts.map((host) => host.name).join(" & "))}</p>
    <a href="#hero" className="footer-top" aria-label={labels[content.locale].invitation}>↑</a>
  </footer>;
}
