import type { ComponentProps, ReactNode } from "react";
import type { Content } from "@/lib/schema/content";
import type { InvitationDraft } from "@/lib/platform/schema";
import type { DirectedAsset } from "@/lib/assets/crop";
import type { SectionId } from "@/registry/keys";
import { compositionPhotos } from "@/lib/assets/layout";
import { labels } from "@/lib/invitation/locale";
import { typograph } from "@/lib/typography/ru";
import { HeritageInvitation } from "@/components/platform/HeritageInvitation";
import { DirectedImage } from "@/components/primitives/DirectedImage";
import { Rsvp } from "@/components/sections/Rsvp";
import type { StudioTemplateTheme } from "./StudioTemplateInvitation";

type HeritageProps = ComponentProps<typeof HeritageInvitation>;
type HeritageSlots = NonNullable<HeritageProps["sectionSlots"]>;

/** The studio keeps its own fact, photo and RSVP contracts. Only presentation
 * is shared with the platform; existing projects never become platform drafts. */
export function HeritageStudioInvitation({ content, theme, initialNow, photos = [], guest, embedded = false }: {
  content: Content;
  theme: StudioTemplateTheme;
  initialNow: number;
  photos?: DirectedAsset[];
  guest?: string;
  embedded?: boolean;
}) {
  const draft = heritageDraft(content, theme);
  const seen = new Set<string>();
  const directed = compositionPhotos(photos.filter(({ asset }) => asset.role !== "unused" && asset.placement), theme).filter(({ photo }) => {
    if (photo.asset.role === "unused" || !photo.asset.placement || seen.has(photo.asset.id)) return false;
    seen.add(photo.asset.id);
    return true;
  });
  const photoSet = (section: SectionId, position: "before" | "after"): ReactNode => {
    const placed = directed.filter(({ photo, position: side }) => photo.asset.placement?.section === section && side === position);
    return placed.length ? <div className="heritage-directed-photos" data-photo-section={section} data-position={position}>
      {placed.map(({ photo }, index) => <DirectedImage key={photo.asset.id} photo={photo} locale={content.locale} eager={section === "hero" && index === 0} />)}
    </div> : undefined;
  };
  const roles = { hero: "hero", greeting: "greeting", countdown: "date", venue: "venue", timeline: "timeline", dressCode: "dressCode", wishes: "wishes", rsvp: "rsvp", footer: "footer" } as const;
  const sectionSlots: HeritageSlots = {};
  for (const [section, role] of Object.entries(roles) as [SectionId, (typeof roles)[SectionId]][]) {
    const before = photoSet(section, "before");
    const after = photoSet(section, "after");
    if (before || after) sectionSlots[role] = { before, after };
  }
  if (content.wishes?.trim()) sectionSlots.wishes = { ...sectionSlots.wishes, body: <div className="hp-container hp-greeting-inner"><h2 className="hp-heading">{labels[content.locale].wishes}</h2><div className="hp-prose" data-studio-field="wishes">{content.wishes.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{typograph(paragraph, content.locale)}</p>)}</div></div> };
  if (!content.closing?.trim()) sectionSlots.footer = { ...sectionSlots.footer, body: <div className="hp-container"><h2 className="hp-heading">{labels[content.locale].footer}</h2><p className="hp-signature">{content.hosts.map(({ name }) => name).join(" & ")}</p></div> };
  return <HeritageInvitation
    draft={draft}
    slug={content.slug}
    theme={theme}
    contentOverride={content}
    localeOverride={content.locale}
    initialNow={initialNow}
    embedded={embedded}
    guest={guest}
    sectionSlots={sectionSlots}
    rsvp={content.rsvp?.enabled ? <Rsvp content={content} guest={guest} /> : undefined}
  />;
}

/** Calendar parts follow the event zone, never the server's local timezone.
 * Original Content is also passed to the renderer to preserve explicit offsets,
 * seconds and DST-overlap instants without another civil-time resolution. */
function heritageDraft(content: Content, theme: StudioTemplateTheme): InvitationDraft {
  let day = content.date.day ?? "";
  let time = "";
  if (content.date.start) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: content.date.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(content.date.start));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)!.value;
    day = `${part("year")}-${part("month")}-${part("day")}`;
    time = `${part("hour")}:${part("minute")}`;
  }
  const enabledSections: InvitationDraft["enabledSections"] = ["opening", "closing"];
  if (content.greeting?.trim()) enabledSections.push("greeting");
  if (day) enabledSections.push("date");
  if (content.venue.name || content.venue.address || content.venue.note || content.venue.mapUrl || content.venue.coords) enabledSections.push("venue");
  if (content.timeline.length) enabledSections.push("timeline");
  if (content.dressCode) enabledSections.push("dressCode");
  if (content.rsvp?.enabled) enabledSections.push("rsvp");
  return {
    title: content.headline || content.hosts.map(({ name }) => name).join(" & ") || "Приглашение",
    templateId: "heritage",
    paletteId: theme.studioTemplate.paletteId === "cinnabar" ? "cinnabar" : "ivory",
    fontPairId: theme.studioTemplate.fontPairId === "ceremony" ? "romantic" : "editorial",
    eventType: content.eventType,
    locale: content.locale === "uz-latn" ? "uz-latn" : "ru",
    names: content.hosts.map(({ name }) => name),
    date: { day, time, timezone: content.date.timezone, showCountdown: content.date.showCountdown },
    greeting: content.greeting ?? "",
    venue: content.venue,
    timeline: content.timeline,
    dressCode: content.dressCode,
    closing: content.closing ?? "",
    enabledSections,
    // The studio only exposes approved DirectedAsset placements, not uploads
    // that may have been marked unused or retained as design references.
    media: [],
  };
}
