import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";

export function Greeting({ content, guest }: SectionProps & { guest?: string }) {
  if (!content.greeting) return null;
  const t = (text: string) => typograph(text, content.locale);
  return <section id="greeting" className="invitation-section greeting-section" data-section="greeting" aria-labelledby="greeting-title">
    <h2 id="greeting-title" data-level="display-sm">{t(guest || labels[content.locale].greeting)}</h2>
    <div className="greeting-copy" data-studio-field="greeting">{content.greeting?.split(/\n\s*\n/).map((paragraph, index) => <p key={index} data-level={index === 0 ? "lead" : "body"}>{t(paragraph)}</p>)}</div>
  </section>;
}
