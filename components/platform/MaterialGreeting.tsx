import type { Content } from "@/lib/schema/content";
import { typograph } from "@/lib/typography/ru";

/** A personal letter has one editable source, with paragraphs given room to
 * breathe. Its layout does not inherit the event invitation's two-column grid. */
export function MaterialGreeting({ content, heading }: { content: Content; heading: string }) {
  const paragraphs = content.greeting?.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()) || [];
  const salutation = paragraphs.length > 1 && paragraphs[0].trim().length <= 90;
  return <section id="greeting" className="material-greeting" data-section="greeting" aria-labelledby="greeting-title">
    <header className="material-greeting-heading"><span aria-hidden="true" /><h2 id="greeting-title">{typograph(heading, content.locale)}</h2></header>
    <div className="material-greeting-prose" data-studio-field="greeting">
      {paragraphs.map((paragraph, index) => {
        const part = salutation && index === 0 ? "salutation"
          : index === (salutation ? 1 : 0) ? "opening"
          : paragraphs.length > 3 && index === paragraphs.length - 1 ? "afterword" : "wishes";
        return <p className={`material-greeting-${part}`} data-greeting-part={part} key={index}>{typograph(paragraph, content.locale)}</p>;
      })}
    </div>
  </section>;
}
