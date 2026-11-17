import type { CSSProperties, ReactNode } from "react";
import type { InvitationDraft } from "@/lib/platform/schema";
import type { Content } from "@/lib/schema/content";
import type { Theme } from "@/lib/schema/theme";
import { platformContent } from "@/lib/platform-render/content";
import { eventDate } from "@/lib/invitation/date";
import { invitationMonth } from "@/lib/invitation/month";
import { httpTarget } from "@/lib/invitation/links";
import { calendarLinks } from "@/lib/invitation/calendar";
import { Countdown } from "@/components/sections/Countdown";
import { typograph } from "@/lib/typography/ru";
import { toCssVars } from "@/lib/theme/toCssVars";
import { getTypeSet, typeSetStackFor } from "@/registry/typesets";
import { FontPreloads } from "@/components/craft/FontPreloads";
import { HeritageEntrance } from "./HeritageEntrance";
import "./invitation.css";
import "./heritage-invitation.css";

export type HeritageSectionRole =
  | "hero"
  | "greeting"
  | "story"
  | "date"
  | "venue"
  | "timeline"
  | "dressCode"
  | "wishes"
  | "rsvp"
  | "footer";
export type HeritageSectionSlot = {
  before?: ReactNode;
  body?: ReactNode;
  after?: ReactNode;
};

const labels = {
  ru: {
    invitation: "Приглашение",
    wedding: "Приглашение на свадьбу",
    celebration: "Приглашение на праздник",
    withFamily: "Вместе с нашими семьями",
    and: "и",
    join: "Разделите с нами этот день",
    hello: "Дорогие гости",
    story: "Наша история",
    chapter: "Новая глава",
    moments: "Наши мгновения",
    photo: "Фотография из нашей истории",
    date: "День нашей встречи",
    weddingDate: "День нашей свадьбы",
    dateEyebrow: "Наш праздник",
    time: "Начало",
    calendar: "Сохранить дату",
    download: "Скачать календарь",
    until: "До нашей встречи",
    untilWedding: "До нашей свадьбы",
    venue: "Место встречи",
    place: "Будем ждать вас здесь",
    map: "Открыть карту",
    timeline: "Программа дня",
    timelineEyebrow: "Каждое мгновение",
    dressCode: "Дресс-код",
    details: "Детали нашего дня",
    wishes: "Наши пожелания",
    rsvp: "Ваш ответ",
    reply: "Подтвердить участие",
    rsvpNote: "С нетерпением ждём встречи с вами",
    more: "О нашем дне",
    scroll: "Листайте дальше",
    farewell: "До скорой встречи",
    love: "С любовью",
    back: "Наверх",
    skip: "Перейти к приглашению",
    swatch: "Цвет",
  },
  "uz-latn": {
    invitation: "Taklifnoma",
    wedding: "To‘yga taklifnoma",
    celebration: "Bayramga taklifnoma",
    withFamily: "Oilalarimiz bilan birga",
    and: "va",
    join: "Bu kunni biz bilan baham ko‘ring",
    hello: "Aziz mehmonlar",
    story: "Bizning hikoyamiz",
    chapter: "Yangi sahifa",
    moments: "Bizning lahzalarimiz",
    photo: "Hikoyamizdan surat",
    date: "Uchrashuv kunimiz",
    weddingDate: "To‘y kunimiz",
    dateEyebrow: "Bizning bayramimiz",
    time: "Boshlanishi",
    calendar: "Sanani saqlash",
    download: "Taqvimni yuklab olish",
    until: "Uchrashuvimizgacha",
    untilWedding: "To‘yimizgacha",
    venue: "Uchrashuv joyi",
    place: "Sizni shu yerda kutamiz",
    map: "Xaritani ochish",
    timeline: "Kun dasturi",
    timelineEyebrow: "Har bir lahza",
    dressCode: "Dress-kod",
    details: "Kunimiz tafsilotlari",
    wishes: "Bizning istaklarimiz",
    rsvp: "Sizning javobingiz",
    reply: "Ishtirokni tasdiqlash",
    rsvpNote: "Siz bilan uchrashishni intiqlik bilan kutamiz",
    more: "Kunimiz haqida",
    scroll: "Davomini ko‘ring",
    farewell: "Tez orada ko‘rishguncha",
    love: "Mehr bilan",
    back: "Yuqoriga",
    skip: "Taklifnomaga o‘tish",
    swatch: "Rang",
  },
  en: {
    invitation: "Invitation",
    wedding: "A wedding invitation",
    celebration: "An invitation to celebrate",
    withFamily: "Together with our families",
    and: "and",
    join: "Share this day with us",
    hello: "Dear guests",
    story: "Our story",
    chapter: "A new chapter",
    moments: "Our moments",
    photo: "A photograph from our story",
    date: "The day we meet",
    weddingDate: "Our wedding day",
    dateEyebrow: "Our celebration",
    time: "Beginning at",
    calendar: "Save the date",
    download: "Download calendar",
    until: "Until we meet",
    untilWedding: "Until our wedding",
    venue: "The setting",
    place: "We will be waiting for you here",
    map: "Open map",
    timeline: "The day's programme",
    timelineEyebrow: "Every moment",
    dressCode: "Dress code",
    details: "The little details",
    wishes: "Our wishes",
    rsvp: "Your reply",
    reply: "Confirm attendance",
    rsvpNote: "We look forward to celebrating with you",
    more: "About our day",
    scroll: "Discover our story",
    farewell: "See you soon",
    love: "With love",
    back: "Back to top",
    skip: "Skip to invitation",
    swatch: "Colour",
  },
};

