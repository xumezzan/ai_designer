import type { CSSProperties, ReactNode } from "react";
import type { Content } from "@/lib/schema/content";
import type { Theme } from "@/lib/schema/theme";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { CompositionId, SectionId } from "@/registry/keys";
import { toCssVars } from "@/lib/theme/toCssVars";
import { compositionPhotos } from "@/lib/assets/layout";
import { eventDate } from "@/lib/invitation/date";
import { experienceLabels, langFor } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { FontPreloads } from "@/components/craft/FontPreloads";
import { InvitationExperience } from "@/components/craft/InvitationExperience";
import { Reveal } from "@/components/craft/Reveal";
import { TextReveal } from "@/components/craft/TextReveal";
import { Surface } from "@/components/primitives/Surface";
import { DirectedImage } from "@/components/primitives/DirectedImage";
import { Greeting } from "@/components/sections/Greeting";
import { StoryDate } from "@/components/sections/StoryDate";
import { Countdown } from "@/components/sections/Countdown";
import { Timeline } from "@/components/sections/Timeline";
import { Venue } from "@/components/sections/Venue";
import { DressCode } from "@/components/sections/DressCode";
import { Rsvp } from "@/components/sections/Rsvp";
import { Footer } from "@/components/sections/Footer";

export const STORY_COMPOSITIONS = ["keepsake", "vow", "editorial-story"] as const;
export function isStoryComposition(id: CompositionId) { return (STORY_COMPOSITIONS as readonly string[]).includes(id); }

/** Original photo-led wedding layouts; uploaded references are never used as event photos. */
export function WeddingStory({ content, theme, photos, initialNow, guest, embedded }: { content: Content; theme: Theme; photos: DirectedAsset[]; initialNow: number; guest?: string; embedded?: boolean }) {
  const copy = experienceLabels[content.locale];
  const date = eventDate(content);
  const t = (value: string) => typograph(value, content.locale);
  const monogram = content.hosts.map((host) => Array.from(host.name.trim())[0]).join("·");
  const directed = compositionPhotos(photos, theme);
  const at = (id: SectionId, position: "before" | "after") => directed.filter((entry) => entry.photo.asset.placement?.section === id && entry.position === position);
  const photoSet = (id: SectionId, position: "before" | "after") => at(id, position).length ? <div className="directed-set story-photo-set" data-photo-section={id} data-arrangement={theme.layout.photoArrangement} data-position={position}>{at(id, position).map(({ photo }, index) => <div className="story-photo-mount" key={photo.asset.id}><DirectedImage photo={photo} locale={content.locale} eager={id === "greeting" && index === 0} /><span className="story-photo-caption" data-level="small">{t(content.hosts.map((host) => host.name).join(" & "))} <span aria-hidden="true">♡</span></span></div>)}</div> : null;
  const available: Record<SectionId, boolean> = { hero: true, greeting: Boolean(content.greeting), countdown: content.date.showCountdown, timeline: content.timeline.length > 0, venue: true, dressCode: Boolean(content.dressCode), rsvp: Boolean(content.rsvp?.enabled), footer: true };
  const reveal = (node: ReactNode) => theme.motion.preset === "still" ? node : <Reveal className="section-reveal">{node}</Reveal>;
  const title = <h1 id="hero-title" data-level="display">{content.headline ? t(content.headline) : content.hosts.map((host, i) => <span className="story-host-line" key={i}>{i > 0 && <span className="story-join">&amp;</span>}<span className="story-host">{t(host.name)}</span></span>)}</h1>;
  const sections: Record<SectionId, ReactNode> = {
    hero: <section className="story-hero invitation-hero" id="hero" data-section="hero" aria-labelledby="hero-title">
      <div className="story-hero-top"><p className="story-kicker" data-level="small">{t(copy[content.eventType])}</p><span data-level="small">{date.year}</span></div>
      <div className="story-title">{theme.motion.preset === "still" ? title : <TextReveal>{title}</TextReveal>}</div>
      <div className="story-hero-bottom"><time dateTime={content.date.start} data-level="body">{date.full}</time><a className="hero-next" href="#story-date" aria-label={copy.calendar}><span data-level="small">{copy.scroll}</span><span aria-hidden="true">↓</span></a></div>
    </section>,
    greeting: <Greeting content={content} guest={guest} />,
    countdown: <Countdown date={content.date} locale={content.locale} initialNow={initialNow} />,
    timeline: <Timeline content={content} />,
    venue: <Venue content={content} />,
    dressCode: <DressCode content={content} />,
    rsvp: <Rsvp content={content} guest={guest} />,
    footer: <Footer content={content} />,
  };
  const slot = (id: SectionId) => <div className={`narrative-slot slot-${id}`} key={id} id={available[id] ? undefined : id} data-has-photo={at(id, "before").length + at(id, "after").length ? "true" : undefined}>
    {photoSet(id, "before")}{available[id] && (id === "hero" ? sections[id] : reveal(sections[id]))}{photoSet(id, "after")}
  </div>;
  const rest = theme.layout.sectionOrder.filter((id) => id !== "hero" && id !== "greeting" && (available[id] || at(id, "before").length || at(id, "after").length));
  const hasIntro = available.greeting || at("greeting", "before").length || at("greeting", "after").length;
  return <><FontPreloads typeSet={theme.typeSet} locale={content.locale} /><main className="invitation wedding-story" data-composition={theme.layout.composition} data-hero={theme.layout.hero} data-crafted="story" data-motion={theme.motion.preset} lang={langFor(content.locale)} style={toCssVars(theme) as CSSProperties}>
    <InvitationExperience names={content.hosts.map((host) => host.name).join(" & ")} monogram={monogram} date={date.full} guest={guest} locale={content.locale} motion={theme.motion.preset} embedded={embedded}>
      <Surface surface={theme.surface}><div className="narrative-content story-content">
        <div className="story-prologue" data-has-intro={hasIntro || undefined}>{slot("hero")}{hasIntro && slot("greeting")}<div className="story-prologue-mark" aria-hidden="true">{monogram}</div></div>
        {reveal(<StoryDate content={content} />)}
        {rest.map(slot)}
      </div></Surface>
    </InvitationExperience>
  </main></>;
}
