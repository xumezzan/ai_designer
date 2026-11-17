/* eslint-disable @next/next/no-img-element -- Private, owner-controlled media are served by the platform media route. */
import type { CSSProperties, ReactNode } from "react";
import type { InvitationDraft } from "@/lib/platform/schema";
import type { Content } from "@/lib/schema/content";
import { platformContent } from "@/lib/platform-render/content";
import { eventDate } from "@/lib/invitation/date";
import { labels as sectionLabels } from "@/lib/invitation/locale";
import { invitationMonth } from "@/lib/invitation/month";
import { calendarLinks } from "@/lib/invitation/calendar";
import { httpTarget } from "@/lib/invitation/links";
import { Countdown } from "@/components/sections/Countdown";
import { typograph } from "@/lib/typography/ru";
import { studioPalettes } from "@/registry/studioTemplates";
import { getTypeSet, typeSetStackFor } from "@/registry/typesets";
import { FontPreloads } from "@/components/craft/FontPreloads";
import "./sculpted-garden.css";

const labels = {
  ru: {
    invitation: "Приглашение",
    events: { wedding: "Приглашение на свадьбу", anniversary: "Приглашение на годовщину", birthday: "Приглашение на день рождения", corporate: "Приглашение на мероприятие", engagement: "Приглашение на помолвку", other: "Приглашение" },
    namesPlaceholder: "Ваши имена",
    and: "и",
    hello: ["Дорогие", "гости"],
    greeting: "Наша встреча",
    story: "История",
    moments: "Мгновения",
    photo: "Фотография от организаторов",
    date: "Дата события",
    time: "Начало",
    calendar: "Сохранить дату",
    download: "Скачать календарь",
    until: "До нашей встречи",
    venue: "Место встречи",
    place: "Будем ждать вас здесь",
    map: "Открыть карту",
    timeline: "Программа",
    dressCode: "Дресс-код",
    swatch: "Цвет",
    rsvp: "Ваш ответ",
    reply: "Подтвердите участие",
    scroll: "Листайте дальше",
    closing: "До встречи",
    top: "Наверх",
  },
  "uz-latn": {
    invitation: "Taklifnoma",
    events: { wedding: "To‘yga taklifnoma", anniversary: "Yubileyga taklifnoma", birthday: "Tug‘ilgan kunga taklifnoma", corporate: "Tadbirga taklifnoma", engagement: "Unashtiruvga taklifnoma", other: "Taklifnoma" },
    namesPlaceholder: "Ismlaringiz",
    and: "va",
    hello: ["Aziz", "mehmonlar"],
    greeting: "Uchrashuvimiz",
    story: "Hikoya",
    moments: "Lahzalar",
    photo: "Tashkilotchilardan surat",
    date: "Tadbir sanasi",
    time: "Boshlanishi",
    calendar: "Sanani saqlash",
    download: "Taqvimni yuklab olish",
    until: "Uchrashuvimizgacha",
    venue: "Uchrashuv joyi",
    place: "Sizni shu yerda kutamiz",
    map: "Xaritani ochish",
    timeline: "Dastur",
    dressCode: "Dress-kod",
    swatch: "Rang",
    rsvp: "Javobingiz",
    reply: "Ishtirokingizni tasdiqlang",
    scroll: "Davomini ko‘ring",
    closing: "Ko‘rishguncha",
    top: "Yuqoriga",
  },
} as const;

const palettes = {
  ivory: { paper: "#f6f1e7", ink: "#3e392f", accent: "#aa8953", light: "#e3d0a4", dark: "#76603b", venue: "#404638" },
  sage: { paper: "#f0f1e9", ink: "#354033", accent: "#8a946c", light: "#c9d0b5", dark: "#5a6848", venue: "#354535" },
  midnight: { paper: "#222b30", ink: "#f2eee1", accent: "#c3aa78", light: "#45525b", dark: "#dbc89e", venue: "#172027" },
  rose: { paper: "#f6eeeb", ink: "#503f3e", accent: "#b5877e", light: "#e6c7bd", dark: "#966961", venue: "#4f4242" },
  cinnabar: { paper: "#f6efe4", ink: "#4f2e29", accent: "#aa6750", light: "#e5c0a4", dark: "#89442f", venue: "#633a30" },
} as const;

