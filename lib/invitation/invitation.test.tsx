import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { demoConcepts, readInvitation } from "../projects/read";
import { Content } from "../schema/content";
import { contrastRatio, validateTheme } from "../theme/validate";
import { eventDate, remainingTime } from "./date";
import { rsvpTarget, httpTarget } from "./links";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { Rsvp } from "@/components/sections/Rsvp";

const now = Date.parse("2026-10-09T12:00:00Z");
const demo = await readInvitation("demo", "letter", "1");
if (!demo) throw new Error("Demo fixture missing");

describe("invitation time", () => {
  it("uses the event's timezone, including a different local calendar day", () => {
    const content = Content.parse({ ...demo.content, date: { start: "2027-04-24T22:30:00Z", timezone: "Asia/Tashkent" } });
    expect(eventDate(content)).toMatchObject({ day: "25", month: "апреля", time: "03:30" });
  });
  it("crosses a second boundary without going negative after the event", () => {
    const start = "2027-04-24T17:00:00+05:00";
    expect(remainingTime(start, Date.parse(start) - 90061000)).toMatchObject({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(remainingTime(start, Date.parse(start) + 1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, arrived: true });
  });
  it("rejects dates without offsets, invalid timezones and malformed RSVP dates", () => {
    expect(Content.safeParse({ ...demo.content, date: { start: "2027-04-24T17:00:00", timezone: "Asia/Tashkent" } }).success).toBe(false);
    expect(Content.safeParse({ ...demo.content, date: { ...demo.content.date, timezone: "Invented/Zone" } }).success).toBe(false);
    expect(Content.safeParse({ ...demo.content, rsvp: { ...demo.content.rsvp, deadline: "tomorrow-ish" } }).success).toBe(false);
  });
});

describe("invitation destinations", () => {
  it("builds Telegram and phone destinations without accepting injected protocols", () => {
    expect(rsvpTarget("telegram", "@family_host")).toBe("https://t.me/family_host");
    expect(rsvpTarget("phone", "+998 (90) 123-45-67")).toBe("tel:+998901234567");
    expect(() => rsvpTarget("telegram", "javascript:alert(1)")).toThrow();
    expect(() => httpTarget("javascript:alert(1)")).toThrow();
    expect(() => httpTarget("https://user:password@example.com")).toThrow();
  });
  it("renders an actual native POST form with labelled fields for a configured receiver", () => {
    const content = Content.parse({ ...demo.content, rsvp: { enabled: true, mode: "form", target: "https://example.com/rsvp", askGuestCount: true } });
    const html = renderToStaticMarkup(<Rsvp content={content} />);
    expect(html).toContain('action="https://example.com/rsvp"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="name"');
    expect(html).toContain('name="attendance"');
    expect(html).toContain('name="guests"');
    expect(html).toContain('for="guest-name"');
  });
  it("keeps an offset RSVP deadline on the event's local calendar day", () => {
    const content = Content.parse({ ...demo.content, rsvp: { ...demo.content.rsvp, deadline: "2027-01-01T00:00:00+05:00" } });
    const html = renderToStaticMarkup(<Rsvp content={content} />);
    expect(html).toContain("1 января");
    expect(html).not.toContain("31 декабря");
  });
});

describe("five hand-authored invitations", () => {
  it("renders the eight sections in each JSON's order, one foil element at most", async () => {
    const concepts = await demoConcepts();
    expect(concepts).toHaveLength(5);
    expect(new Set(concepts.map((concept) => concept.theme.layout.composition)).size).toBe(5);
    for (const concept of concepts) {
      const invitation = (await readInvitation("demo", concept.id, "1"))!;
      const { content, theme } = invitation;
      expect(invitation.adjustments).toEqual([]);
      expect(validateTheme(theme, { locale: content.locale }).ok).toBe(true);
      const html = renderToStaticMarkup(<ScrollNarrative content={content} theme={theme} initialNow={now} />);
      expect([...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1])).toEqual(theme.layout.sectionOrder);
      expect((html.match(/data-foil="true"/g) ?? []).length).toBe(theme.foil.enabled ? 1 : 0);
      expect(html).toContain("Рустам"); expect(html).toContain("Амина");
      expect(html).not.toContain("data-reveal-ready");
      for (const color of [theme.palette.ink, theme.palette.muted]) {
        for (const bg of [theme.palette.bg, theme.palette.surface]) expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(4.5);
      }
      if (theme.foil.enabled) expect(contrastRatio(theme.foil.color, theme.palette.bg)).toBeGreaterThanOrEqual(3);
    }
  });
  it("omits absent optional sections instead of inserting placeholder content", () => {
    const content = Content.parse({ ...demo.content, greeting: undefined, timeline: [], dressCode: undefined, rsvp: undefined, date: { ...demo.content.date, showCountdown: false } });
    const html = renderToStaticMarkup(<ScrollNarrative content={content} theme={demo.theme} initialNow={now} />);
    expect([...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1])).toEqual(["hero", "venue", "footer"]);
    expect(html).toContain('href="#venue"');
    expect(html).not.toContain('slot-greeting');
    expect(html).not.toContain('href="#greeting"');
  });
  it("renders all three locales with an explicit language and translated actions", () => {
    for (const locale of ["ru", "uz-latn", "en"] as const) {
      const html = renderToStaticMarkup(<ScrollNarrative content={{ ...demo.content, locale }} theme={demo.theme} initialNow={now} />);
      expect(html).toContain(`lang="${locale === "uz-latn" ? "uz-Latn" : locale}"`);
      expect(html).not.toContain("undefined");
    }
  });
  it("rejects duplicate sections and declared but unbuilt presets", () => {
    expect(validateTheme({ ...demo.theme, layout: { ...demo.theme.layout, sectionOrder: ["hero", "hero", "footer"] } }).ok).toBe(false);
    expect(validateTheme({ ...demo.theme, motion: { preset: "overture", ambient: "none" } }).ok).toBe(false);
    expect(validateTheme({ ...demo.theme, layout: { ...demo.theme.layout, preset: "card-stack" } }).ok).toBe(false);
  });
  it("cannot traverse outside projects using route parameters", async () => {
    expect(await readInvitation("../demo", "letter", "1")).toBeNull();
    expect(await readInvitation("demo", "../../letter", "1")).toBeNull();
    expect(await readInvitation("demo", "letter", "../content")).toBeNull();
    expect(await readInvitation("does-not-exist", "letter", "1")).toBeNull();
  });
});
