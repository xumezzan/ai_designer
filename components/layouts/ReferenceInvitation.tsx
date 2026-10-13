import type { CSSProperties, ReactNode } from "react";
import type { Content } from "@/lib/schema/content";
import type { Theme } from "@/lib/schema/theme";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { SectionId } from "@/registry/keys";
import { toCssVars } from "@/lib/theme/toCssVars";
import { eventDate } from "@/lib/invitation/date";
import { invitationSectionOrder, populatedSections } from "@/lib/invitation/sections";
import { compositionPhotos } from "@/lib/assets/layout";
import { portraitTextZone } from "@/lib/invitation/reference";
import { experienceLabels, labels, langFor } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { FontPreloads } from "@/components/craft/FontPreloads";
import { InvitationExperience } from "@/components/craft/InvitationExperience";
import { DecoFan, StorySprig } from "@/components/craft/DecoGeometry";
import { SceneAtmosphere } from "@/components/craft/SceneAtmosphere";
import { PortraitTextGuard } from "@/components/craft/PortraitTextGuard";
import { Reveal } from "@/components/craft/Reveal";
import { DirectedImage } from "@/components/primitives/DirectedImage";
import { Greeting } from "@/components/sections/Greeting";
import { Countdown } from "@/components/sections/Countdown";
import { Timeline } from "@/components/sections/Timeline";
import { Venue } from "@/components/sections/Venue";
import { DressCode } from "@/components/sections/DressCode";
import { Wishes } from "@/components/sections/Wishes";
import { Rsvp } from "@/components/sections/Rsvp";
import { Calendar } from "@/components/sections/Calendar";
import { StoryDate } from "@/components/sections/StoryDate";

/** Complete authored experiences learned from the owner's Gatsby and wedding
 * projects. Event facts remain data; visual hierarchy is native HTML/CSS/SVG. */
