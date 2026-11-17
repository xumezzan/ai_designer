import type { CSSProperties, ReactNode } from "react";
import type { Content } from "@/lib/schema/content";
import type { Theme } from "@/lib/schema/theme";
import type { DesignSpec } from "@/lib/schema/designSpec";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { SectionId } from "@/registry/keys";
import type { VisualSource } from "@/components/primitives/GeneratedVisual";
import { compositionPhotos } from "@/lib/assets/layout";
import { designSpecToCssVars } from "@/lib/design/spec";
import { toCssVars } from "@/lib/theme/toCssVars";
import { eventDate } from "@/lib/invitation/date";
import { invitationSectionOrder, populatedSections } from "@/lib/invitation/sections";
import { experienceLabels, labels, langFor } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { InvitationExperience } from "@/components/craft/InvitationExperience";
import { ItalicAccents } from "@/components/craft/ItalicAccents";
import { Reveal } from "@/components/craft/Reveal";
import { WaxSeal } from "@/components/craft/WaxSeal";
import { EditorialMedia, EditorialBotanical } from "@/components/craft/EditorialMedia";
import { Greeting } from "@/components/sections/Greeting";
import { Countdown } from "@/components/sections/Countdown";
import { Timeline } from "@/components/sections/Timeline";
import { Venue } from "@/components/sections/Venue";
import { DressCode } from "@/components/sections/DressCode";
import { Wishes } from "@/components/sections/Wishes";
import { Rsvp } from "@/components/sections/Rsvp";
import { Footer } from "@/components/sections/Footer";
import { Calendar } from "@/components/sections/Calendar";

type EditorialTheme = Theme & { designSpec: DesignSpec };
export interface EditorialInvitationProps {
  content: Content; theme: EditorialTheme; initialNow: number; photos?: DirectedAsset[];
  generatedVisual?: VisualSource; guest?: string; embedded?: boolean;
}

/** Five authored phone-first compositions share the live invitation behaviour,
 * while their silhouettes, media and section rhythm remain independent. */
