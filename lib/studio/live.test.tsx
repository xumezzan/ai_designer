import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readInvitation } from "@/lib/projects/read";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { Content } from "@/lib/schema/content";
import { directAsset, unusedAsset } from "@/lib/assets/crop";
import { exampleTheme } from "@/lib/materials/examples";
import { populatedSections } from "@/lib/invitation/sections";
import { canvasContent, editCanvasText } from "./live";

const demo = (await readInvitation("demo", "letter", "1"))!;
const draft = Content.parse({ ...demo.content, hosts: [{ name: "" }, { name: "" }], date: { start: "", timezone: "Asia/Tashkent", showCountdown: true }, venue: { name: "", address: "" }, greeting: "", timeline: [], dressCode: undefined, rsvp: undefined });

test("drafts render in narrative, wedding story and material scenes without invented dates or venues", () => {
  const themes = [demo.theme, { ...demo.theme, layout: { ...demo.theme.layout, composition: "keepsake" as const } }, exampleTheme("silk-suite", draft)!];
  for (const theme of themes) {
    const html = renderToStaticMarkup(<ScrollNarrative content={draft} theme={theme} initialNow={0} embedded />);
    expect(html).toContain('id="hero-title"');
    expect(html).not.toContain('id="venue"');
    expect(html).not.toContain('id="countdown"');
    expect(html).not.toContain('class="invitation-calendar"');
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Invalid Date");
  }
  expect(canvasContent(draft).hosts.map((host) => host.name)).toEqual(["Имя 1", "Имя 2"]);
  expect(draft.hosts[0].name).toBe("");
});

test("copy, date and location added after generation appear even when absent from original theme order", () => {
  const theme = { ...demo.theme, layout: { ...demo.theme.layout, sectionOrder: ["hero", "footer"] as ("hero" | "footer")[] } };
  const content = { ...demo.content, greeting: "Новая история" };
  const html = renderToStaticMarkup(<ScrollNarrative content={content} theme={theme} initialNow={0} embedded />);
  for (const section of populatedSections(content)) expect(html).toContain(`id="${section}"`);
  expect(html.indexOf('id="venue"')).toBeLessThan(html.indexOf('id="footer"'));
});

test("canvas edits only allowed copy, leaves original intact, and rejects invalid or excessive values", () => {
  const edited = editCanvasText(demo.content, "hosts.0.name", "Алина")!;
  expect(edited.hosts[0].name).toBe("Алина");
  expect(demo.content.hosts[0].name).toBe("Рустам");
  expect(editCanvasText(edited, "venue.address", "Новый адрес")?.venue.address).toBe("Новый адрес");
  expect(editCanvasText(edited, "greeting", "Привет\nВторая строка")?.greeting).toBe("Привет\nВторая строка");
  for (const field of ["slug", "media", "refs", "__proto__.name", "hosts.99.name", "date.start"]) expect(editCanvasText(edited, field, "test")).toBeNull();
  expect(editCanvasText(edited, "hosts.0.name", "x".repeat(101))).toBeNull();
  expect(editCanvasText(edited, "greeting", "x".repeat(10001))).toBeNull();
});


test("event photos added after designing are rendered without regenerating, including an otherwise empty section", () => {
  const info = { width: 1024, height: 768 };
  const photo = directAsset({ ...unusedAsset("new-photo", info), role: "portrait", placement: { section: "greeting", index: 0 } }, "/new-photo.webp", info, "none")!;
  const theme = { ...demo.theme, photos: [], layout: { ...demo.theme.layout, sectionOrder: ["hero", "footer"] as ("hero" | "footer")[] } };
  const html = renderToStaticMarkup(<ScrollNarrative content={draft} theme={theme} photos={[photo]} initialNow={0} embedded />);
  expect(html).toContain('data-photo-id="new-photo"');
  expect(html).toContain('data-crop="whole"');
  expect(html).not.toContain('class="greeting-copy"');
});
