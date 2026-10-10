import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Content } from "../schema/content";
import { guestName } from "./guest";
import { calendarLinks } from "./calendar";
import { readInvitation } from "../projects/read";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { Rsvp } from "@/components/sections/Rsvp";

const demo = (await readInvitation("demo", "letter", "1"))!;

describe("personal invitations", () => {
  it("bounds display-only guest names without accepting repeated query values", () => {
    expect(guestName("  Алина\n  и Тимур\u202e  ")).toBe("Алина и Тимур");
    expect(guestName(["Алина", "Тимур"])).toBeUndefined();
    expect(guestName("  ")).toBeUndefined();
    expect(Array.from(guestName("😊".repeat(90))!)).toHaveLength(80);
  });
  it("escapes personalized text and preserves event facts", () => {
    const guest = '<img src=x onerror="alert(1)">';
    const html = renderToStaticMarkup(<ScrollNarrative {...demo} initialNow={0} guest={guest} />);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain('<img src="x"');
    expect(demo.content.hosts[0].name).toBe("Рустам");
  });
  it("keeps the complete native form without JavaScript and pre-fills a guest", () => {
    const content = Content.parse({ ...demo.content, rsvp: { mode: "form", target: "https://example.com/rsvp", askGuestCount: true } });
    const html = renderToStaticMarkup(<Rsvp content={content} guest="Алина" />);
    expect(html).toContain('value="Алина"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="attendance"');
    expect(html).toContain('name="guests"');
    expect(html).not.toContain(" hidden=");
    expect(html).not.toContain(" disabled=");
  });
});

describe("calendar handoff", () => {
  it("preserves the supplied instant and timezone without inventing an end time", () => {
    const links = calendarLinks(demo.content);
    const params = new URL(links.google).searchParams;
    expect(params.get("dates")).toBe("20270424T120000Z/20270424T120000Z");
    expect(params.get("ctz")).toBe("Asia/Tashkent");
    const ics = decodeURIComponent(links.ics.split(",")[1]);
    expect(ics).toContain("DTSTART:20270424T120000Z\r\n");
    expect(ics).not.toContain("DTEND");
  });
  it("escapes calendar control characters and folds Cyrillic by UTF-8 octets", () => {
    const content = Content.parse({ ...demo.content, headline: "Праздник; встречи, музыка\\танцы\n" + "Приглашение ".repeat(15) });
    const ics = decodeURIComponent(calendarLinks(content).ics.split(",")[1]);
    expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:Праздник\\; встречи\\, музыка\\\\танцы\\n");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).toContain("\r\n ");
  });
});
