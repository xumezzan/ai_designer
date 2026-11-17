import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { Content } from "@/lib/schema/content";
import type { Theme } from "@/lib/schema/theme";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { SectionId } from "@/registry/keys";
import { studioTemplateCssVars, studioCompositionCssVars } from "@/registry/studioTemplates";
import { compositionPhotos } from "@/lib/assets/layout";
import { toCssVars } from "@/lib/theme/toCssVars";
import { applyStudioSectionOrder, invitationSectionOrder, populatedSections } from "@/lib/invitation/sections";
import { eventDate } from "@/lib/invitation/date";
import { eventSectionCopy, greetingPageCopy } from "@/lib/templates/copy";
import { experienceLabels, labels, langFor } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { displayTokenMeasure } from "@/lib/typography/displayFit";
import { FontPreloads } from "@/components/craft/FontPreloads";
import { InvitationExperience } from "@/components/craft/InvitationExperience";
import { Reveal } from "@/components/craft/Reveal";
import { EditorialBotanical, safeEditorialMask } from "@/components/craft/EditorialMedia";
import { DecoFan } from "@/components/craft/DecoGeometry";
import { DirectedImage } from "@/components/primitives/DirectedImage";
import { Greeting } from "@/components/sections/Greeting";
import { Countdown } from "@/components/sections/Countdown";
import { Venue } from "@/components/sections/Venue";
import { Timeline } from "@/components/sections/Timeline";
import { DressCode } from "@/components/sections/DressCode";
import { Wishes } from "@/components/sections/Wishes";
import { Rsvp } from "@/components/sections/Rsvp";
import { Footer } from "@/components/sections/Footer";
import { Calendar } from "@/components/sections/Calendar";
import { StudioCompositionHero, StudioCompositionDecor, safeStudioPhotoShape } from "./StudioComposition";
import "@/app/studio-templates.css";
import "@/app/studio-composition.css";
import "@/app/mood-profiles.css";
import { resolveMoodProfile } from "@/registry/moodProfiles";

export type StudioTemplateTheme = Theme & { studioTemplate: NonNullable<Theme["studioTemplate"]> };
export interface StudioTemplateInvitationProps {
  content: Content;
  theme: StudioTemplateTheme;
  initialNow: number;
  photos?: DirectedAsset[];
  guest?: string;
  embedded?: boolean;
  /** Platform-owned features share the authored section rhythm without
   * changing the original project invitation contract. */
  additionalSections?: { story?: ReactNode; rsvp?: ReactNode };
  /** Platform uploads have no asset-director metadata. Their caller supplies a
   * whole, naturally sized image without inventing a crop or quality grade. */
  openingMedia?: ReactNode;
  closingEnabled?: boolean;
}

/** Each catalogue entry is a complete authored composition. AI selects a
 * registered entry and its tokens; live event content is never rasterised. */
