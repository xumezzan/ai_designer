/* eslint-disable @next/next/no-img-element -- Preserve whole platform media with native sizing. */
import type { CSSProperties, ReactNode } from "react";
import type { InvitationDraft } from "@/lib/platform/schema";
import { platformContent } from "@/lib/platform-render/content";
import { platformTheme } from "@/lib/platform-render/theme";
import { toCssVars } from "@/lib/theme/toCssVars";
import { displayTokenMeasure } from "@/lib/typography/displayFit";
import { typograph } from "@/lib/typography/ru";
import { eventDate } from "@/lib/invitation/date";
import { experienceLabels } from "@/lib/invitation/locale";
import { eventSectionCopy, greetingPageCopy } from "@/lib/templates/copy";
import { FontPreloads } from "@/components/craft/FontPreloads";
import { Greeting } from "@/components/sections/Greeting";
import { Countdown } from "@/components/sections/Countdown";
import { Venue } from "@/components/sections/Venue";
import { Timeline } from "@/components/sections/Timeline";
import { DressCode } from "@/components/sections/DressCode";
import { Wishes } from "@/components/sections/Wishes";
import { Calendar } from "@/components/sections/Calendar";
import { MaterialGreeting } from "./MaterialGreeting";
import "@/app/material-studio.css";

/** Original artwork supplies the physical world; editable HTML supplies its
 * hierarchy. Scene and layout are independent, versioned appearance choices. */