function SectionLabel({ number, children }: { number: number; children: ReactNode }) {
  return <div className="sg-section-label"><span className="sg-section-number" aria-hidden="true">{String(number).padStart(2, "0")}</span><span className="sg-eyebrow">{children}</span></div>;
}

function Ornament() {
  return <span className="sg-ornament" aria-hidden="true">✧</span>;
}

function MonthCalendar({ content }: { content: Content }) {
  const month = invitationMonth(content);
  const weeks = Array.from({ length: Math.ceil(month.cells.length / 7) }, (_, index) => month.cells.slice(index * 7, index * 7 + 7));
  return <table className="sg-calendar">
    <caption>{month.title}</caption>
    <thead><tr>{month.weekdays.map((weekday, index) => <th scope="col" key={index}>{weekday}</th>)}</tr></thead>
    <tbody>{weeks.map((week, index) => <tr key={index}>{week.map((day, dayIndex) => <td key={dayIndex}>{day === null ? null : <span className={day === month.selected ? "sg-calendar-selected" : undefined} aria-current={day === month.selected ? "date" : undefined}>{day}</span>}</td>)}</tr>)}</tbody>
  </table>;
}

/** Live event facts sit above the artwork; generated pixels never contain names or controls. */
export function SculptedGardenInvitation({
  draft,
  slug,
  rsvp,
  embedded = false,
  initialNow = Date.now(),
}: {
  draft: InvitationDraft;
  slug?: string;
  rsvp?: ReactNode;
  embedded?: boolean;
  initialNow?: number;
}) {
  const copy = labels[draft.locale];
  const text = (value: string) => typograph(value, draft.locale);
  const enabled = new Set(draft.enabledSections);
  // An unfinished editor draft can contain a DST gap/overlap. Show its civil date,
  // but offer no countdown/calendar instant until the owner supplies a valid time.
  let content: Content;
  try {
    content = platformContent(draft, slug);
  } catch {
    content = platformContent({ ...draft, date: { ...draft.date, time: "" } }, slug);
  }
  const date = eventDate(content);
  const hasDate = enabled.has("date") && Boolean(date.full);
  const hasVenue = enabled.has("venue") && Boolean(draft.venue.name || draft.venue.address || draft.venue.note || draft.venue.mapUrl);
  const hasGreeting = enabled.has("greeting") && Boolean(draft.greeting.trim());
  const hasStory = enabled.has("story") && Boolean(draft.story?.trim());
  const hasTimeline = enabled.has("timeline") && draft.timeline.some((item) => item.time || item.title || item.note);
  const dressCode = enabled.has("dressCode") ? draft.dressCode : undefined;
  const hasDress = Boolean(dressCode && (dressCode.title || dressCode.note || dressCode.swatches.length));
  const wishes = content.wishes?.trim();
  const hasRsvp = enabled.has("rsvp") && Boolean(rsvp);
  const hasClosing = enabled.has("closing") && Boolean(draft.closing.trim());
  const calendar = hasDate && content.date.start ? calendarLinks(content) : undefined;
  const names = draft.names.map((name, index) => ({ name: name.trim(), index })).filter(({ name }) => name);
  const initials = names.slice(0, 3).map(({ name }) => Array.from(name)[0]).join(" · ");
  const registeredPalette = studioPalettes[draft.paletteId === "midnight" ? "ink" : draft.paletteId];
  // Preserve the existing art-directed five palettes. New canonical choices
  // receive their actual registry colours rather than an unrelated fallback.
  const palette = draft.paletteId in palettes
    ? palettes[draft.paletteId as keyof typeof palettes]
    : { paper: registeredPalette.bg, ink: registeredPalette.ink, accent: registeredPalette.accent, light: registeredPalette.surface, dark: registeredPalette.accentAlt, venue: registeredPalette.surface };
  const canonicalFontId = draft.fontPairId === "ceremony" || draft.fontPairId === "poetic" || draft.fontPairId === "modernist" || draft.fontPairId === "gallery" ? draft.fontPairId : undefined;
  const canonicalType = canonicalFontId ? getTypeSet(canonicalFontId) : undefined;
  const style = {
    "--sg-paper": palette.paper, "--sg-ink": palette.ink, "--sg-accent": palette.accent,
    "--sg-accent-light": palette.light, "--sg-accent-dark": palette.dark, "--sg-venue": palette.venue,
    ...(canonicalType ? { "--sg-display-font": typeSetStackFor(canonicalType, "display"), fontFamily: typeSetStackFor(canonicalType, "body") } : {}),
  } as CSSProperties;
  const portrait = draft.artwork?.src ?? "/artwork/sculpted-garden/portrait.webp";
  // A generated portrait is the desktop fallback too. Never substitute unrelated stock art.
  const wide = draft.artworkWide?.src ?? draft.artwork?.src ?? "/artwork/sculpted-garden/wide.webp";
  const artworkIds = new Set([draft.artwork?.id, draft.artworkWide?.id].filter(Boolean));
  const photos = draft.media.filter((image) => !artworkIds.has(image.id));
  const sections = [hasGreeting && "greeting", (hasStory || photos.length > 0) && "story", hasDate && "date", hasVenue && "venue", hasTimeline && "timeline", hasDress && "dressCode", wishes && "wishes", hasRsvp && "rsvp", hasClosing && "closing"].filter(Boolean) as string[];
  const number = (id: string) => sections.indexOf(id) + 1;
  const firstSection = sections[0];
  let mapUrl: string | undefined;
  if (hasVenue) {
    try {
      mapUrl = draft.venue.mapUrl ? httpTarget(draft.venue.mapUrl) : draft.venue.name || draft.venue.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([draft.venue.name, draft.venue.address].filter(Boolean).join(", "))}` : undefined;
    } catch { /* Invalid, unsaved editor links must not become interactive guest URLs. */ }
  }
  const nameElements = (closing = false) => names.map(({ name, index }, position) => <span className="sg-name-group" key={index}>
    {position > 0 && <span className={closing ? "sg-closing-and" : "sg-ampersand"} aria-hidden="true">{names.length === 2 ? "&" : copy.and}</span>}
    {position > 0 && <span className="sg-sr-only"> {copy.and} </span>}
    <span className={`sg-name${name.length > 20 ? " sg-long-name" : ""}`} data-studio-field={`hosts.${index}.name`}>{text(name)}</span>
  </span>);

  return <main className="sg-invitation" lang={draft.locale === "ru" ? "ru" : "uz-Latn"} data-template="sculpted-garden" data-palette={draft.paletteId} data-font-pair={draft.fontPairId} data-embedded={embedded || undefined} data-name-count={names.length} style={style}>
    {canonicalFontId && <FontPreloads typeSet={canonicalFontId} locale={draft.locale} />}
    {enabled.has("opening") ? <header className="sg-hero" id="opening" data-section="opening">
      <div className="sg-hero-art" aria-hidden="true">
        <img className="sg-art-portrait" src={portrait} alt="" fetchPriority="high" decoding="async" />
        <img className="sg-art-wide" src={wide} alt="" decoding="async" />
      </div>
      <div className="sg-masthead">
        <span className="sg-monogram" aria-hidden="true">{initials || "✧"}</span>
        <nav className="sg-navigation" aria-label={copy.invitation}>
          {hasDate && <a href="#date">{copy.date}</a>}
          {hasVenue && <a href="#venue">{copy.venue}</a>}
          {hasRsvp && <a href="#response">{copy.rsvp}</a>}
        </nav>
      </div>
      <div className="sg-hero-content">
        <p className="sg-eyebrow sg-hero-eyebrow">{text(copy.events[draft.eventType])}</p>
        <h1 className="sg-names">{names.length ? nameElements() : <span className="sg-name">{embedded ? copy.namesPlaceholder : copy.invitation}</span>}</h1>
        {(hasDate || hasVenue) && <div className="sg-hero-details">
          {hasDate && <time className="sg-hero-date" dateTime={content.date.start || draft.date.day} data-studio-field="date.start">{date.full}</time>}
          {hasVenue && <div className="sg-hero-place">
            {draft.venue.name && <p className="sg-hero-venue" data-studio-field="venue.name">{text(draft.venue.name)}</p>}
            {draft.venue.address && <p className="sg-hero-city" data-studio-field="venue.address">{text(draft.venue.address)}</p>}
          </div>}
        </div>}
      </div>
      {firstSection && <a className="sg-scroll-link" href={`#${firstSection === "rsvp" ? "response" : firstSection}`}>{copy.scroll}<span aria-hidden="true">↓</span></a>}
    </header> : <h1 className="sg-sr-only">{copy.invitation}</h1>}

    {hasGreeting && <section className="sg-intro sg-surface" id="greeting" data-section="greeting" aria-labelledby="sg-greeting-title">
      <SectionLabel number={number("greeting")}>{copy.greeting}</SectionLabel>
      <h2 className="sg-intro-heading" id="sg-greeting-title"><span>{copy.hello[0]}</span><em>{copy.hello[1]}</em></h2>
      <div className="sg-intro-copy"><Ornament /><p className="sg-body" data-studio-field="greeting">{text(draft.greeting)}</p></div>
      <span className="sg-relief-ampersand" aria-hidden="true">&</span>
    </section>}

    {(hasStory || photos.length > 0) && <section className="sg-story sg-surface" id="story" data-section="story" aria-labelledby="sg-story-title">
      <SectionLabel number={number("story")}>{hasStory ? copy.story : copy.moments}</SectionLabel>
      <h2 className="sg-section-heading" id="sg-story-title">{hasStory ? copy.story : copy.moments}</h2>
      {hasStory && <p className="sg-body" data-studio-field="wishes">{text(draft.story!)}</p>}
      {photos.length > 0 && <div className="sg-gallery" data-media-count={photos.length}>{photos.map((image, index) => <figure className="sg-photo-frame" key={image.id}><img src={image.src} alt={`${copy.photo} ${index + 1}`} loading="lazy" decoding="async" data-media-id={image.id} /></figure>)}</div>}
    </section>}

    {hasDate && <section className="sg-date-section sg-surface" id="date" data-section="date" aria-labelledby="sg-date-title">
      <SectionLabel number={number("date")}>{copy.date}</SectionLabel>
      <div className="sg-date-layout">
        <div className="sg-date-block"><h2 className="sg-date-numeral" id="sg-date-title" aria-label={date.full}>{date.day}</h2><p className="sg-date-month">{date.month} {date.year}</p><p className="sg-date-weekday">{date.weekday}</p></div>
        <MonthCalendar content={content} />
      </div>
      {(date.time || calendar) && <div className="sg-date-footer">
        {date.time && <div className="sg-time-note"><p className="sg-eyebrow">{copy.time}</p><p className="sg-time-value">{date.time}</p></div>}
        {calendar && <div className="sg-calendar-actions"><a className="sg-text-link" href={calendar.google} target="_blank" rel="noopener noreferrer">{copy.calendar}<span aria-hidden="true">↗</span></a><a className="sg-calendar-download" href={calendar.ics} download={`${slug || "invitation"}.ics`}>{copy.download}</a></div>}
      </div>}
      {content.date.start && content.date.showCountdown && <div className="sg-countdown"><Countdown date={content.date} locale={draft.locale} initialNow={initialNow} heading={copy.until} /></div>}
    </section>}

    {hasVenue && <section className="sg-venue-section" id="venue" data-section="venue" aria-labelledby="sg-venue-title">
      <SectionLabel number={number("venue")}>{copy.venue}</SectionLabel>
      <div className="sg-venue-arch" aria-hidden="true"><Ornament /></div>
      <div className="sg-venue-content"><p className="sg-eyebrow">{copy.place}</p>
        <h2 className="sg-venue-name" id="sg-venue-title" data-studio-field="venue.name">{text(draft.venue.name || copy.venue)}</h2>
        {draft.venue.address && <p className="sg-address sg-body" data-studio-field="venue.address">{text(draft.venue.address)}</p>}
        {draft.venue.note && <p className="sg-venue-note sg-body" data-studio-field="venue.note">{text(draft.venue.note)}</p>}
        {mapUrl && <a className="sg-text-link sg-map-link" href={mapUrl} target="_blank" rel="noopener noreferrer">{copy.map}<span aria-hidden="true">↗</span></a>}
      </div>
    </section>}

    {hasTimeline && <section className="sg-timeline-section sg-surface" id="timeline" data-section="timeline" aria-labelledby="sg-timeline-title">
      <SectionLabel number={number("timeline")}>{copy.timeline}</SectionLabel><h2 className="sg-section-heading" id="sg-timeline-title">{copy.timeline}</h2>
      <ol className="sg-timeline">{draft.timeline.map((item, index) => item.time || item.title || item.note ? <li key={index}><span className="sg-timeline-time" data-studio-field={`timeline.${index}.time`}>{text(item.time)}</span><div>{item.title && <h3 data-studio-field={`timeline.${index}.title`}>{text(item.title)}</h3>}{item.note && <p className="sg-body" data-studio-field={`timeline.${index}.note`}>{text(item.note)}</p>}</div></li> : null)}</ol>
    </section>}

    {hasDress && dressCode && <section className="sg-dress-section sg-surface" id="dressCode" data-section="dressCode" aria-labelledby="sg-dress-title">
      <SectionLabel number={number("dressCode")}>{copy.dressCode}</SectionLabel>
      <h2 className="sg-section-heading" id="sg-dress-title" data-studio-field="dressCode.title">{text(dressCode.title || copy.dressCode)}</h2>
      {dressCode.note && <p className="sg-body" data-studio-field="dressCode.note">{text(dressCode.note)}</p>}
      {dressCode.swatches.length > 0 && <ul className="sg-dress-swatches" aria-label={copy.dressCode}>{dressCode.swatches.map((color, index) => <li className="sg-dress-swatch" key={`${color}-${index}`}><span className="sg-swatch-material" style={{ backgroundColor: color }} aria-hidden="true" /><span className="sg-swatch-label">{copy.swatch} {index + 1}<span className="sg-sr-only"> {color}</span></span></li>)}</ul>}
    </section>}

    {wishes && <section className="sg-wishes sg-surface" id="wishes" data-section="wishes" aria-labelledby="sg-wishes-title">
      <h2 id="sg-wishes-title" className="sg-section-heading">{sectionLabels[draft.locale].wishes}</h2>
      <div data-studio-field="wishes">{wishes.split(/\n\s*\n/).map((line, index) => <p className="sg-body" key={index}>{text(line)}</p>)}</div>
    </section>}

    {hasRsvp && <section className="sg-rsvp-section sg-surface" id="response" data-section="rsvp" aria-labelledby="sg-rsvp-title"><SectionLabel number={number("rsvp")}>{copy.rsvp}</SectionLabel><h2 className="sg-section-heading" id="sg-rsvp-title">{copy.reply}</h2><div className="sg-rsvp-content">{rsvp}</div></section>}

    {hasClosing && <footer className="sg-closing" id="closing" data-section="closing"><Ornament /><h2 className="sg-sr-only">{copy.closing}</h2><p className="sg-closing-message" data-studio-field="closing">{text(draft.closing)}</p>{names.length > 0 && <p className="sg-closing-names">{nameElements(true)}</p>}{enabled.has("opening") && <a className="sg-closing-footer" href="#opening">{copy.top} ↑</a>}</footer>}
  </main>;
}
