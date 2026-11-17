import type { CSSProperties, ReactNode } from "react";
import type { InvitationDraft } from "@/lib/platform/schema";
import { platformContent } from "@/lib/platform-render/content";
import { platformTheme, resolvePlatformDesignSelection } from "@/lib/platform-render/theme";
import { resolveMoodProfile } from "@/registry/moodProfiles";
import { StudioTemplateInvitation } from "@/components/layouts/StudioTemplateInvitation";
import { HeritageInvitation } from "./HeritageInvitation";
import { SculptedGardenInvitation } from "./SculptedGardenInvitation";
import { MaterialSceneInvitation } from "./MaterialSceneInvitation";
import { InvitationExperience } from "@/components/craft/InvitationExperience";
import { toCssVars } from "@/lib/theme/toCssVars";
import { eventDate } from "@/lib/invitation/date";
import { typograph } from "@/lib/typography/ru";
import { greetingPageCopy } from "@/lib/templates/copy";
import "@/app/invitation.css";
import "@/app/atelier.css";
import "./invitation.css";

const storyCopy = {
  ru: {
    title: "Наша история",
    eyebrow: "С чего всё началось",
    gallery: "Наши мгновения",
    photo: "Фотография из нашей истории",
  },
  "uz-latn": {
    title: "Bizning hikoyamiz",
    eyebrow: "Hammasi qanday boshlandi",
    gallery: "Bizning lahzalarimiz",
    photo: "Hikoyamizdan surat",
  },
};

export function InvitationCanvas({
  draft,
  embedded = false,
  initialNow = Date.now(),
  slug,
  rsvp,
}: {
  draft: InvitationDraft;
  embedded?: boolean;
  initialNow?: number;
  slug?: string;
  rsvp?: ReactNode;
}) {
  const isGreeting = draft.purpose === "greeting";
  if (draft.artDirection) return <MaterialSceneInvitation draft={draft} initialNow={initialNow} slug={slug} rsvp={rsvp} />;
  if (!isGreeting && draft.templateId === "sculpted-garden") {
    return (
      <SculptedGardenInvitation
        draft={draft}
        embedded={embedded}
        initialNow={initialNow}
        slug={slug}
        rsvp={rsvp}
      />
    );
  }
  if (!isGreeting && draft.templateId === "heritage") {
    return (
      <HeritageInvitation
        draft={draft}
        embedded={embedded}
        initialNow={initialNow}
        slug={slug}
        rsvp={rsvp}
        theme={platformTheme(draft)}
      />
    );
  }
  const content = platformContent(draft, slug);
  const theme = platformTheme(draft);
  const usesComposedMotion = Boolean(draft.composition?.motionPreset);
  const moodProfile = draft.composition && resolveMoodProfile(resolvePlatformDesignSelection(draft));
  const greetingCopy = greetingPageCopy(content);
  const copy = isGreeting ? {
    title: greetingCopy.story,
    eyebrow: greetingCopy.storyEyebrow,
    gallery: greetingCopy.gallery,
    photo: greetingCopy.photo,
  } : storyCopy[draft.locale];
  const story = draft.enabledSections.includes("story")
    ? draft.story?.trim()
    : undefined;
  // Preserve the full uploaded image. The platform contract has no dimensions,
  // protected regions or quality assessment to justify an authored crop/mask.
  const openingImage = draft.composition ? draft.media[0] : undefined;
  const gallery = openingImage ? draft.media.slice(1) : draft.media;
  const galleryVariant = draft.composition?.sectionVariants.gallery;
  const scrollableGallery = galleryVariant === "filmstrip" && gallery.length > 1;
  const openingMedia = openingImage ? <figure className="platform-opening-photo" data-photo-id={openingImage.id} data-crop="whole" style={{ margin: "24px auto", maxWidth: "420px" }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={openingImage.src} alt={copy.photo} loading="eager" decoding="async" fetchPriority="high" style={{ display: "block", width: "auto", height: "auto", maxWidth: "100%", maxHeight: "46svh", objectFit: "contain", marginInline: "auto" }} />
  </figure> : undefined;
  const storySection =
    story || gallery.length ? (
      <section
        id="story"
        className="platform-story invitation-section"
        aria-labelledby="platform-story-title"
      >
        <p className="platform-section-eyebrow">
          {story ? copy.eyebrow : copy.gallery}
        </p>
        <h2 id="platform-story-title">{story ? copy.title : copy.gallery}</h2>
        {story && (
          <div className="platform-story-copy">
            {story.split(/\n\s*\n/).map((paragraph, index) => (
              <p data-level="body" key={index}>
                {typograph(paragraph, draft.locale)}
              </p>
            ))}
          </div>
        )}
        {gallery.length > 0 && (
          <div className="platform-gallery" data-gallery-variant={galleryVariant} role={scrollableGallery ? "region" : undefined} aria-label={scrollableGallery ? copy.gallery : undefined} tabIndex={scrollableGallery ? 0 : undefined}>
            {gallery.map((image, index) => (
              <figure key={image.id}>
                {/* Upload dimensions are not yet part of the platform content contract.
          Native image sizing preserves the entire source instead of inventing
          an asset director's crop, quality grade or safe area. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.src}
                  alt={`${copy.photo} ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        )}
      </section>
    ) : undefined;

  const page = <StudioTemplateInvitation
    content={content}
    theme={theme}
    initialNow={initialNow}
    embedded={embedded || !usesComposedMotion || !draft.enabledSections.includes("opening")}
    openingMedia={openingMedia}
    additionalSections={{
      story: storySection,
      rsvp: !isGreeting && draft.enabledSections.includes("rsvp") ? rsvp : undefined,
    }}
    closingEnabled={draft.enabledSections.includes("closing")}
  />;

  return (
    <div
      className="platform-canvas invitation"
      style={toCssVars(theme) as CSSProperties}
      lang={draft.locale === "ru" ? "ru" : "uz-Latn"}
    >
      {isGreeting || moodProfile || usesComposedMotion ? page : <InvitationExperience
        names={content.hosts.map(({ name }) => name).join(" & ")}
        monogram={content.hosts
          .map(({ name }) => Array.from(name.trim())[0])
          .filter(Boolean)
          .join("·")}
        date={eventDate(content).full}
        locale={content.locale}
        motion={draft.enabledSections.includes("opening") ? "unfold" : "still"}
        embedded={embedded}
      >
        {page}
      </InvitationExperience>}
    </div>
  );
}