export function StudioTemplateInvitation({ content: suppliedContent, theme, initialNow, photos = [], guest, embedded = false, additionalSections, openingMedia, closingEnabled = true }: StudioTemplateInvitationProps) {
  const isGreeting = suppliedContent.purpose === "greeting";
  // Also protect callers outside the platform adapter: a greeting never renders
  // event controls or accidentally retained private event facts.
  const content: Content = isGreeting ? {
    ...suppliedContent,
    date: { start: "", timezone: suppliedContent.date.timezone, showCountdown: false },
    venue: { name: "", address: "" }, timeline: [], dressCode: undefined, rsvp: undefined,
  } : suppliedContent;
  const greetingCopy = greetingPageCopy(content);
  const platformRsvp = isGreeting ? undefined : additionalSections?.rsvp;
  const template = theme.studioTemplate.id;
  const composition = theme.studioTemplate.composition;
  const moodProfile = composition && resolveMoodProfile({
    templateId: template,
    paletteId: theme.studioTemplate.paletteId,
    fontPairId: theme.studioTemplate.fontPairId,
    ornamentSetId: theme.studioTemplate.ornamentSetId,
  });
  const moodCoverArt = moodProfile
    ? { "--mood-cover-art": `url("/artwork/mood-profiles/${moodProfile.id}-v1.webp")` }
    : undefined;
  const copy = experienceLabels[content.locale];
  const sectionCopy = eventSectionCopy(content);
  const date = eventDate(content);
  const hasDate = Boolean(content.date.start || content.date.day);
  const t = (value: string) => typograph(value, content.locale);
  const monogram = content.hosts.map((host) => Array.from(host.name.trim())[0]).filter(Boolean).join("·");
  const populated = populatedSections(content);
  const seen = new Set<string>();
  const directed = compositionPhotos(photos, theme).filter(({ photo }) => {
    if (photo.asset.role === "unused" || !photo.asset.placement || seen.has(photo.asset.id)) return false;
    seen.add(photo.asset.id);
    return true;
  });
  const at = (id: SectionId, position?: "before" | "after") => directed.filter(({ photo, position: placed }) => photo.asset.placement?.section === id && (!position || placed === position));
  const canonical = invitationSectionOrder(content, theme.layout.sectionOrder, directed.map(({ photo }) => photo.asset.placement!.section))
    .filter((id) => (!isGreeting || ["hero", "greeting", "wishes", "footer"].includes(id)) && (populated.includes(id) || at(id).length));
  const order = applyStudioSectionOrder(canonical, composition?.sectionOrder);
  const next = order.find((id) => id !== "hero") || "footer";
  const storyAfter = order.includes("greeting") ? "greeting"
    : composition?.sectionOrder === "event-first"
      ? order.findLast((id) => id === "countdown" || id === "venue" || id === "timeline") ?? "hero"
      : "hero";
  const nextTarget = additionalSections?.story && storyAfter === "hero" ? "story" : next === "footer" && platformRsvp ? "rsvp" : next === "footer" && !closingEnabled ? undefined : next;
  const motion = composition?.motionPreset ?? (moodProfile || theme.motion.preset === "still" ? "still" : "drift");
  // Fit words to their actual title column, including the wider display font.
  // Only composed designs use this measure; legacy recipes retain their scale.
  const nameMeasure = (text: string) => displayTokenMeasure(t(text), theme.typeSet, composition?.typographyAccent === "uppercase-wide-tracking");
  const headingMeasure = (text: string) => composition ? nameMeasure(text) : undefined;
  const title = <><h1 id="hero-title" className="studio-template-names" data-title-kind={content.headline ? "headline" : "names"}>{content.headline ? <span data-studio-field="headline">{t(content.headline)}</span> : content.hosts.map((host, index) => <span className="studio-template-name-line" data-long-name={Array.from(host.name.trim()).length > 20 || undefined} style={{ "--studio-name-measure": nameMeasure(host.name) } as CSSProperties} key={index}>{index > 0 && <span className="studio-template-join" aria-hidden="true">&amp;</span>}<span data-studio-field={`hosts.${index}.name`}>{t(host.name)}</span></span>)}</h1>{content.headline && <p className="studio-template-hosts">{content.hosts.map((host, index) => <span key={index}>{index > 0 && <span aria-hidden="true"> &amp; </span>}<span data-studio-field={`hosts.${index}.name`}>{t(host.name)}</span></span>)}</p>}</>;
  const eyebrow = <p className="studio-template-eyebrow">{t(isGreeting ? greetingCopy[content.eventType] : copy[content.eventType])}</p>;
  const dateBlock = hasDate ? <time className="studio-template-date" dateTime={content.date.start || content.date.day} data-studio-section="date"><span className="studio-template-day">{date.day}</span><span className="studio-template-date-copy"><span>{t(`${date.month} ${date.year}`)}</span><span className="studio-template-meta">{t(`${date.weekday}${date.time ? ` · ${date.time}` : ""}`)}</span></span></time> : null;
  const place = content.venue.name.trim() || content.venue.address.trim() ? <div className="studio-template-place">{content.venue.name.trim() && <p data-studio-field="venue.name">{t(content.venue.name)}</p>}{content.venue.address.trim() && <p className="studio-template-meta" data-studio-field="venue.address">{t(content.venue.address)}</p>}</div> : null;
  const personal = guest && !isGreeting ? <p className="studio-template-personal">{t(`${guest}, ${copy.forYou}`)}</p> : null;
  const scroll = nextTarget ? <a className="studio-template-scroll hero-next" href={`#${nextTarget}`} aria-label={nextTarget === "story" ? isGreeting ? greetingCopy.story : content.locale === "ru" ? "Наша история" : content.locale === "uz-latn" ? "Bizning hikoyamiz" : "Our story" : isGreeting && nextTarget === "greeting" ? greetingCopy.greeting : isGreeting && nextTarget === "footer" ? greetingCopy.footer : labels[content.locale][nextTarget]}><span>{t(copy.scroll)}</span><span aria-hidden="true">↓</span></a> : null;
  const photoSet = (id: SectionId, position: "before" | "after") => at(id, position).length ? <div className="studio-template-photo-set" data-photo-section={id} data-position={position}>{at(id, position).map(({ photo }, index) => {
    const mask = id === "hero" && template === "botanical" ? safeEditorialMask(photo, "soft_arch") : "rectangular_passepartout";
    const shape = composition ? safeStudioPhotoShape(photo, composition.photoShape) : undefined;
    return <div className="studio-template-photo-mount" data-studio-photo-mask={composition ? undefined : mask} data-photo-shape={shape} data-requested-photo-shape={composition?.photoShape} data-protected-fallback={composition && shape !== composition.photoShape || undefined} key={photo.asset.id}><DirectedImage photo={photo} locale={content.locale} eager={id === "hero" && index === 0} /></div>;
  })}</div> : null;
  const heroPhotos = <div className="studio-template-hero-photos">{openingMedia}{photoSet("hero", "before")}{photoSet("hero", "after")}</div>;
  const hasHeroPhotos = Boolean(openingMedia) || at("hero").length > 0;
  const calendar = hasDate && !content.rsvp?.enabled ? <div className="studio-template-calendar"><Calendar content={content} /></div> : null;
  let opening: ReactNode;
  switch (template) {
    case "editorial":
      opening = <div className="studio-editorial-opening"><div className="studio-editorial-masthead">{eyebrow}{hasDate && <span>{date.year}</span>}</div>{personal}{title}<div className="studio-editorial-facts">{dateBlock}{place}</div>{hasHeroPhotos ? heroPhotos : <EditorialLines />}{calendar}{scroll}</div>;
      break;
    case "botanical":
      opening = <div className="studio-botanical-opening"><div className="studio-botanical-arch" aria-hidden="true" /><EditorialBotanical className="studio-botanical-left" /><EditorialBotanical className="studio-botanical-right" /><div className="studio-botanical-copy">{eyebrow}{personal}<span className="studio-botanical-monogram" aria-hidden="true">{monogram}</span>{title}{dateBlock}{hasHeroPhotos && heroPhotos}{place}{calendar}{scroll}</div></div>;
      break;
    case "classic":
      opening = <div className="studio-classic-opening"><div className="studio-classic-frame" aria-hidden="true" /><div className="studio-classic-monogram" aria-hidden="true"><span>{monogram}</span><FormalFlourish /></div>{eyebrow}{personal}{title}<FormalFlourish />{dateBlock}{place}{hasHeroPhotos && heroPhotos}{calendar}{scroll}</div>;
      break;
    case "modern":
      opening = <div className="studio-modern-opening"><div className="studio-modern-bar">{eyebrow}<span aria-hidden="true">↗</span></div>{personal}<div className="studio-modern-title">{title}<ModernMark /></div><div className="studio-modern-facts">{dateBlock}{place}</div>{hasHeroPhotos && heroPhotos}<div className="studio-modern-band" aria-hidden="true"><span /><span /><span /></div>{calendar}{scroll}</div>;
      break;
    case "corporate":
      opening = <div className="studio-corporate-opening"><div className="studio-corporate-masthead"><CorporateMark />{eyebrow}</div>{personal}{title}<div className="studio-corporate-facts">{dateBlock}{place}</div>{calendar}{scroll}{hasHeroPhotos && heroPhotos}<div className="studio-corporate-rule" aria-hidden="true" /></div>;
      break;
    case "nocturne":
      opening = <div className="studio-nocturne-opening"><div className="studio-nocturne-arch" aria-hidden="true" /><DecoFan className="studio-nocturne-fan" />{eyebrow}{personal}{title}<div className="studio-nocturne-diamond" aria-hidden="true" />{dateBlock}{place}{hasHeroPhotos && heroPhotos}{calendar}{scroll}</div>;
      break;
  }
  if (composition) opening = <StudioCompositionHero composition={composition} ornamentSetId={theme.studioTemplate.ornamentSetId} eyebrow={eyebrow} personal={personal} title={title} titleKind={content.headline ? "headline" : "names"} date={dateBlock} place={place} media={heroPhotos} hasPhotos={hasHeroPhotos} actions={<>{calendar}{scroll}</>} />;
  const sections: Record<SectionId, ReactNode> = {
    hero: <section id="hero" className="studio-template-hero" data-section="hero" aria-labelledby="hero-title">{opening}</section>,
    greeting: <Greeting content={content} guest={isGreeting ? undefined : guest} heading={sectionCopy.greeting} headingMeasure={headingMeasure((!isGreeting && guest) || sectionCopy.greeting)} />,
    countdown: <>{composition?.sectionVariants.countdown === "date-led" && <div className="studio-composition-countdown-date">{dateBlock}</div>}<Countdown date={content.date} locale={content.locale} initialNow={initialNow} heading={sectionCopy.countdown} headingMeasure={headingMeasure(sectionCopy.countdown)} /></>,
    venue: <Venue content={content} />,
    timeline: <Timeline content={content} heading={sectionCopy.timeline} headingMeasure={headingMeasure(sectionCopy.timeline)} />,
    dressCode: <DressCode content={content} headingMeasure={headingMeasure(content.dressCode?.title || labels[content.locale].dressCode)} />,
    wishes: <Wishes content={content} />,
    rsvp: <Rsvp content={content} guest={guest} />,
    footer: isGreeting ? <footer id="footer" className="invitation-footer" data-section="footer"><p data-studio-field={content.closing ? "closing" : undefined} data-level="display-sm">{t(content.closing || greetingCopy.footer)}</p><p data-level="body">{t(content.hosts.map((host) => host.name).join(" & "))}</p><a href="#hero" className="footer-top" aria-label={greetingCopy.top}>↑</a></footer> : <Footer content={content} />,
  };
  const variants = composition?.sectionVariants;
  const variantFor = (id: SectionId) => {
    if (id === "timeline") return variants?.program;
    if (id === "countdown" || id === "venue" || id === "rsvp" || id === "dressCode" || id === "wishes") return variants?.[id];
  };
  const page = <div className="studio-template-content">{order.map((id) => <Fragment key={id}>
        {id === "footer" && platformRsvp && <div className="studio-template-slot studio-template-slot-rsvp" data-template-role="rsvp" data-section-variant={composition?.sectionVariants.rsvp}>{platformRsvp}</div>}
        {!(id === "footer" && !closingEnabled) && !(id === "rsvp" && platformRsvp) && <div className={`studio-template-slot studio-template-slot-${id}`} id={populated.includes(id) ? undefined : id} data-template-role={id} data-section-variant={variantFor(id)}>
        {composition && id !== "hero" && <StudioCompositionDecor composition={composition} ornamentSetId={theme.studioTemplate.ornamentSetId} divider />}
        {id !== "hero" && photoSet(id, "before")}
        {populated.includes(id) && (id === "hero" || motion === "still" ? sections[id] : <Reveal className="studio-template-reveal">{sections[id]}</Reveal>)}
        {id !== "hero" && photoSet(id, "after")}
      </div>}
        {id === storyAfter && additionalSections?.story && <div className="studio-template-slot studio-template-slot-story" data-template-role="story" data-section-variant={variants?.story}>{additionalSections.story}</div>}
      </Fragment>)}</div>;
  return <><FontPreloads typeSet={theme.typeSet} locale={content.locale} /><main className={moodProfile ? `invitation studio-template ${moodProfile.className}` : "invitation studio-template"} data-studio-template={template} data-template-revision={theme.studioTemplate.revision} data-type-set={theme.typeSet} data-mood-profile={moodProfile?.id} data-studio-composition={composition ? "parametric" : undefined} data-surface-style={composition?.surfaceStyle} data-spacing-scale={composition?.spacingScale} data-typography-accent={composition?.typographyAccent} data-gallery-variant={composition?.sectionVariants.gallery} data-motion={motion} style={{ ...toCssVars(theme), ...studioTemplateCssVars(template), ...(composition && studioCompositionCssVars(composition)), ...moodProfile?.css, ...moodCoverArt } as CSSProperties} lang={langFor(content.locale)}>
    {isGreeting || (moodProfile && motion !== "unfold") ? page : <InvitationExperience names={content.hosts.map((host) => host.name).join(" & ")} monogram={monogram} date={date.full} guest={guest} locale={content.locale} motion={motion} embedded={embedded}>
      {page}
    </InvitationExperience>}
  </main></>;
}

