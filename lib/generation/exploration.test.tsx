import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { composeSeries } from "./series";
import { fixtureSeries } from "./fixture";
import { Content } from "@/lib/schema/content";
import { SignatureArt, signatureGeometry } from "@/components/craft/SignatureArt";

function exploration() {
  return { ...structuredClone(fixtureSeries), mode: "exploration", variants: fixtureSeries.variants.slice(0, 3).map((variant, index) => ({
    ...structuredClone(variant),
    direction: { palette: { ...fixtureSeries.style.palette, accentAlt: ["#738BA1", "#819682", "#938399"][index] }, typeSet: ["modernist", "poetic", "gallery"][index] },
    layout: { ...variant.layout, composition: ["duet", "ribbon", "imprint"][index] },
  })) };
}
describe("independent art directions", () => {
  it("keeps legacy series cohesive but persists three different exploration identities", () => {
    const legacy = composeSeries(fixtureSeries, "ru", []);
    expect(new Set(legacy.themes.map((theme) => theme.typeSet)).size).toBe(1);
    const result = composeSeries(exploration(), "ru", []);
    expect(result.mode).toBe("exploration");
    expect(result.themes.map((theme) => theme.typeSet)).toEqual(["modernist", "poetic", "gallery"]);
    expect(result.themes.map((theme) => theme.layout.composition)).toEqual(["duet", "ribbon", "imprint"]);
  });
  it("rejects undeclared overrides and identical directions", () => {
    expect(() => composeSeries({ ...exploration(), mode: "cohesive" }, "ru", [])).toThrow(/exploration/);
    const missing = exploration(); delete (missing.variants[1] as { direction?: unknown }).direction;
    expect(() => composeSeries(missing, "ru", [])).toThrow(/complete palette/);
    const repeated = exploration(); repeated.variants[1].direction = repeated.variants[0].direction;
    expect(() => composeSeries(repeated, "ru", [])).toThrow(/differ in visible/);
  });
  it("preserves photo constraints and rejects arbitrary direction code", () => {
    const invalid = exploration(); Object.assign(invalid.variants[0].direction, { css: "background:url(external)" });
    expect(() => composeSeries(invalid, "ru", [])).toThrow();
    const fakePhoto = exploration(); fakePhoto.variants[0].photos.push({ id: "invented", index: 0, section: "hero", position: "before" });
    expect(() => composeSeries(fakePhoto, "ru", [])).toThrow(/photo id/);
  });
});

const content = Content.parse({ slug: "personal-art", locale: "ru", eventType: "wedding", hosts: [{ name: "Хумоюн" }, { name: "Асаль" }], date: { start: "2027-02-28T18:23:00+05:00" }, venue: { name: "Hilton", address: "Ташкент" } });
describe("personal signature art", () => {
  it("repeats the same geometry consistently and varies with the event", () => {
    expect(signatureGeometry(content)).toEqual(signatureGeometry(structuredClone(content)));
    expect(signatureGeometry({ ...content, hosts: [{ name: "Рустам" }, { name: "Амина" }] })).not.toEqual(signatureGeometry(content));
    expect(signatureGeometry({ ...content, date: { ...content.date, start: "2027-03-01T18:23:00+05:00" } })).not.toEqual(signatureGeometry(content));
  });
  it("renders initials locally without scripts, external resources or duplicated event facts", () => {
    const svg = renderToStaticMarkup(<SignatureArt content={content} composition="imprint" />);
    expect(svg).toContain(">Х</text>"); expect(svg).toContain(">А</text>");
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toMatch(/<(?:script|image|foreignObject)\b|(?:href|onclick)=/);
    const hostile = renderToStaticMarkup(<SignatureArt content={{ ...content, hosts: [{ name: "<script>" }] }} composition="imprint" />);
    expect(hostile).toContain("&lt;"); expect(hostile).not.toContain("<script>");
  });
});