export function EditorialInvitation({ content, theme, initialNow, photos = [], generatedVisual, guest, embedded = false }: EditorialInvitationProps) {
  const spec = theme.designSpec;
  const copy = experienceLabels[content.locale];
  const date = eventDate(content);
  const hasDate = Boolean(content.date.start || content.date.day);
  const accents = spec.typography.italic_accent_words;
  const t = (value: string) => typograph(value, content.locale);
  const text = (value: string) => <ItalicAccents text={t(value)} words={accents} locale={content.locale} />;
  const monogram = content.hosts.map((host) => Array.from(host.name.trim())[0]).filter(Boolean).join("·");
  const seal = spec.composition_rules.decorations.wax_seal;
  const foil = spec.composition_rules.decorations.foil_lines;
  const directed = compositionPhotos(photos, theme);
  const at = (id: SectionId, position?: "before" | "after") => directed.filter((entry) => entry.photo.asset.placement?.section === id && (!position || position === entry.position));
  const populated = populatedSections(content);
  const order = invitationSectionOrder(content, theme.layout.sectionOrder, directed.flatMap(({ photo }) => photo.asset.placement ? [photo.asset.placement.section] : []))
    .filter((id) => populated.includes(id) || at(id).length > 0);
  const next = order.find((id) => id !== "hero") || "footer";
  const join = content.locale === "ru" ? "и" : content.locale === "uz-latn" ? "va" : "and";
  const names = <h1 id="hero-title" className="editorial-names">{content.headline ? <span data-studio-field="headline">{text(content.headline)}</span> : content.hosts.map((host, index) => <span className="editorial-name-line" key={index}>{index > 0 && <span className="editorial-name-join">{text(join)}</span>}<span data-studio-field={`hosts.${index}.name`}>{text(host.name)}</span></span>)}</h1>;
  const eyebrow = <p className="editorial-eyebrow">{text(copy[content.eventType])}</p>;
  const dateLine = hasDate ? <time className="editorial-date" dateTime={content.date.start || content.date.day} data-studio-section="date"><span className="editorial-date-day">{date.day}</span><span className="editorial-date-description"><span>{text(`${date.month} ${date.year}`)}</span><span className="editorial-meta">{text(`${date.weekday}${date.time ? ` · ${date.time}` : ""}`)}</span></span></time> : null;
  const place = <div className="editorial-hero-place">
    {guest && <p className="editorial-personal">{text(`${guest}, ${copy.waiting.toLocaleLowerCase()}`)}</p>}
    {content.venue.name.trim() && <p data-studio-field="venue.name">{text(content.venue.name)}</p>}
    {content.venue.address.trim() && <p className="editorial-meta" data-studio-field="venue.address">{text(content.venue.address)}</p>}
  </div>;
  const scroll = <a className="editorial-scroll hero-next" href={`#${next}`} aria-label={labels[content.locale][next]}><span>{copy.scroll}</span><span aria-hidden="true">↓</span></a>;
  const sealAt = (position: typeof seal.position) => seal.enabled && seal.position === position ? <WaxSeal seal={seal} monogram={monogram} /> : null;
  const photoSet = (id: SectionId, position: "before" | "after") => at(id, position).length ? <div className="editorial-photo-set" data-photo-section={id} data-position={position} data-arrangement={theme.layout.photoArrangement}>{at(id, position).map(({ photo }, i) => <EditorialMedia key={photo.asset.id} photo={photo} treatment={spec.composition_rules.photo_treatment} locale={content.locale} eager={id === "hero" && i === 0} />)}</div> : null;
  const graphic = <div className="editorial-graphic" data-graphics-placement={spec.graphics_generation.placement} data-native-graphic={!generatedVisual || undefined} aria-hidden="true"><EditorialMedia source={generatedVisual} treatment={spec.composition_rules.photo_treatment} locale={content.locale} eager><NativeArtwork archetype={spec.archetype} monogram={monogram} /></EditorialMedia></div>;
  const heroMedia = <div className="editorial-hero-art">{photoSet("hero", "before")}{graphic}{photoSet("hero", "after")}</div>;
  const heroTopSeal = sealAt("hero_top");
  const commonHero = { names, eyebrow, dateLine, place, scroll, heroMedia, heroTopSeal };
  const hero: ReactNode = spec.archetype === "ARCH_EDITORIAL" ? <div className="editorial-arch-sheet"><div className="editorial-arch-crown" aria-hidden="true"><span>{monogram}</span></div>{heroTopSeal}{eyebrow}{heroMedia}<div className="editorial-arch-copy">{names}{dateLine}{place}{scroll}</div></div>
    : spec.archetype === "RAW_ASYMMETRIC" ? <div className="editorial-raw-spread"><div className="editorial-raw-margin" aria-hidden="true">{hasDate ? `${date.day} / ${date.month} / ${date.year}` : monogram}</div>{heroTopSeal}<div className="editorial-raw-heading">{eyebrow}{names}</div>{heroMedia}<div className="editorial-raw-facts">{dateLine}{place}{scroll}</div><span className="editorial-raw-registration" aria-hidden="true">+</span></div>
      : spec.archetype === "BOTANICAL_PLATE" ? <div className="editorial-specimen-sheet"><div className="editorial-specimen-caption">{eyebrow}<span className="editorial-meta" aria-hidden="true">{hasDate ? date.year : monogram}</span></div>{heroTopSeal}{heroMedia}<div className="editorial-specimen-copy">{names}{dateLine}{place}{scroll}</div></div>
        : spec.archetype === "RETRO_MONOGRAM" ? <div className="editorial-envelope"><div className="editorial-envelope-flap" aria-hidden="true" /><div className="editorial-envelope-insert">{heroTopSeal}{eyebrow}<div className="editorial-hero-monogram" aria-hidden="true">{monogram.replace(/·/g, " ")}</div>{names}{heroMedia}{dateLine}{place}{scroll}</div><div className="editorial-envelope-pocket" aria-hidden="true" />{sealAt("envelope_flap")}</div>
          : <MinimalHero {...commonHero} monogram={monogram} hasDate={hasDate} year={date.year} />;
  const sectionProps = { content, accentWords: accents };
  const sections: Record<SectionId, ReactNode> = {
    hero: <section id="hero" className="editorial-hero" data-section="hero" aria-labelledby="hero-title"><div className="editorial-hero-layout">{hero}{foil.enabled && <div className="editorial-foil-lines" data-foil-style={foil.style} aria-hidden="true"><span /><span /></div>}</div>{spec.archetype !== "RETRO_MONOGRAM" && seal.position === "envelope_flap" && seal.enabled && <div className="editorial-bottom-seal">{sealAt("envelope_flap")}</div>}{!content.rsvp?.enabled && <div className="editorial-hero-calendar"><Calendar content={content} /></div>}</section>,
    greeting: <Greeting {...sectionProps} guest={guest} />,
    countdown: <Countdown date={content.date} locale={content.locale} initialNow={initialNow} />,
    venue: <Venue {...sectionProps} />,
    timeline: <Timeline {...sectionProps} />,
    dressCode: <DressCode {...sectionProps} />,
    wishes: <Wishes {...sectionProps} />,
    rsvp: <div className="editorial-rsvp-mount">{sealAt("rsvp_badge")}<Rsvp {...sectionProps} guest={guest} /></div>,
    footer: <Footer {...sectionProps} />,
  };
  return <main className="invitation editorial-invitation" data-design-archetype={spec.archetype} data-hero-alignment={spec.composition_rules.hero_alignment} data-card-framing={spec.composition_rules.card_framing} data-paper-texture={spec.canvas.paper_texture} data-foil-lines={foil.enabled ? foil.style : "none"} data-graphics-mode={spec.graphics_generation.placement} data-timeline-style={spec.component_manifest.timeline_style} data-dresscode-style={spec.component_manifest.dresscode_style} data-rsvp-style={spec.component_manifest.rsvp_style} data-motion={theme.motion.preset} lang={langFor(content.locale)} style={{ ...toCssVars(theme), ...designSpecToCssVars(spec) } as CSSProperties}>
    <InvitationExperience names={content.hosts.map((host) => host.name).join(" & ")} monogram={monogram} date={date.full} guest={guest} locale={content.locale} motion={theme.motion.preset} embedded={embedded} coverHeadline={content.headline || copy[content.eventType]}>
      <div className="editorial-paper-grain" aria-hidden="true" />
      <div className="editorial-story">{order.map((id) => <div className={`editorial-slot editorial-slot-${id}`} data-photo-section={at(id).length ? id : undefined} key={id} id={populated.includes(id) ? undefined : id}>
        {id !== "hero" && photoSet(id, "before")}
        {populated.includes(id) && (id === "hero" || theme.motion.preset === "still" ? sections[id] : <Reveal className="editorial-section-reveal">{sections[id]}</Reveal>)}
        {id !== "hero" && photoSet(id, "after")}
      </div>)}</div>
    </InvitationExperience>
  </main>;
}

