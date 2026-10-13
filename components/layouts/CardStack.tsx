import { invitationSectionOrder, populatedSections } from "@/lib/invitation/sections";
import type { CSSProperties } from "react";
import type { Content } from "@/lib/schema/content";
import type { Theme } from "@/lib/schema/theme";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { VisualSource } from "@/components/primitives/GeneratedVisual";
import { GeneratedVisual } from "@/components/primitives/GeneratedVisual";
import { DirectedImage } from "@/components/primitives/DirectedImage";
import { Ornament } from "@/components/primitives/Ornament";
import { FoilText } from "@/components/primitives/FoilText";
import { FontPreloads } from "@/components/craft/FontPreloads";
import { InvitationExperience } from "@/components/craft/InvitationExperience";
import { MaterialPanel, MaterialAtmosphere, type MaterialScene } from "@/components/craft/MaterialPanel";
import { PhotoDeck } from "@/components/craft/PhotoDeck";
import { Greeting } from "@/components/sections/Greeting";
import { Countdown } from "@/components/sections/Countdown";
import { Timeline } from "@/components/sections/Timeline";
import { Venue } from "@/components/sections/Venue";
import { DressCode } from "@/components/sections/DressCode";
import { Wishes } from "@/components/sections/Wishes";
import { Rsvp } from "@/components/sections/Rsvp";
import { Footer } from "@/components/sections/Footer";
import { Calendar } from "@/components/sections/Calendar";
import { eventDate } from "@/lib/invitation/date";
import { experienceLabels, langFor } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { compositionPhotos } from "@/lib/assets/layout";
import { toCssVars } from "@/lib/theme/toCssVars";
import type { SectionId } from "@/registry/keys";

export function CardStack({ content, theme, initialNow, photos = [], generatedVisual, guest, embedded = false }: { content: Content; theme: Theme; initialNow: number; photos?: DirectedAsset[]; generatedVisual?: VisualSource; guest?: string; embedded?: boolean }) {
  const scene = theme.layout.composition as MaterialScene;
  const t = (text: string) => typograph(text, content.locale);
  const date = eventDate(content), copy = experienceLabels[content.locale];
  const monogram = content.hosts.map((host) => Array.from(host.name.trim())[0]).join("·");
  const directed = compositionPhotos(photos, theme);
  const at = (id: SectionId, position: "before" | "after") => directed.filter((entry) => entry.photo.asset.placement?.section === id && entry.position === position);
  const photoSet = (id: SectionId, position: "before" | "after") => { const entries = at(id, position); return entries.length ? <div className="material-photos" data-photo-section={id} data-position={position}><PhotoDeck locale={content.locale} still={theme.motion.preset === "still"} items={entries.map(({ photo }, i) => <DirectedImage key={photo.asset.id} photo={photo} locale={content.locale} eager={id === "hero" && i === 0} />)} /></div> : null; };
  const available: Record<SectionId, boolean> = { hero: true, greeting: Boolean(content.greeting), countdown: populatedSections(content).includes("countdown"), timeline: content.timeline.length > 0, venue: populatedSections(content).includes("venue"), dressCode: Boolean(content.dressCode), wishes: Boolean(content.wishes?.trim()), rsvp: Boolean(content.rsvp?.enabled), footer: true };
  const sections = {
    hero: <section id="hero" className="material-hero" data-section="hero" aria-labelledby="hero-title">
      <div className="material-hero-top"><p data-level="small">{t(copy[content.eventType])}</p><span data-level="small">{date.year}</span></div>
      <div className="material-envelope" aria-hidden="true"><i className="envelope-insert" /><i className="envelope-pocket" /><span className="material-seal">{monogram}</span></div>
      <div className="material-identity"><span className="material-monogram" aria-hidden="true">{monogram}</span><h1 id="hero-title" data-level="display"><FoilText enabled={theme.foil.enabled} finishing={theme.finishing.type}>{content.headline ? <span data-studio-field="headline">{t(content.headline)}</span> : content.hosts.map((host, i) => <span className="material-host" key={i}>{i > 0 && <span className="material-join">&amp;</span>}<span data-studio-field={`hosts.${i}.name`}>{t(host.name)}</span></span>)}</FoilText></h1></div>
      {guest && <p className="material-personal" data-level="body">{t(`${guest}, ${copy.waiting.toLocaleLowerCase()}`)}</p>}
      {(content.date.start || content.date.day) && <time data-studio-section="date" className="material-date" dateTime={content.date.start || content.date.day}><strong>{date.day}</strong><span>{t(`${date.month} ${date.year}`)}<small>{t(`${date.weekday}${date.time ? ` · ${date.time}` : ""}`)}</small></span></time>}
      <p data-studio-field="venue.name" className="material-venue" data-level="body">{t(content.venue.name)}</p>
      <Calendar content={content} />
    </section>,
    greeting: <Greeting content={content} guest={guest} />, venue: <Venue content={content} />,
    countdown: <Countdown date={content.date} locale={content.locale} initialNow={initialNow} />,
    timeline: <Timeline content={content} />, dressCode: <DressCode content={content} />, wishes: <Wishes content={content} />, rsvp: <Rsvp content={content} guest={guest} />, footer: <Footer content={content} />,
  };
  return <><FontPreloads typeSet={theme.typeSet} locale={content.locale} /><main className="invitation card-stack" data-layout="card-stack" data-composition={scene} data-motion={theme.motion.preset} data-texture={theme.surface.texture} data-scene-visual={generatedVisual ? theme.layout.visualPlacement : undefined} lang={langFor(content.locale)} style={toCssVars(theme) as CSSProperties}>
    <div className="material-backdrop" aria-hidden="true" />
    <InvitationExperience names={content.hosts.map((host) => host.name).join(" & ")} monogram={monogram} date={date.full} guest={guest} locale={content.locale} motion={theme.motion.preset} embedded={embedded}>
      <MaterialAtmosphere ambient={theme.motion.ambient} motion={theme.motion.preset} />
      <div className="material-content">{invitationSectionOrder(content, theme.layout.sectionOrder, directed.flatMap(({ photo }) => photo.asset.placement ? [photo.asset.placement.section] : [])).filter((id) => available[id] || at(id, "before").length || at(id, "after").length).map((id, index) => <div key={id} className={`material-slot material-slot-${id}`} data-index={index}>
        {photoSet(id, "before")}
        {id === "footer" ? sections[id] : available[id] && <MaterialPanel scene={scene} motion={theme.motion.preset} hero={id === "hero"}>{id === "hero" && <><Ornament theme={theme} placement="watermark" /><Ornament theme={theme} placement="hero-frame" />{generatedVisual && <GeneratedVisual source={generatedVisual} palette={theme.palette} isolated={theme.generatedVisual?.isolated} />}</>}{sections[id]}</MaterialPanel>}
        {photoSet(id, "after")}
      </div>)}</div>
    </InvitationExperience>
  </main></>;
}
