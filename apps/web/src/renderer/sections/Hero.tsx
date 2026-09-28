"use client";
import { useSection } from "../context";
import { Body, Button, Eyebrow, Heading, Img, Reveal, Rule, Text } from "../primitives";

export function Hero() {
  const s = useSection();
  const p = s.props;
  const meta = (
    <div className="inv-hero-meta">
      <Text prop="date" value={p.date} as="span" placeholder="Date" />
      {p.date && p.venue ? <span className="inv-dot" /> : null}
      <Text prop="venue" value={p.venue} as="span" placeholder="Venue" />
    </div>
  );

  switch (s.variant) {
    case "split":
      return (
        <div className="inv-container inv-hero inv-hero-split">
          <Reveal className="inv-hero-copy">
            <Eyebrow value={p.eyebrow} />
            <Heading as="h1" value={p.heading} size="xl" />
            <Body value={p.subheading} prop="subheading" className="inv-lead" />
            {meta}
            <div className="inv-actions">
              <Button label={p.buttonLabel} href={p.buttonHref ?? "#rsvp"} />
            </div>
          </Reveal>
          <Reveal delay={120} className="inv-hero-media">
            <Img src={p.image} alt={p.imageAlt} ratio="4 / 5" />
          </Reveal>
        </div>
      );

    case "fullscreen":
      return (
        <div className="inv-hero inv-hero-full">
          <Img src={p.image} alt={p.imageAlt} fill className="inv-hero-bg" />
          <div className="inv-hero-scrim" />
          <Reveal className="inv-container inv-hero-full-copy">
            <Eyebrow value={p.eyebrow} />
            <Heading as="h1" value={p.heading} size="xl" />
            <Body value={p.subheading} prop="subheading" className="inv-lead" />
            {meta}
          </Reveal>
        </div>
      );

    case "editorial":
      return (
        <div className="inv-container inv-hero inv-hero-editorial">
          <Reveal className="inv-hero-editorial-top">
            <Eyebrow value={p.eyebrow} />
            <Heading as="h1" value={p.heading} size="xl" />
          </Reveal>
          <div className="inv-hero-editorial-grid">
            <Reveal delay={80} className="inv-hero-editorial-side">
              {meta}
              <Body value={p.subheading} prop="subheading" />
              <div className="inv-actions">
                <Button label={p.buttonLabel} href={p.buttonHref ?? "#rsvp"} variant="outline" />
              </div>
            </Reveal>
            <Reveal delay={160} className="inv-hero-editorial-media">
              <Img src={p.image} alt={p.imageAlt} ratio="3 / 2" />
            </Reveal>
          </div>
        </div>
      );

    case "minimal":
      return (
        <div className="inv-container inv-hero inv-hero-minimal">
          <Reveal>
            <Eyebrow value={p.eyebrow} />
            <Heading as="h1" value={p.heading} size="xl" />
            <Rule className="inv-rule-center" />
            {meta}
            <Body value={p.subheading} prop="subheading" className="inv-lead" />
          </Reveal>
        </div>
      );

    case "asymmetric":
      return (
        <div className="inv-container inv-hero inv-hero-asym">
          <Reveal className="inv-hero-asym-media">
            <Img src={p.image} alt={p.imageAlt} ratio="3 / 4" />
          </Reveal>
          <Reveal delay={120} className="inv-hero-asym-copy">
            <Eyebrow value={p.eyebrow} />
            <Heading as="h1" value={p.heading} size="xl" />
            <Body value={p.subheading} prop="subheading" />
            {meta}
            <div className="inv-actions">
              <Button label={p.buttonLabel} href={p.buttonHref ?? "#rsvp"} />
            </div>
          </Reveal>
        </div>
      );

    case "centered":
    default:
      return (
        <div className="inv-container inv-hero inv-hero-centered">
          <Reveal>
            <Eyebrow value={p.eyebrow} />
            <Heading as="h1" value={p.heading} size="xl" />
            <Body value={p.subheading} prop="subheading" className="inv-lead" />
            {meta}
            <div className="inv-actions">
              <Button label={p.buttonLabel} href={p.buttonHref ?? "#rsvp"} />
            </div>
          </Reveal>
          {p.image !== undefined && (
            <Reveal delay={150} className="inv-hero-centered-media">
              <Img src={p.image} alt={p.imageAlt} ratio="16 / 9" />
            </Reveal>
          )}
        </div>
      );
  }
}