function EditorialLines() {
  return <svg className="studio-editorial-lines" viewBox="0 0 340 140" fill="none" aria-hidden="true" focusable="false"><path d="M16 112C53 110 47 27 115 25c68-2 24 92 106 89 52-2 60-60 103-60" stroke="currentColor" strokeWidth=".8" /><path d="M14 101c61 37 51-89 119-77 51 9 19 92 80 96 64 4 65-71 111-68" stroke="currentColor" strokeWidth=".8" /><path d="M150 12v116M191 12v116" stroke="currentColor" strokeOpacity=".25" strokeWidth=".6" /></svg>;
}
function FormalFlourish() {
  return <svg className="studio-formal-flourish" viewBox="0 0 140 22" fill="none" aria-hidden="true" focusable="false"><path d="M6 11h42m44 0h42M48 11c7-12 16-10 22 0-6 10-15 12-22 0Zm44 0c-7-12-16-10-22 0 6 10 15 12 22 0Z" stroke="currentColor" strokeWidth=".7" /><path d="m70 6 5 5-5 5-5-5 5-5Z" stroke="currentColor" strokeWidth=".7" /></svg>;
}
function ModernMark() {
  return <svg className="studio-modern-mark" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><path d="M60 0h24v36h36v24H84v24H60V60H24V36h36Z" fill="currentColor" /><circle cx="24" cy="96" r="24" fill="currentColor" /></svg>;
}
function CorporateMark() {
  return <svg className="studio-corporate-mark" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M0 0h15v15H0zM21 0h15v15H21zM0 21h15v15H0z" fill="currentColor" /><path d="M21 21h15v15H21z" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
}
