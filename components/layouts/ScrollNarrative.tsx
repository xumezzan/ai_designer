import type { CSSProperties, ReactNode } from "react";
import type { Content } from "@/lib/schema/content";
import type { Theme } from "@/lib/schema/theme";
import { toCssVars } from "@/lib/theme/toCssVars";
import { labels, langFor } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { getMotion } from "@/registry/motion";
import type { SectionId } from "@/registry/keys";
import { FontPreloads } from "@/components/craft/FontPreloads";
import { Reveal } from "@/components/craft/Reveal";
import { Surface } from "@/components/primitives/Surface";
import { FoilText } from "@/components/primitives/FoilText";
import { Ornament } from "@/components/primitives/Ornament";
import { Artwork } from "@/components/primitives/Artwork";
import { DirectedImage } from "@/components/primitives/DirectedImage";
import { compositionPhotos } from "@/lib/assets/layout";
import type { DirectedAsset } from "@/lib/assets/crop";
import { Hero } from "@/components/sections/Hero";
import { Greeting } from "@/components/sections/Greeting";
import { Countdown } from "@/components/sections/Countdown";
import { Timeline } from "@/components/sections/Timeline";
import { Venue } from "@/components/sections/Venue";
import { DressCode } from "@/components/sections/DressCode";
import { Rsvp } from "@/components/sections/Rsvp";
import { Footer } from "@/components/sections/Footer";

export function ScrollNarrative({ content, theme, initialNow, photos = [] }: { content: Content; theme: Theme; initialNow: number; photos?: DirectedAsset[] }) {
  const t = (text: string) => typograph(text, content.locale);
  const entrance = getMotion(theme.motion.preset)?.entrance;
  const names = content.headline ? t(content.headline) : content.hosts.map((host, index) =>
    <span key={index}>{index > 0 && <span className="hero-join"> &amp; </span>}<span className="hero-host">{t(host.name)}</span></span>);
  const title = <FoilText enabled={theme.foil.enabled}>{names}</FoilText>;
  const titleWrapper = (node: ReactNode) => entrance ? <Reveal className="hero-entrance">{node}</Reveal> : node;
  const available: Record<SectionId, boolean> = {
    hero: true, greeting: Boolean(content.greeting), countdown: content.date.showCountdown,
    timeline: content.timeline.length > 0, venue: true, dressCode: Boolean(content.dressCode),
    rsvp: Boolean(content.rsvp?.enabled), footer: true,
  };
  const directed = compositionPhotos(photos, theme);
  const at = (id: SectionId, position?: "before" | "after") => directed.filter((entry) => entry.photo.asset.placement?.section === id && (!position || entry.position === position));
  const photoSet = (id: SectionId, position: "before" | "after") => at(id, position).length > 0 ? <div className="directed-set" data-photo-section={id} data-arrangement={theme.layout.photoArrangement} data-position={position}>{at(id, position).map(({ photo }) => <DirectedImage key={photo.asset.id} photo={photo} locale={content.locale} />)}</div> : null;
  const order = theme.layout.sectionOrder.filter((id) => available[id] || at(id).length > 0);
  const next = order[1];
  const nextTarget = next ? { id: next, label: labels[content.locale][next === "hero" ? "invitation" : next] } : undefined;
  const sections: Record<SectionId, ReactNode> = {
    hero: <div className="hero-wrapper"><Artwork id={theme.artwork} placement="hero" /><Ornament theme={theme} placement="hero-frame" /><Ornament theme={theme} placement="watermark" />
      <Hero content={content} title={title} titleWrapper={titleWrapper} nextTarget={nextTarget} />
      <div className="hero-corners"><Ornament theme={theme} placement="corners" /><Ornament theme={theme} placement="corners" /></div>
    </div>,
    greeting: <Greeting content={content} />,
    countdown: <Countdown date={content.date} locale={content.locale} initialNow={initialNow} />,
    timeline: <Timeline content={content} />,
    venue: <Venue content={content} />,
    dressCode: <DressCode content={content} />,
    rsvp: <Rsvp content={content} />,
    footer: <Footer content={content} />,
  };
  return <>
    <FontPreloads typeSet={theme.typeSet} locale={content.locale} />
    <main className="invitation" data-composition={theme.layout.composition} data-hero={theme.layout.hero} data-artwork={theme.artwork}
      data-motion={theme.motion.preset} style={toCssVars(theme) as CSSProperties} lang={langFor(content.locale)}>
      <Surface><div className="narrative-content">
        {order.map((id, index) => <div className={`narrative-slot slot-${id}`} id={available[id] ? undefined : id} key={id}>
          {index === 2 && <><Ornament theme={theme} placement="divider" /><Artwork id={theme.artwork} placement="flourish" /></>}
          {photoSet(id, "before")}
          {sections[id]}
          {photoSet(id, "after")}
        </div>)}
      </div></Surface>
    </main>
  </>;
}
