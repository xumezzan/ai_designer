import type { SectionProps } from "./types";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { httpTarget } from "@/lib/invitation/links";

export function Venue({ content }: SectionProps) {
  const t = (text: string) => typograph(text, content.locale);
  const copy = labels[content.locale];
  const map = content.venue.mapUrl ?? (content.venue.coords ? `https://www.openstreetmap.org/?mlat=${content.venue.coords[0]}&mlon=${content.venue.coords[1]}#map=16/${content.venue.coords.join("/")}` : undefined);
  return <section id="venue" className="invitation-section venue-section" data-section="venue" aria-labelledby="venue-title">
    <div className="venue-heading"><p data-level="body">{t(copy.venue)}</p><h2 id="venue-title" data-level="display-sm">{t(content.venue.name)}</h2></div>
    <div className="venue-copy"><address data-level="lead">{t(content.venue.address)}</address>
      {content.venue.note && <p data-level="body">{t(content.venue.note)}</p>}
      {map && <a href={httpTarget(map)} className="invitation-link" data-level="body" target="_blank" rel="noopener noreferrer">{t(copy.map)} <span aria-hidden="true">↗</span></a>}
    </div>
  </section>;
}