function FlowerDivider() {
  return (
    <div className="hp-divider" aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <g fill="none" stroke="currentColor" strokeWidth="1.7">
          <ellipse cx="20" cy="10" rx="5" ry="8" />
          <ellipse cx="20" cy="30" rx="5" ry="8" />
          <ellipse cx="10" cy="20" rx="8" ry="5" />
          <ellipse cx="30" cy="20" rx="8" ry="5" />
          <circle cx="20" cy="20" r="3" />
        </g>
      </svg>
    </div>
  );
}

function Icon({ name }: { name: "date" | "time" | "pin" }) {
  return (
    <svg
      className="hp-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      {name === "date" ? (
        <>
          <rect x="3" y="5" width="18" height="16" rx="1" />
          <path d="M7 2v6M17 2v6M3 10h18M7 14h3m3 0h3m-9 4h3m3 0h3" />
        </>
      ) : name === "time" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l4 2" />
        </>
      ) : (
        <>
          <path d="M12 22s7-8.1 7-13a7 7 0 1 0-14 0c0 4.9 7 13 7 13Z" />
          <circle cx="12" cy="9" r="2.5" />
        </>
      )}
    </svg>
  );
}

function MonthCalendar({ content }: { content: Pick<Content, "date" | "locale"> }) {
  const month = invitationMonth(content);
  return (
    <div className="hp-month" aria-label={month.title}>
      <p className="hp-month-title">{month.title}</p>
      <div className="hp-month-grid">
        {month.weekdays.map((weekday, index) => (
          <span className="hp-weekday" key={`weekday-${index}`}>
            {weekday}
          </span>
        ))}
        {month.cells.map((day, index) => (
          <span
            key={index}
            className={day === month.selected ? "hp-day-selected" : ""}
            aria-current={day === month.selected ? "date" : undefined}
            aria-hidden={day === null || undefined}
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A live, schema-driven composition. Reference artwork is decoration; guest
 * facts, photographs and actions always come from the saved invitation. */
export function HeritageInvitation({
  draft,
  embedded = false,
  initialNow = Date.now(),
  slug,
  rsvp,
  localeOverride,
  contentOverride,
  guest,
  theme,
  sectionSlots = {},
  footerActions,
}: {
  draft: InvitationDraft;
  embedded?: boolean;
  initialNow?: number;
  slug?: string;
  rsvp?: ReactNode;
  localeOverride?: Content["locale"];
  contentOverride?: Content;
  guest?: string;
  theme?: Theme;
  sectionSlots?: Partial<Record<HeritageSectionRole, HeritageSectionSlot>>;
  footerActions?: ReactNode;
}) {
  // Legacy studio content already holds a resolved instant, including any
  // explicit DST-overlap offset and seconds. Do not resolve its wall time again.
  const sourceContent = contentOverride ?? platformContent(draft, slug);
  const locale = localeOverride ?? sourceContent.locale;
  const content = { ...sourceContent, locale };
  const copy = labels[locale];
  const date = eventDate(content);
  const wedding = draft.eventType === "wedding";
  const namedHosts = content.hosts.flatMap(({ name }, index) =>
    name.trim() ? [{ name, index }] : [],
  );
  const names = namedHosts.map(({ name }) => name);
  const namesLabel = names.join(` ${copy.and} `);
  const monogram = names.map((name) => Array.from(name.trim())[0]).join(" · ");
  const enabled = new Set(draft.enabledSections);
  const greeting =
    enabled.has("greeting") && draft.greeting.trim() ? draft.greeting : "";
  const story = enabled.has("story") ? draft.story?.trim() : "";
  const hasDate =
    enabled.has("date") && !!(content.date.start || content.date.day);
  const hasVenue =
    enabled.has("venue") &&
    !!(
      content.venue.name ||
      content.venue.address ||
      content.venue.note ||
      content.venue.mapUrl ||
      content.venue.coords
    );
  const hasTimeline = enabled.has("timeline") && content.timeline.length > 0;
  const dress = enabled.has("dressCode") ? content.dressCode : undefined;
  const hasDress = !!(dress?.title || dress?.note || dress?.swatches.length);
  const wishes = enabled.has("wishes") ? draft.wishes?.trim() : undefined;
  const hasRsvp = enabled.has("rsvp") && !!rsvp;
  const closing = enabled.has("closing") ? draft.closing.trim() : "";
  const hasSlot = (role: HeritageSectionRole) =>
    !!(
      sectionSlots[role]?.before ||
      sectionSlots[role]?.body ||
      sectionSlots[role]?.after
    );
  const firstSection =
    greeting || hasSlot("greeting")
      ? "greeting"
      : story || draft.media.length || hasSlot("story")
        ? "story"
        : hasDate || hasSlot("date")
          ? "date"
          : hasVenue || hasSlot("venue")
            ? "venue"
            : hasTimeline || hasSlot("timeline")
              ? "timeline"
              : hasDress || hasSlot("dressCode")
                ? "dressCode"
                : wishes || hasSlot("wishes")
                  ? "wishes"
                  : hasRsvp
                    ? "rsvp"
                    : "heritage-home";
  const calendar =
    hasDate && content.date.start ? calendarLinks(content) : undefined;
  const map = hasVenue
    ? (content.venue.mapUrl ??
      (content.venue.coords
        ? `https://www.openstreetmap.org/?mlat=${content.venue.coords[0]}&mlon=${content.venue.coords[1]}#map=16/${content.venue.coords.join("/")}`
        : undefined))
    : undefined;
  const mapTarget = map ? httpTarget(map) : undefined;
  const text = (value: string) => typograph(value, locale);
  const paragraphs = (value: string) =>
    value
      .split(/\n\s*\n/)
      .map((paragraph, index) => <p key={index}>{text(paragraph)}</p>);
  const body = (role: HeritageSectionRole, fallback?: ReactNode) => (
    <>
      {sectionSlots[role]?.before}
      {sectionSlots[role]?.body === undefined
        ? fallback
        : sectionSlots[role]?.body}
      {sectionSlots[role]?.after}
    </>
  );
  const canonicalFontId = draft.fontPairId === "ceremony" || draft.fontPairId === "poetic" || draft.fontPairId === "modernist" || draft.fontPairId === "gallery" ? draft.fontPairId : undefined;
  const canonicalType = canonicalFontId ? getTypeSet(canonicalFontId) : undefined;
  const style = theme
    ? ({
        ...toCssVars(theme),
        "--font-body": "var(--hp-body)",
        "--font-display": "var(--hp-display)",
        "--hp-paper": theme.palette.bg,
        "--hp-surface": theme.palette.surface,
        "--hp-ink": theme.palette.ink,
        "--hp-muted": theme.palette.muted,
        "--hp-red": theme.palette.accent,
        "--hp-gold": theme.palette.accentAlt,
        ...(canonicalType ? { "--hp-display": typeSetStackFor(canonicalType, "display"), "--hp-name-font": typeSetStackFor(canonicalType, "display"), "--hp-body": typeSetStackFor(canonicalType, "body") } : {}),
      } as CSSProperties)
    : undefined;
  const nav = [
    ...(story || draft.media.length || hasSlot("story")
      ? [{ id: "story", label: copy.story }]
      : []),
    ...(hasDate || hasSlot("date")
      ? [{ id: "date", label: wedding ? copy.weddingDate : copy.date }]
      : []),
    ...(hasVenue || hasSlot("venue")
      ? [{ id: "venue", label: copy.venue }]
      : []),
  ];

  return (
    <main
      className="hp-invitation heritage-invitation"
      data-template="heritage"
      data-studio-template="heritage"
      data-palette={draft.paletteId}
      data-font-pair={draft.fontPairId}
      data-motion={theme?.motion.preset ?? "unfold"}
      style={style}
      lang={locale === "uz-latn" ? "uz-Latn" : locale}
    >
      {canonicalFontId && <FontPreloads typeSet={canonicalFontId} locale={locale} />}
      <HeritageEntrance
        names={namesLabel || copy.invitation}
        date={hasDate ? date.full : ""}
        locale={locale}
        embedded={embedded}
        enabled={enabled.has("opening") && theme?.motion.preset !== "still"}
      >
        <a className="hp-skip" href="#heritage-home">
          {copy.skip}
        </a>
        <header className="hp-header">
          <div className="hp-header-inner">
            <a
              className="hp-brand"
              href="#heritage-home"
              aria-label={namesLabel || copy.invitation}
            >
              <span className="hp-brand-symbol" aria-hidden="true">
                囍
              </span>
              <span>{monogram || copy.invitation}</span>
            </a>
            <nav className="hp-nav" aria-label={copy.invitation}>
              {nav.map((item) => (
                <a key={item.id} href={`#${item.id}`}>
                  {item.label}
                </a>
              ))}
            </nav>
            {hasRsvp && (
              <a className="hp-nav-reply" href="#rsvp">
                {copy.rsvp}
              </a>
            )}
          </div>
        </header>
        <section
          className="hp-hero"
          id="heritage-home"
          data-section="hero"
          aria-labelledby="heritage-title"
        >
          <div className="hp-plum hp-hero-plum" aria-hidden="true" />
          <div className="hp-hanging-blossom" aria-hidden="true" />
          <div className="hp-lantern" aria-hidden="true" />
          <div className="hp-halo" aria-hidden="true" />
          <div className="hp-landscape hp-hero-landscape" aria-hidden="true" />
          <div className="hp-hero-inner">
            {sectionSlots.hero?.before}
            <span className="hp-hero-symbol" aria-hidden="true">
              囍
            </span>
            <p className="hp-eyebrow">
              {wedding ? copy.withFamily : copy.invitation}
            </p>
            <p className="hp-hero-subtitle">
              {wedding ? copy.wedding : copy.celebration}
            </p>
            <h1
              className="hp-names"
              data-long-names={
                names.some((name) => Array.from(name).length > 20) || undefined
              }
              id="heritage-title"
              tabIndex={-1}
              data-hp-focus
              aria-label={namesLabel || copy.invitation}
            >
              {names.length
                ? namedHosts.map(({ name, index: hostIndex }, index) => (
                    <span className="hp-name-part" key={index}>
                      {index > 0 && (
                        <span className="hp-name-join">{copy.and}</span>
                      )}
                      <span data-studio-field={`hosts.${hostIndex}.name`}>
                        {text(name)}
                      </span>
                    </span>
                  ))
                : copy.invitation}
            </h1>
            {content.headline && (
              <p className="hp-hero-headline" data-studio-field="headline">
                {text(content.headline)}
              </p>
            )}
            <FlowerDivider />
            {sectionSlots.hero?.body}
            <p className="hp-hero-motto">{copy.join}</p>
            {(hasDate || hasVenue) && (
              <div className="hp-hero-facts">
                {hasDate && (
                  <time dateTime={content.date.start || draft.date.day}>
                    {date.full}
                  </time>
                )}
                {hasDate && hasVenue && <span aria-hidden="true">·</span>}
                {hasVenue && (
                  <span>
                    {text(content.venue.name || content.venue.address)}
                  </span>
                )}
              </div>
            )}
            <div className="hp-hero-actions">
              {hasRsvp && (
                <a className="hp-button hp-button-primary" href="#rsvp">
                  {copy.reply}
                  <span aria-hidden="true">→</span>
                </a>
              )}
              {firstSection !== "heritage-home" && (
                <a
                  className="hp-button hp-button-outline"
                  href={`#${firstSection}`}
                >
                  {copy.more}
                </a>
              )}
            </div>
            {sectionSlots.hero?.after}
          </div>
          {firstSection !== "heritage-home" && (
            <a className="hp-scroll" href={`#${firstSection}`}>
              {copy.scroll}
              <span aria-hidden="true">↓</span>
            </a>
          )}
        </section>
        {(greeting || hasSlot("greeting")) && (
          <section
            id="greeting"
            className="hp-section hp-greeting"
            data-section="greeting"
          >
            {body(
              "greeting",
              greeting && (
                <div className="hp-container hp-greeting-inner">
                  <p className="hp-eyebrow">
                    {guest ? text(guest) : copy.hello}
                  </p>
                  <FlowerDivider />
                  <div className="hp-prose" data-studio-field="greeting">
                    {paragraphs(greeting)}
                  </div>
                </div>
              ),
            )}
          </section>
        )}
        {(story || draft.media.length > 0 || hasSlot("story")) && (
          <section
            id="story"
            className="hp-section hp-story"
            data-section="story"
          >
            {body(
              "story",
              <div className="hp-container">
                {story && (
                  <div className="hp-story-grid">
                    <div className="hp-story-art" aria-hidden="true">
                      <div className="hp-story-arch" />
                      <span className="hp-story-seal">囍</span>
                    </div>
                    <div className="hp-story-copy">
                      <p className="hp-eyebrow">01 / {copy.chapter}</p>
                      <h2 className="hp-heading">{copy.story}</h2>
                      <div className="hp-prose" data-studio-field="story">
                        {paragraphs(story)}
                      </div>
                      {namesLabel && (
                        <p className="hp-signature">{text(namesLabel)}</p>
                      )}
                    </div>
                  </div>
                )}
                {draft.media.length > 0 && (
                  <div className="hp-gallery">
                    <div className="hp-gallery-heading">
                      <p className="hp-eyebrow">{copy.moments}</p>
                      <h2 className="hp-heading">{copy.moments}</h2>
                      <FlowerDivider />
                    </div>
                    <div className="hp-gallery-grid">
                      {draft.media.map((image, index) => (
                        <figure key={image.id}>
                          {/* Full source is preserved: platform media does not carry a protected crop contract. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.src}
                            alt={`${copy.photo} ${index + 1}`}
                            loading="lazy"
                            decoding="async"
                          />
                          <figcaption>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            {copy.moments}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
              </div>,
            )}
          </section>
        )}
        {(hasDate || hasSlot("date")) && (
          <div
            id="date"
            className="hp-date-role"
            data-section="date"
            data-studio-section="date"
          >
            {body(
              "date",
              hasDate && (
                <>
                  <section
                    className="hp-section hp-date"
                    aria-labelledby="hp-date-title"
                  >
                    <div className="hp-container">
                      <div className="hp-section-top">
                        <p className="hp-eyebrow">02 / {copy.dateEyebrow}</p>
                        <h2 className="hp-heading" id="hp-date-title">
                          {wedding ? copy.weddingDate : copy.date}
                        </h2>
                        <FlowerDivider />
                      </div>
                      <div className="hp-date-layout">
                        <MonthCalendar content={content} />
                        <div className="hp-date-facts">
                          <div className="hp-date-detail">
                            <Icon name="date" />
                            <p className="hp-eyebrow">{date.weekday}</p>
                            <time
                              dateTime={content.date.start || draft.date.day}
                            >
                              {date.full}
                            </time>
                          </div>
                          {date.time && (
                            <div className="hp-date-detail">
                              <Icon name="time" />
                              <p className="hp-eyebrow">{copy.time}</p>
                              <p className="hp-event-time">{date.time}</p>
                              <p className="hp-timezone">
                                {draft.date.timezone}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {calendar && (
                        <div className="hp-calendar-actions">
                          <a
                            className="hp-button hp-button-outline"
                            href={calendar.google}
                            aria-label={`${copy.calendar} · Google Calendar`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {copy.calendar}
                            <span aria-hidden="true">↗</span>
                          </a>
                          <a
                            className="hp-text-link"
                            href={calendar.ics}
                            download={`${content.slug}.ics`}
                          >
                            {copy.download}
                            <span aria-hidden="true">↓</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </section>
                  {content.date.start && content.date.showCountdown && (
                    <div className="hp-countdown-band">
                      <p className="hp-eyebrow">{copy.dateEyebrow}</p>
                      <Countdown
                        date={content.date}
                        locale={locale}
                        initialNow={initialNow}
                        heading={wedding ? copy.untilWedding : copy.until}
                      />
                      <FlowerDivider />
                    </div>
                  )}
                </>
              ),
            )}
          </div>
        )}
        {(hasVenue || hasSlot("venue")) && (
          <section
            className="hp-section hp-venue"
            id="venue"
            data-section="venue"
          >
            {body(
              "venue",
              hasVenue && (
                <div className="hp-container hp-venue-grid">
                  <div className="hp-venue-art" aria-hidden="true">
                    <div className="hp-venue-art-inner" />
                    <span className="hp-venue-mark">囍</span>
                  </div>
                  <div className="hp-venue-copy">
                    <p className="hp-eyebrow">03 / {copy.place}</p>
                    <h2 className="hp-heading">{copy.venue}</h2>
                    <Icon name="pin" />
                    {content.venue.name && (
                      <h3 data-studio-field="venue.name">
                        {text(content.venue.name)}
                      </h3>
                    )}
                    {content.venue.address && (
                      <address data-studio-field="venue.address">
                        {text(content.venue.address)}
                      </address>
                    )}
                    {content.venue.note && (
                      <div
                        className="hp-prose hp-venue-note"
                        data-studio-field="venue.note"
                      >
                        {paragraphs(content.venue.note)}
                      </div>
                    )}
                    {mapTarget && (
                      <a
                        className="hp-button hp-button-primary"
                        href={mapTarget}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {copy.map}
                        <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </div>
                </div>
              ),
            )}
          </section>
        )}
        {(hasTimeline || hasSlot("timeline")) && (
          <section
            className="hp-section hp-programme"
            id="timeline"
            data-section="timeline"
          >
            {body(
              "timeline",
              hasTimeline && (
                <div className="hp-container hp-programme-grid">
                  <div className="hp-programme-heading">
                    <p className="hp-eyebrow">04 / {copy.timelineEyebrow}</p>
                    <h2 className="hp-heading">{copy.timeline}</h2>
                    <FlowerDivider />
                    <div className="hp-programme-floral" aria-hidden="true" />
                  </div>
                  <ol className="hp-timeline">
                    {content.timeline.map((item, index) => (
                      <li key={index}>
                        <time data-studio-field={`timeline.${index}.time`}>
                          {text(item.time)}
                        </time>
                        <div>
                          <h3 data-studio-field={`timeline.${index}.title`}>
                            {text(item.title)}
                          </h3>
                          {item.note && (
                            <p data-studio-field={`timeline.${index}.note`}>
                              {text(item.note)}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ),
            )}
          </section>
        )}
        {(hasDress || hasSlot("dressCode")) && (
          <section
            className="hp-section hp-dress"
            id="dressCode"
            data-section="dressCode"
          >
            {body(
              "dressCode",
              hasDress && (
                <div className="hp-container hp-dress-inner">
                  <p className="hp-eyebrow">05 / {copy.details}</p>
                  <h2
                    className="hp-heading"
                    data-studio-field="dressCode.title"
                  >
                    {text(dress?.title || copy.dressCode)}
                  </h2>
                  <FlowerDivider />
                  {dress?.note && (
                    <div
                      className="hp-prose"
                      data-studio-field="dressCode.note"
                    >
                      {paragraphs(dress.note)}
                    </div>
                  )}
                  {!!dress?.swatches.length && (
                    <ul className="hp-swatches">
                      {dress.swatches.map((swatch, index) => (
                        <li key={`${swatch}-${index}`}>
                          <span
                            style={{ backgroundColor: swatch }}
                            aria-label={`${copy.swatch} ${swatch}`}
                          />
                          <small>{swatch}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ),
            )}
          </section>
        )}
        {(wishes || hasSlot("wishes")) && (
          <section
            className="hp-section hp-wishes"
            id="wishes"
            data-section="wishes"
          >
            {body("wishes", wishes && <div className="hp-container">
              <h2 className="hp-heading">{copy.wishes}</h2>
              <div className="hp-prose" data-studio-field="wishes">{paragraphs(wishes)}</div>
            </div>)}
          </section>
        )}
        {(hasRsvp || hasSlot("rsvp")) && (
          <div
            className="hp-section hp-rsvp"
            data-section="rsvp"
            id={hasRsvp ? undefined : "rsvp"}
          >
            {body(
              "rsvp",
              hasRsvp && (
                <div className="hp-container hp-rsvp-grid">
                  <aside className="hp-rsvp-aside">
                    <span className="hp-rsvp-symbol" aria-hidden="true">
                      囍
                    </span>
                    <p className="hp-eyebrow">06 / RSVP</p>
                    <h2 className="hp-heading">{copy.rsvp}</h2>
                    <p>{copy.rsvpNote}</p>
                    <FlowerDivider />
                    {namesLabel && (
                      <p className="hp-signature">{text(namesLabel)}</p>
                    )}
                  </aside>
                  <div className="hp-rsvp-card">{rsvp}</div>
                </div>
              ),
            )}
          </div>
        )}
        {(closing || hasSlot("footer") || footerActions) && (
          <footer
            className="hp-section hp-footer"
            id="footer"
            data-section="footer"
          >
            {body(
              "footer",
              closing && (
                <div className="hp-container">
                  <span className="hp-footer-symbol" aria-hidden="true">
                    囍
                  </span>
                  <p className="hp-eyebrow">{copy.love}</p>
                  <h2 className="hp-heading">{copy.farewell}</h2>
                  <div className="hp-prose" data-studio-field="closing">
                    {paragraphs(closing)}
                  </div>
                  {namesLabel && (
                    <p className="hp-signature">{text(namesLabel)}</p>
                  )}
                  {hasDate && <p className="hp-footer-date">{date.full}</p>}
                </div>
              ),
            )}
            {footerActions}
          </footer>
        )}
        <div className="hp-endnote">
          <a href="#heritage-home">
            {copy.back}
            <span aria-hidden="true"> ↑</span>
          </a>
        </div>
      </HeritageEntrance>
    </main>
  );
}