function MinimalHero({ names, eyebrow, dateLine, place, scroll, heroMedia, heroTopSeal, monogram, hasDate, year }: { names: ReactNode; eyebrow: ReactNode; dateLine: ReactNode; place: ReactNode; scroll: ReactNode; heroMedia: ReactNode; heroTopSeal: ReactNode; monogram: string; hasDate: boolean; year: string }) {
  return <div className="editorial-type-grid"><div className="editorial-type-header">{eyebrow}<span className="editorial-meta" aria-hidden="true">{hasDate ? year : monogram}</span></div>{heroTopSeal}{names}<span className="editorial-type-rule" aria-hidden="true" /><div className="editorial-type-facts">{dateLine}{place}</div>{heroMedia}{scroll}</div>;
}

function NativeArtwork({ archetype, monogram }: { archetype: DesignSpec["archetype"]; monogram: string }) {
  if (archetype === "BOTANICAL_PLATE" || archetype === "ARCH_EDITORIAL") return <EditorialBotanical />;
  if (archetype === "RETRO_MONOGRAM") return <svg className="editorial-native-art" viewBox="0 0 300 210" fill="none" aria-hidden="true"><path d="M22 38h256v142H22V38Zm0 0 128 82L278 38M22 180l84-77m172 77-84-77" stroke="currentColor" strokeWidth=".7" /><circle cx="150" cy="120" r="23" stroke="currentColor" strokeWidth=".7" /><text x="150" y="126" textAnchor="middle" fill="currentColor" fontFamily="var(--font-display)" fontSize="20">{monogram}</text></svg>;
  if (archetype === "RAW_ASYMMETRIC") return <svg className="editorial-native-art" viewBox="0 0 280 340" fill="none" aria-hidden="true"><path d="M70 267C14 242 15 128 81 86c74-47 151 3 157 65 7 61-36 156-110 157" fill="currentColor" fillOpacity=".09" /><path d="M24 248C55 164 125 52 208 48M36 281C118 230 169 118 211 96M92 298C165 252 233 183 259 137" stroke="currentColor" strokeWidth=".8" /><circle cx="174" cy="197" r="54" stroke="currentColor" strokeWidth=".6" /><path d="M12 16v16M4 24h16m234 286v16m-8-8h16" stroke="currentColor" /></svg>;
  return <svg className="editorial-native-art" viewBox="0 0 300 110" fill="none" aria-hidden="true"><circle cx="116" cy="55" r="35" stroke="currentColor" strokeWidth=".6" /><circle cx="181" cy="55" r="35" stroke="currentColor" strokeWidth=".6" /><path d="M25 55h48m155 0h47" stroke="currentColor" strokeWidth=".6" /><circle cx="150" cy="55" r="2" fill="currentColor" /></svg>;
}