export function MaterialSceneInvitation({ draft, initialNow, slug, rsvp }: {
  draft: InvitationDraft; initialNow: number; slug?: string; rsvp?: ReactNode;
}) {
  const direction = draft.artDirection!;
  const content = platformContent(draft, slug);
  const dedicated = ["heritage", "sculpted-garden"].includes(draft.templateId);
  const baseTheme = platformTheme(dedicated ? { ...draft, templateId: "editorial", ornamentSetId: "editorial-rules", composition: undefined } : draft);
  const background = baseTheme.palette.bg;
  const luminance = [1, 3, 5].map((offset) => parseInt(background.slice(offset, offset + 2), 16))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const night = direction.scene === "night-garden" || luminance < 110;
  const theme = { ...baseTheme, palette: direction.scene === "night-garden" && luminance >= 110
    ? { bg: "#101d19", surface: "#1c2c25", ink: "#f7f0dd", muted: "#c3c7b7", accent: "#c6ab71", accentAlt: "#6e8064" }
    : baseTheme.palette };
  const t = (text: string) => typograph(text, content.locale);
  const measure = (text: string) => displayTokenMeasure(t(text), theme.typeSet);
  const greeting = draft.purpose === "greeting";
  const personalCopy = greetingPageCopy(content);
  const sectionCopy = eventSectionCopy(content);
  const date = eventDate(content);
  const hasDate = !greeting && Boolean(content.date.start || content.date.day);
  const artwork = draft.artwork?.src;
  const isEnabled = (section: InvitationDraft["enabledSections"][number]) => draft.enabledSections.includes(section);
  const hasGreeting = isEnabled("greeting") && Boolean(content.greeting);
  const story = draft.story?.trim();
  const hasStory = isEnabled("story") && Boolean(story || draft.media.length);
  const hasVenue = !greeting && isEnabled("venue") && Boolean(content.venue.name || content.venue.address);
  const hasTimeline = !greeting && isEnabled("timeline") && content.timeline.length > 0;
  const hasDress = !greeting && isEnabled("dressCode") && Boolean(content.dressCode);
  const hasWishes = Boolean(content.wishes?.trim());
  const hasRsvp = !greeting && isEnabled("rsvp") && Boolean(rsvp);
  const hasClosing = isEnabled("closing");
  const next = hasGreeting ? "greeting" : hasStory ? "story" : hasDate ? "countdown" : hasVenue ? "venue" : hasTimeline ? "timeline" : hasDress ? "dressCode" : hasWishes ? "wishes" : hasRsvp ? "rsvp" : hasClosing ? "footer" : undefined;
  const storyHeading = !story ? personalCopy.gallery : greeting ? personalCopy.story : content.locale === "ru" ? "Наша история" : "Bizning hikoyamiz";
  const artworkImage = (className: string, eager = false) => artwork && <div className={className} aria-hidden="true">
    {/* Material imagery is decorative, never a replacement for event text. */}
    <img src={artwork} alt="" loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "high" : "auto"} />
  </div>;
  const identity = <h1 id="hero-title" className="material-site-title" data-title-kind={content.headline ? "headline" : "names"}>
    {content.headline ? <span className="material-site-name" style={{ "--name-measure": measure(content.headline) } as CSSProperties} data-studio-field="headline">{t(content.headline)}</span>
      : content.hosts.map((host, i) => <span className="material-site-host" key={i}>{i > 0 && <span className="material-site-join" aria-hidden="true">&amp;</span>}<span className="material-site-name" style={{ "--name-measure": measure(host.name) } as CSSProperties} data-studio-field={`hosts.${i}.name`}>{t(host.name)}</span></span>)}
  </h1>;
  const signature = content.headline && <p className="material-site-recipient">{content.hosts.map((host, i) => <span key={i}>{i > 0 && " · "}<span data-studio-field={`hosts.${i}.name`}>{t(host.name)}</span></span>)}</p>;
  const coverIdentity = <div className="material-site-cover-reading">{identity}{signature}</div>;
  const dateMark = hasDate && <time className="material-site-date" dateTime={content.date.start || content.date.day} data-studio-section="date"><strong>{date.day}</strong><span>{t(`${date.month} ${date.year}`)}<small>{t(`${date.weekday}${date.time ? ` · ${date.time}` : ""}`)}</small></span></time>;
  const eyebrow = <p className="material-site-eyebrow material-site-cover-reading">{t(greeting ? personalCopy[content.eventType] : experienceLabels[content.locale][content.eventType])}</p>;
  const actions = (hasDate || next) && <div className="material-site-actions">{hasDate && <Calendar content={content} />}{next && <a className="material-site-next" href={`#${next}`}><span>{content.locale === "ru" ? "Читать дальше" : "Davomini o‘qish"}</span><span aria-hidden="true">↓</span></a>}</div>;
  const coverFoot = (hasDate || next) && <div className="material-site-cover-foot material-site-cover-reading">{dateMark}{actions}</div>;
  const intro = direction.layout === "editorial"
    ? <div className="material-site-editorial-cover">{eyebrow}<div className="material-site-editorial-identity">{coverIdentity}</div>{coverFoot}</div>
    : direction.layout === "immersive"
      ? <div className="material-site-immersive-cover">{eyebrow}<div className="material-site-immersive-identity">{coverIdentity}</div>{coverFoot}</div>
      : <div className="material-site-keepsake-cover">{eyebrow}<div className="material-site-keepsake-identity">{coverIdentity}</div><span className="material-site-inscription" aria-hidden="true">{content.hosts.map((host) => Array.from(host.name)[0]).join(" · ")}</span>{coverFoot}</div>;
  return <><FontPreloads typeSet={theme.typeSet} locale={content.locale} /><main className="invitation material-site" data-scene={direction.scene} data-layout={direction.layout} data-tone={night ? "dark" : "light"} data-artwork={artwork ? "original" : "pending"} style={toCssVars(theme) as CSSProperties} lang={content.locale === "ru" ? "ru" : "uz-Latn"}>
    <section id="hero" className="material-site-hero" data-section="hero" aria-labelledby="hero-title">{artworkImage("material-site-cover-art", true)}{intro}</section>
    <div className="material-site-narrative">
      {hasGreeting && <div className="material-site-chapter material-site-letter" data-role="greeting"><div className="material-site-paper"><span className="material-site-seal" aria-hidden="true">{Array.from(content.hosts[0].name)[0]}</span>{greeting ? <MaterialGreeting content={content} heading={sectionCopy.greeting} /> : <Greeting content={content} heading={sectionCopy.greeting} headingMeasure={measure(sectionCopy.greeting)} />}</div></div>}
      {hasStory && (
        <section id="story" className="material-site-chapter material-site-story" data-section="story" aria-labelledby="material-story-title">
          <div className="material-site-story-layout">
            <h2 id="material-story-title">{t(storyHeading)}</h2>
            {story && <div className="material-site-story-copy">
              {story.split(/\n\s*\n/).map((paragraph, i) => (
                <p data-level="body" data-studio-field={i === 0 ? "story" : undefined} key={i}>{t(paragraph)}</p>
              ))}
            </div>}
          </div>
          {draft.media.length > 0 && <div className="material-site-gallery">{draft.media.map((photo, i) => <figure key={photo.id}><img src={photo.src} alt={`${personalCopy.photo} ${i + 1}`} loading="lazy" decoding="async" /></figure>)}</div>}
        </section>
      )}
      {hasDate && <div className="material-site-chapter material-site-date-scene" data-role="date">{artworkImage("material-site-detail-art")}<div className="material-site-date-panel">{dateMark}<Countdown date={content.date} locale={content.locale} initialNow={initialNow} heading={sectionCopy.countdown} headingMeasure={measure(sectionCopy.countdown)} />{!content.date.showCountdown && <span id="countdown" />}</div></div>}
      {hasVenue && <div className="material-site-chapter material-site-venue" data-role="venue">{direction.layout === "immersive" && artworkImage("material-site-venue-art")}<Venue content={content} /></div>}
      {hasTimeline && <div className="material-site-chapter material-site-program" data-role="timeline"><Timeline content={content} heading={sectionCopy.timeline} headingMeasure={measure(sectionCopy.timeline)} /></div>}
      {hasDress && <div className="material-site-chapter material-site-dress" data-role="dressCode"><DressCode content={content} headingMeasure={measure(content.dressCode!.title)} /></div>}
      {hasWishes && <div className="material-site-chapter" data-role="wishes"><Wishes content={content} /></div>}
      {hasRsvp && <div className="material-site-chapter material-site-response" data-role="rsvp"><div className="material-site-response-paper">{rsvp}</div></div>}
      {hasClosing && <footer id="footer" className="material-site-farewell" data-section="footer">{artworkImage("material-site-farewell-art")}<div className="material-site-farewell-copy"><p className="material-site-eyebrow">{greeting ? personalCopy.footer : content.locale === "ru" ? "До скорой встречи" : "Tez orada ko‘rishguncha"}</p><p className="material-site-closing" data-studio-field="closing">{t(content.closing || (greeting ? personalCopy.footer : content.hosts.map((host) => host.name).join(" & ")))}</p><div className="material-site-signature">{content.hosts.map((host) => host.name).join(" & ")}</div><a href="#hero" className="material-site-top" aria-label={personalCopy.top}>↑</a></div></footer>}
    </div>
  </main></>;
}