export function ReferenceInvitation({ content, theme, photos = [], initialNow, guest, embedded = false }: {
  content: Content; theme: Theme; photos?: DirectedAsset[]; initialNow: number; guest?: string; embedded?: boolean;
}) {
  const cinematic = theme.layout.composition === "cinematic";
  const t = (value: string) => typograph(value, content.locale);
  const copy = experienceLabels[content.locale];
  const date = eventDate(content);
  const hasDate = Boolean(content.date.start || content.date.day);
  const directed = compositionPhotos(photos, theme);
  const at = (id: SectionId) => directed.filter(({ photo }) => photo.asset.placement?.section === id);
  const heroPhoto = at("hero")[0]?.photo;
  const zone = heroPhoto && !cinematic && !content.headline && content.hosts.length <= 2 && content.hosts.every((host) => host.name.length <= 16) ? portraitTextZone(heroPhoto) : "outside";
  const freeSpace = heroPhoto ? zone === "top" ? (heroPhoto.asset.safeArea.y - heroPhoto.crop.y) / heroPhoto.crop.h : 1 - (heroPhoto.asset.safeArea.y + heroPhoto.asset.safeArea.h - heroPhoto.crop.y) / heroPhoto.crop.h : 0;
  const available = populatedSections(content);
  const order = invitationSectionOrder(content, theme.layout.sectionOrder, directed.flatMap(({ photo }) => photo.asset.placement ? [photo.asset.placement.section] : []))
    .filter((id) => id !== "hero" && id !== "footer" && (available.includes(id) || at(id).length));
  const next = order[0] || "footer";
  const monogram = content.hosts.map((host) => host.name.trim()[0]).filter(Boolean).join(" · ");
  const names = content.hosts.map((host, i) => <span className="reference-host-line" key={i}>{i > 0 && <span className="reference-join">&amp;</span>}<span data-studio-field={`hosts.${i}.name`}>{t(host.name)}</span></span>);
  const sections: Record<SectionId, ReactNode> = {
    hero: null, footer: null,
    greeting: <Greeting content={content} guest={guest} />,
    countdown: <Countdown date={content.date} locale={content.locale} initialNow={initialNow} />,
    timeline: <Timeline content={content} />,
    venue: <Venue content={content} />,
    dressCode: <DressCode content={content} />, wishes: <Wishes content={content} />,
    rsvp: <Rsvp content={content} guest={guest} />,
  };
  const photoSet = (id: SectionId, position: "before" | "after") => {
    const entries = at(id).filter((entry) => entry.position === position);
    return entries.length ? <div className="reference-photo-set" data-photo-section={id} data-position={position} data-arrangement={theme.layout.photoArrangement}>{entries.map(({ photo }, i) => <div className="reference-photo-mount" key={photo.asset.id} data-subject={photo.asset.subject}><DirectedImage photo={photo} locale={content.locale} eager={id === "hero" && i === 0} /></div>)}</div> : null;
  };
  const reveal = (node: ReactNode) => theme.motion.preset === "still" ? node : <Reveal className="section-reveal">{node}</Reveal>;
  return <>
    <FontPreloads typeSet={theme.typeSet} locale={content.locale} />
    {cinematic && <link rel="preload" href="/reference-fonts/italiana-400.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />}
    <main className={`invitation reference-invitation ${cinematic ? "cinematic-invitation" : "portrait-invitation"}`} data-composition={theme.layout.composition} data-motion={theme.motion.preset} lang={langFor(content.locale)} style={toCssVars(theme) as CSSProperties}>
      <InvitationExperience names={content.hosts.map((host) => host.name).join(" & ")} monogram={monogram} date={date.full} guest={guest} locale={content.locale} motion={theme.motion.preset} embedded={embedded} coverDesign={cinematic ? "deco" : undefined} coverHeadline={content.headline || copy[content.eventType]}>
        <section className="reference-hero" id="hero" data-section="hero" data-text-zone="outside" data-has-photo={heroPhoto ? "true" : undefined} aria-labelledby="hero-title">
          {heroPhoto && !cinematic && <PortraitTextGuard preferred={zone} freeSpace={freeSpace} />}
          {heroPhoto && <div className="reference-hero-photo"><DirectedImage photo={heroPhoto} locale={content.locale} eager /></div>}
          {cinematic && <SceneAtmosphere mode="bokeh" enabled={theme.motion.preset !== "still"} />}
          <div className="reference-hero-copy">
            {!cinematic && <p className="reference-eyebrow">{t(copy[content.eventType])}</p>}
            <h1 id="hero-title">{names}</h1>
            {content.headline && <p className="reference-headline" data-studio-field="headline">{t(content.headline)}</p>}
            {cinematic ? <>
              {hasDate && <time className="cinematic-date" dateTime={content.date.start || content.date.day} data-studio-section="date"><span className="cinematic-day">{date.day}</span><span className="cinematic-month">{date.month}</span><span className="cinematic-year">{date.year}</span></time>}
              {date.time && <div className="cinematic-time"><span className="reference-eyebrow">{copy.details}</span><span>{date.time}</span></div>}
            </> : <>{hasDate && <time className="portrait-date" dateTime={content.date.start || content.date.day} data-studio-section="date">{date.full}</time>}<StorySprig /></>}
            <a href={`#${next}`} className="reference-scroll hero-next"><span>{copy.scroll}</span><span aria-hidden="true">↓</span></a>
          </div>
        </section>
        {!cinematic && hasDate && !order.includes("greeting") && reveal(<StoryDate content={content} />)}
        <div className="reference-story">{order.map((id) => <div className={`reference-spread reference-spread-${id}`} key={id} id={available.includes(id) ? undefined : id}>
          {(id === "dressCode" || id === "greeting" || id === "wishes") && <div className="reference-section-mark" aria-hidden="true">{cinematic ? <DecoFan /> : <StorySprig />}</div>}
          {photoSet(id, "before")}
          {available.includes(id) && reveal(sections[id])}
          {photoSet(id, "after")}
          {id === "venue" && <Calendar content={content} />}
          {id === "greeting" && !cinematic && hasDate && reveal(<StoryDate content={content} />)}
        </div>)}</div>
        <footer className="reference-finale" id="footer" data-section="footer">
          {cinematic && <SceneAtmosphere enabled={theme.motion.preset !== "still"} />}
          {photoSet("footer", "before")}
          {photoSet("footer", "after")}
          <div className="reference-finale-copy">
            {cinematic ? <DecoFan /> : <StorySprig />}
            <p className="reference-closing" data-studio-field={content.closing ? "closing" : undefined}>{t(content.closing || labels[content.locale].footer)}</p>
            {hasDate && <time dateTime={content.date.start || content.date.day}>{date.full}</time>}
            <p className="reference-signature">{t(content.hosts.map((host) => host.name).join(" & "))}</p>
            <a className="footer-top" href="#hero" aria-label={copy.back}>↑</a>
          </div>
        </footer>
      </InvitationExperience>
    </main>
  </>;
}
