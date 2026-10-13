import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readInvitation } from "@/lib/projects/read";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { validateTheme } from "@/lib/theme/validate";
import { Content } from "@/lib/schema/content";

const demo = (await readInvitation("demo", "letter", "1"))!;
const scene = { id: "fa57d360-af18-4ab4-846f-5514a0bd4389", sha256: "a".repeat(64), width: 1024, height: 1536, isolated: false, kind: "scene" as const };
const theme = { ...demo.theme, artwork: "none" as const, generatedVisual: scene, ornament: { ...demo.theme.ornament, pack: "none" as const, placement: [] }, layout: { ...demo.theme.layout, composition: "immersive" as const } };
const content = Content.parse({ ...demo.content, eventType: "birthday", hosts: [{ name: "Latifa" }], headline: "Latifa’s great birthday celebration", date: { start: "", day: "2026-07-12" }, venue: { name: "Мирас", address: "" }, timeline: [], rsvp: undefined, greeting: "", closing: "a little party never killed somebody! See you!" });

test("scene cover retains editable identity/date and continues with quiet venue, dress code and closing", () => {
  expect(validateTheme(theme, { locale: "ru" }).ok).toBe(true);
  const html = renderToStaticMarkup(<ScrollNarrative content={content} theme={theme} initialNow={0} generatedVisual={{ src: "/art/test/scene", width: 1024, height: 1536 }} embedded />);
  expect(html).toContain('data-composition="immersive"');
  expect(html).toContain('data-studio-field="hosts.0.name"');
  expect(html).toContain('dateTime="2026-07-12"');
  expect(html).toContain("Мирас");
  expect(html).toContain("a little party never killed somebody!");
  expect(html).not.toContain('id="countdown"');
  expect(html).not.toContain("17:00");
  expect(html).not.toContain("30 лет");
  expect(html).not.toContain('data-blend="screen"');
});

test("a scene cannot be shrunk to a legacy ornament layout or relabelled as isolated art", () => {
  expect(validateTheme({ ...theme, layout: { ...theme.layout, composition: "letter" } }).ok).toBe(false);
  expect(validateTheme({ ...theme, generatedVisual: { ...scene, kind: undefined, isolated: true } }).ok).toBe(false);
});
