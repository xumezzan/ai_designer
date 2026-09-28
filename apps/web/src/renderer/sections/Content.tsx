"use client";
import { useEffect, useState } from "react";
import { useRenderer, useSection } from "../context";
import { Body, Button, Eyebrow, Heading, Img, Reveal, Rule, Text } from "../primitives";

/* ---------------------------------------------------------------- */
/* Story                                                             */
/* ---------------------------------------------------------------- */
export function Story() {
  const s = useSection();
  const p = s.props;
  if (s.variant === "centered") {
    return (
      <div className="inv-container inv-narrow inv-story-centered">
        <Reveal>
          <Eyebrow value={p.eyebrow} />
          <Heading value={p.heading} />
          <Body value={p.body} />
        </Reveal>
        {p.image !== undefined && (
          <Reveal delay={100} className="inv-mt-lg">
            <Img src={p.image} alt={p.imageAlt} ratio="3 / 2" />
          </Reveal>
        )}
      </div>
    );
  }
  if (s.variant === "columns") {
    return (
      <div className="inv-container inv-story-columns">
        <Reveal>
          <Eyebrow value={p.eyebrow} />
          <Heading value={p.heading} />
        </Reveal>
        <Reveal delay={100}>
          <Body value={p.body} />
        </Reveal>
      </div>
    );
  }
  return (
    <div className={`inv-container inv-story-split ${p.reverse ? "inv-reverse" : ""}`}>
      <Reveal className="inv-story-media">
        <Img src={p.image} alt={p.imageAlt} ratio="4 / 5" />
      </Reveal>
      <Reveal delay={120} className="inv-story-copy">
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
        <Body value={p.body} />
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Event details                                                     */
/* ---------------------------------------------------------------- */
export function EventDetails() {
  const s = useSection();
  const p = s.props;
  const details = p.details ?? [];
  return (
    <div className={`inv-container inv-details inv-details-${s.variant}`}>
      <Reveal className="inv-details-head">
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
        <Body value={p.body} />
      </Reveal>
      <div className="inv-details-grid">
        {details.map((d, i) => (
          <Reveal key={i} delay={i * 80} className="inv-detail">
            <Text prop={`details.${i}.label`} value={d.label} as="span" className="inv-label" placeholder="Label" />
            <Text prop={`details.${i}.value`} value={d.value} as="p" className="inv-detail-value" placeholder="Value" />
            <Text prop={`details.${i}.note`} value={d.note} as="p" className="inv-detail-note" placeholder="Note" />
          </Reveal>
        ))}
      </div>
      {p.buttonLabel && (
        <div className="inv-actions inv-center">
          <Button label={p.buttonLabel} href={p.buttonHref} variant="outline" />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Schedule                                                          */
/* ---------------------------------------------------------------- */
export function Schedule() {
  const s = useSection();
  const p = s.props;
  const items = p.items ?? [];
  return (
    <div className={`inv-container inv-narrow inv-schedule inv-schedule-${s.variant}`}>
      <Reveal className="inv-section-head">
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
      </Reveal>
      <ol className="inv-schedule-list">
        {items.map((it, i) => (
          <Reveal as="li" key={i} delay={i * 60} className="inv-schedule-item">
            <Text prop={`items.${i}.time`} value={it.time} as="span" className="inv-schedule-time" placeholder="Time" />
            <div>
              <Text prop={`items.${i}.title`} value={it.title} as="p" className="inv-schedule-title" placeholder="Title" />
              <Text prop={`items.${i}.description`} value={it.description} as="p" className="inv-schedule-desc" placeholder="Description" />
            </div>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Gallery                                                           */
/* ---------------------------------------------------------------- */
export function Gallery() {
  const s = useSection();
  const p = s.props;
  const images = p.images ?? [];
  const ratios = s.variant === "editorial" ? ["4 / 5", "3 / 2", "1 / 1", "3 / 4", "16 / 10", "4 / 5"] : [];
  return (
    <div className={`inv-gallery inv-gallery-${s.variant} ${s.variant === "strip" ? "" : "inv-container"}`}>
      {(p.heading || p.eyebrow) && (
        <Reveal className="inv-section-head inv-container">
          <Eyebrow value={p.eyebrow} />
          <Heading value={p.heading} />
        </Reveal>
      )}
      <div className="inv-gallery-grid">
        {images.map((im, i) => (
          <Reveal key={i} delay={i * 60} className={`inv-gallery-item inv-gi-${i % 6}`}>
            <Img
              prop={`images.${i}.src`}
              src={im.src ?? undefined}
              alt={im.alt}
              ratio={s.variant === "strip" ? "3 / 4" : ratios[i % 6] ?? "1 / 1"}
            />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Countdown                                                         */
/* ---------------------------------------------------------------- */
function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(t);
  }, []);
  const ts = target ? new Date(target).getTime() : NaN;
  const diff = Math.max(0, (isNaN(ts) ? 0 : ts) - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return { days, hours, minutes, valid: !isNaN(ts) };
}

export function Countdown() {
  const s = useSection();
  const p = s.props;
  const c = useCountdown(p.targetDate);
  const units = [
    ["Days", c.days],
    ["Hours", c.hours],
    ["Minutes", c.minutes],
  ] as const;
  return (
    <div className={`inv-container inv-countdown inv-countdown-${s.variant}`}>
      <Reveal>
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
        <div className="inv-countdown-units">
          {units.map(([label, v]) => (
            <div key={label} className="inv-countdown-unit">
              <span className="inv-countdown-num">{c.valid ? String(v).padStart(2, "0") : "—"}</span>
              <span className="inv-label">{label}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Quote                                                             */
/* ---------------------------------------------------------------- */
export function Quote() {
  const s = useSection();
  const p = s.props;
  return (
    <div className={`inv-container inv-narrow inv-quote inv-quote-${s.variant}`}>
      <Reveal>
        <Rule className="inv-rule-center" />
        <Text prop="quote" value={p.quote} as="blockquote" className="inv-quote-text" placeholder="Quote" multiline />
        <Text prop="attribution" value={p.attribution} as="cite" className="inv-quote-cite" placeholder="Attribution" />
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Map                                                               */
/* ---------------------------------------------------------------- */
export function MapSection() {
  const s = useSection();
  const p = s.props;
  const q = encodeURIComponent(p.mapQuery ?? p.address ?? p.venue ?? "");
  const { editable } = useRenderer();
  return (
    <div className={`inv-container inv-map inv-map-${s.variant}`}>
      <Reveal className="inv-map-copy">
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
        <Text prop="venue" value={p.venue} as="p" className="inv-detail-value" placeholder="Venue" />
        <Text prop="address" value={p.address} as="p" className="inv-body" placeholder="Address" multiline />
        <Body value={p.body} />
        <div className="inv-actions">
          <Button
            label={p.buttonLabel ?? "Open in Maps"}
            href={`https://www.google.com/maps/search/?api=1&query=${q}`}
            variant="outline"
          />
        </div>
      </Reveal>
      <Reveal delay={100} className="inv-map-frame">
        {q && !editable ? (
          <iframe
            title="Map"
            loading="lazy"
            src={`https://www.google.com/maps?q=${q}&output=embed`}
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="inv-img-placeholder inv-map-placeholder">
            <span>{q ? "Map preview" : "Add an address"}</span>
          </div>
        )}
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Dress code                                                        */
/* ---------------------------------------------------------------- */
export function DressCode() {
  const s = useSection();
  const p = s.props;
  const swatches = (p.swatches as string[] | undefined) ?? [];
  return (
    <div className="inv-container inv-narrow inv-dress">
      <Reveal>
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
        <Text prop="dressCode" value={p.dressCode} as="p" className="inv-detail-value" placeholder="Dress code" />
        <Body value={p.body} />
        {s.variant === "swatches" && swatches.length > 0 && (
          <div className="inv-swatches">
            {swatches.map((c, i) => (
              <span key={i} className="inv-swatch" style={{ background: c }} />
            ))}
          </div>
        )}
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Speakers                                                          */
/* ---------------------------------------------------------------- */
export function Speakers() {
  const s = useSection();
  const p = s.props;
  const speakers = p.speakers ?? [];
  return (
    <div className={`inv-container inv-speakers inv-speakers-${s.variant}`}>
      <Reveal className="inv-section-head">
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
        <Body value={p.body} />
      </Reveal>
      <div className="inv-speakers-grid">
        {speakers.map((sp, i) => (
          <Reveal key={i} delay={i * 60} className="inv-speaker">
            <Img prop={`speakers.${i}.image`} src={sp.image} ratio="1 / 1" />
            <Text prop={`speakers.${i}.name`} value={sp.name} as="p" className="inv-speaker-name" placeholder="Name" />
            <Text prop={`speakers.${i}.role`} value={sp.role} as="p" className="inv-speaker-role" placeholder="Role" />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Text / Image / Divider                                            */
/* ---------------------------------------------------------------- */
export function TextBlock() {
  const s = useSection();
  const p = s.props;
  return (
    <div className={`inv-container inv-narrow inv-textblock inv-textblock-${s.variant}`}>
      <Reveal>
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
        <Body value={p.body} />
      </Reveal>
    </div>
  );
}

export function ImageBlock() {
  const s = useSection();
  const p = s.props;
  return (
    <div className={s.variant === "full" ? "inv-image-full" : "inv-container inv-image-contained"}>
      <Reveal>
        <Img src={p.image} alt={p.imageAlt} ratio={s.variant === "full" ? "21 / 9" : "3 / 2"} />
        <Text prop="note" value={p.note} as="p" className="inv-caption" placeholder="Caption" />
      </Reveal>
    </div>
  );
}

export function Divider() {
  const s = useSection();
  if (s.variant === "space") return <div className="inv-divider-space" />;
  return (
    <div className="inv-container inv-divider">
      {s.variant === "ornament" ? <span className="inv-ornament">✦</span> : <hr />}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Contact / Footer                                                  */
/* ---------------------------------------------------------------- */
export function Contact() {
  const s = useSection();
  const p = s.props;
  return (
    <div className="inv-container inv-narrow inv-contact">
      <Reveal>
        <Eyebrow value={p.eyebrow} />
        <Heading value={p.heading} />
        <Body value={p.body} />
        <div className="inv-contact-lines">
          <Text prop="email" value={p.email} as="p" placeholder="Email" />
          <Text prop="phone" value={p.phone} as="p" placeholder="Phone" />
        </div>
      </Reveal>
    </div>
  );
}

export function Footer() {
  const s = useSection();
  const p = s.props;
  return (
    <div className={`inv-container inv-footer inv-footer-${s.variant}`}>
      <Text
        prop="heading"
        value={p.heading}
        as="p"
        className={s.variant === "signature" ? "inv-heading inv-heading-md" : "inv-footer-title"}
        placeholder="Names / event"
      />
      <Text prop="body" value={p.body} as="p" className="inv-footer-note" placeholder="Closing note" />
      {(p.socials ?? []).length > 0 && (
        <div className="inv-socials">
          {(p.socials ?? []).map((so, i) => (
            <a key={i} href={so.href}>
              {so.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
