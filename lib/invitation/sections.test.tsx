import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readInvitation } from "@/lib/projects/read";
import { Content } from "@/lib/schema/content";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { invitationSectionOrder, populatedSections } from "./sections";
import { compositionPhotos, hasHeroPhoto } from "@/lib/assets/layout";
import { directAsset, unusedAsset } from "@/lib/assets/crop";
import { exampleTheme } from "@/lib/materials/examples";

const demo = (await readInvitation("demo", "letter", "1"))!;
const short = Content.parse({ ...demo.content, hosts: [{ name: "Latifa" }], greeting: "", wishes: undefined, date: { start: "", day: "2026-07-12" }, venue: { name: "Мирас", address: "" }, timeline: [], rsvp: undefined, closing: "До встречи!", dressCode: { title: "Great Gatsby", swatches: ["#C8A84B"] } });
const grown = Content.parse({ ...short, greeting: "Описание события\n\nВторая часть описания", venue: { name: "Мирас", address: "Новый адрес", mapUrl: "https://example.com/map" }, timeline: [{ time: "19:00", title: "Встреча гостей" }], wishes: "Пожелания гостям\n\nПожалуйста, сообщите о важных деталях", rsvp: { enabled: true, mode: "phone", target: "+998901234567" } });
const themes = [demo.theme, { ...demo.theme, artwork: "none" as const, ornament: { ...demo.theme.ornament, pack: "none" as const, placement: [] }, layout: { ...demo.theme.layout, composition: "cinematic" as const } }, { ...demo.theme, artwork: "none" as const, ornament: { ...demo.theme.ornament, pack: "none" as const, placement: [] }, layout: { ...demo.theme.layout, composition: "portrait-story" as const } }, exampleTheme("silk-suite", short)!];

test("late description and location occupy their narrative places even in an old dress-first theme", () => {
  const old = ["hero", "dressCode", "venue", "footer"] as const;
  expect(invitationSectionOrder(grown, [...old])).toEqual(["hero", "greeting", "venue", "timeline", "dressCode", "wishes", "rsvp", "footer"]);
  expect(invitationSectionOrder(grown, ["hero", "rsvp", "wishes", "dressCode", "timeline", "venue", "greeting", "footer"])).toEqual(invitationSectionOrder(grown, [...old]));
  expect(invitationSectionOrder(short, ["hero", "footer"]).filter((id) => populatedSections(short).includes(id))).toEqual(["hero", "venue", "dressCode", "footer"]);
  expect(populatedSections({ ...short, venue: { name: "", address: "", mapUrl: "https://example.com/map" } })).toContain("venue");
});

test.each(themes)("%s renders a grown invitation in the same semantic order and remains empty when blocks are cleared", (source) => {
  const theme = { ...source, layout: { ...source.layout, sectionOrder: ["hero", "dressCode", "footer"] as ("hero" | "dressCode" | "footer")[] } };
  const html = renderToStaticMarkup(<ScrollNarrative content={grown} theme={theme} initialNow={0} embedded />);
  const order = ["hero", "greeting", "venue", "timeline", "dressCode", "wishes", "rsvp", "footer"];
  for (let i = 1; i < order.length; i++) {
    expect(html.indexOf(`id="${order[i]}"`)).toBeGreaterThan(html.indexOf(`id="${order[i - 1]}"`));
  }
  expect(html).toContain('data-studio-field="wishes"');
  expect(html).toContain("Новый адрес");
  const cleared = renderToStaticMarkup(<ScrollNarrative content={short} theme={theme} initialNow={0} embedded />);
  for (const absent of ["greeting", "wishes", "rsvp", "timeline"]) expect(cleared).not.toContain(`id="${absent}"`);
  expect(source.layout.sectionOrder).not.toEqual(theme.layout.sectionOrder);
});

test("explicitly moving a designed photo to location overrides its snapshot once without another generation", () => {
  const info = { width: 1200, height: 1600 };
  const asset = { ...unusedAsset("photo", info), quality: "high" as const, role: "portrait" as const, placement: { section: "greeting" as const, index: 0 } };
  const source = directAsset(asset, "/photo.webp", info, "none")!;
  const theme = { ...demo.theme, photos: [{ id: "photo", section: "hero" as const, index: 0, position: "after" as const }] };
  expect(compositionPhotos([source], theme)[0].photo.asset.placement?.section).toBe("hero");
  expect(hasHeroPhoto(theme, { assets: [asset], unifiedTreatment: "none" }, { photo: info })).toBe(true);
  const moved = { ...source, asset: { ...asset, placementPinned: true, placement: { section: "venue" as const, index: 2 } } };
  const effective = compositionPhotos([moved], theme);
  expect(effective).toHaveLength(1);
  expect(effective[0].photo.asset.placement?.section).toBe("venue");
  expect(hasHeroPhoto(theme, { assets: [moved.asset], unifiedTreatment: "none" }, { photo: info })).toBe(false);
  const html = renderToStaticMarkup(<ScrollNarrative content={grown} theme={theme} photos={[moved]} initialNow={0} embedded />);
  expect(html.match(/data-photo-id="photo"/g)).toHaveLength(1);
  expect(html.indexOf('data-photo-id="photo"')).toBeGreaterThan(html.indexOf('id="greeting"'));
  expect(html.indexOf('data-photo-id="photo"')).toBeLessThan(html.indexOf('id="timeline"'));
});

test("finale photographs come before the farewell and never extend the story beyond it", () => {
  const info = { width: 1024, height: 768 };
  const photo = directAsset({ ...unusedAsset("final", info), role: "gallery", placement: { section: "footer", index: 0 } }, "/final.webp", info, "none")!;
  for (const source of themes) {
    const theme = { ...source, photos: [{ id: "final", section: "footer" as const, index: 0, position: "after" as const }] };
    const html = renderToStaticMarkup(<ScrollNarrative content={short} theme={theme} photos={[photo]} initialNow={0} embedded />);
    expect(html.match(/data-photo-id="final"/g)).toHaveLength(1);
    expect(html.indexOf('data-photo-id="final"')).toBeLessThan(html.indexOf('data-studio-field="closing"'));
  }
});
