import Image from "next/image";
import type { CSSProperties } from "react";
import type { Content } from "@/lib/schema/content";
import type { Theme } from "@/lib/schema/theme";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { VisualSource } from "@/components/primitives/GeneratedVisual";
import { toCssVars } from "@/lib/theme/toCssVars";
import { eventDate } from "@/lib/invitation/date";
import { invitationSectionOrder, populatedSections } from "@/lib/invitation/sections";
import { compositionPhotos } from "@/lib/assets/layout";
import { experienceLabels, langFor } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { FontPreloads } from "@/components/craft/FontPreloads";
import { InvitationExperience } from "@/components/craft/InvitationExperience";
import { Reveal } from "@/components/craft/Reveal";
import { DirectedImage } from "@/components/primitives/DirectedImage";
import { Greeting } from "@/components/sections/Greeting";
import { Countdown } from "@/components/sections/Countdown";
import { Timeline } from "@/components/sections/Timeline";
import { Venue } from "@/components/sections/Venue";
import { DressCode } from "@/components/sections/DressCode";
import { Wishes } from "@/components/sections/Wishes";
import { Rsvp } from "@/components/sections/Rsvp";
import { Footer } from "@/components/sections/Footer";
import { Calendar } from "@/components/sections/Calendar";
import type { SectionId } from "@/registry/keys";

/** One original portrait artwork sets the cover world; live text and quiet
 * information spreads remain separate and editable. Never rasterise the copy. */
export function ImmersiveInvitation({ content, theme, photos = [], generatedVisual, initialNow, guest, embedded = false }: {
  content: Content; theme: Theme; photos?: DirectedAsset[]; generatedVisual?: VisualSource; initialNow: number; guest?: string; embedded?: boolean;
}) {
  const t = (value: string) => typograph(value, content.locale);
  const date = eventDate(content);
  const copy = experienceLabels[content.locale];
  const hasNames = content.hosts.some((host) => host.name.trim() && !/^Имя \d+$/.test(host.name));
  const monogram = content.hosts.map((host) => host.name.trim()[0]).filter(Boolean).join(" · ");
  const directed = compositionPhotos(photos, theme);
  const at = (id: SectionId) => directed.filter(({ photo }) => photo.asset.placement?.section === id);
  const available = populatedSections(content);
  const order = invitationSectionOrder(content, theme.layout.sectionOrder, directed.flatMap(({ photo }) => photo.asset.placement ? [photo.asset.placement.section] : [])).filter((id) => id !== "hero" && (available.includes(id) || at(id).length));
  const next = order.find((id) => id !== "footer") ?? "footer";
  const sections = {
    hero: null,
    greeting: <Greeting content={content} guest={guest} />,
    countdown: <Countdown date={content.date} locale={content.locale} initialNow={initialNow} />,
    timeline: <Timeline content={content} />,
    venue: <Venue content={content} />,
    dressCode: <DressCode content={content} />, wishes: <Wishes content={content} />,
    rsvp: <Rsvp content={content} guest={guest} />,
    footer: <Footer content={content} />,
  };
  return <><FontPreloads typeSet={theme.typeSet} locale={content.locale} /><main className="invitation immersive-invitation" data-composition="immersive" data-motion={theme.motion.preset} lang={langFor(content.locale)} style={toCssVars(theme) as CSSProperties}>
    <InvitationExperience names={content.hosts.map((host) => host.name).join(" & ")} monogram={monogram} date={date.full} guest={guest} locale={content.locale} motion={theme.motion.preset} embedded={embedded}>
      <section className="immersive-cover" id="hero" data-section="hero" aria-labelledby="hero-title">
        {generatedVisual && <div className="immersive-cover-art" aria-hidden="true"><Image src={generatedVisual.src} alt="" width={generatedVisual.width} height={generatedVisual.height} unoptimized priority /></div>}
        <div className="immersive-cover-copy">
          <p className="immersive-kicker" data-studio-field={content.headline ? "headline" : undefined} data-level="small">{t(content.headline || copy[content.eventType])}</p>
          <div className="immersive-title-block">{!content.headline && <span className="immersive-name-label" data-level="small">{monogram}</span>}
            <h1 id="hero-title" data-level="display">{!hasNames && content.headline ? <span data-studio-field="headline">{t(content.headline)}</span> : content.hosts.map((host, index) => <span className="immersive-host" key={index}>{index > 0 && <span className="immersive-join">&amp;</span>}<span data-studio-field={`hosts.${index}.name`}>{t(host.name)}</span></span>)}</h1>
          </div>
          {(content.date.start || content.date.day) && <time className="immersive-date" data-studio-section="date" dateTime={content.date.start || content.date.day}><span>{date.day}</span><i aria-hidden="true" /> <span>{content.date.start ? new Intl.DateTimeFormat("en", { timeZone: content.date.timezone, month: "2-digit" }).format(new Date(content.date.start)) : content.date.day?.slice(5, 7)}</span><i aria-hidden="true" /><span>{date.year}</span></time>}
          <div className="immersive-cover-venue"><p data-studio-field="venue.name">{t(content.venue.name)}</p>{date.time && <span>{date.time}</span>}</div>
          <a className="immersive-open" href={`#${next}`} aria-label={copy.scroll}><span>{t(copy.scroll)}</span><span aria-hidden="true">↓</span></a>
        </div>
      </section>
      <div className="immersive-story">{order.map((id, index) => <div className={`immersive-spread immersive-spread-${id}`} key={id} data-index={index}>
        {id === "dressCode" && <div className="immersive-divider" aria-hidden="true"><span /><svg viewBox="0 0 48 28" fill="none"><path d="M24 2 46 14 24 26 2 14 24 2ZM24 7 36 14 24 21 12 14 24 7Z" stroke="currentColor" strokeWidth=".7" /></svg><span /></div>}
        {at(id).filter((entry) => entry.position === "before").map(({ photo }) => <DirectedImage key={photo.asset.id} photo={photo} locale={content.locale} />)}
        {theme.motion.preset === "still" || id === "footer" ? sections[id] : <Reveal className="section-reveal">{sections[id]}</Reveal>}
        {id === "venue" && <Calendar content={content} />}
        {at(id).filter((entry) => entry.position === "after").map(({ photo }) => <DirectedImage key={photo.asset.id} photo={photo} locale={content.locale} />)}
      </div>)}</div>
    </InvitationExperience>
  </main></>;
}
