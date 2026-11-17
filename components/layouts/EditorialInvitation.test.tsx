import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorialInvitation } from "./EditorialInvitation";
import { safeEditorialMask } from "@/components/craft/EditorialMedia";
import { Content } from "@/lib/schema/content";
import { Theme } from "@/lib/schema/theme";
import { DesignSpec, DESIGN_ARCHETYPES, DESIGN_ARCHETYPE_COMPONENTS } from "@/lib/schema/designSpec";
import { compileDesignSpec } from "@/lib/design/spec";
import { directAsset, unusedAsset, type DirectedAsset } from "@/lib/assets/crop";
import { composeSeries } from "@/lib/generation/series";
import { fixtureSeries } from "@/lib/generation/fixture";

const content = Content.parse({ slug: "editorial-test", locale: "ru", eventType: "wedding", hosts: [{ name: "София" }, { name: "Александр" }], greeting: "Мы приглашают вас быть вместе.", date: { start: "2027-04-19T17:00:00+05:00" }, venue: { name: "Ботанический сад", address: "Ташкент", mapUrl: "https://example.com/map" }, timeline: [{ time: "17:00", title: "Сбор гостей" }], dressCode: { title: "Палитра", swatches: ["#A7AD95", "#BC926E"] }, wishes: "Приходите вместе", rsvp: { enabled: true, mode: "form", target: "https://example.com/rsvp", askGuestCount: true } });
const baseTheme = Theme.parse(composeSeries(fixtureSeries, "ru", []).themes[0]);
const spec = DesignSpec.parse({
  design_title: "Письмо из сада", archetype: "ARCH_EDITORIAL", similarity_defense: "Арочная бумага и гравированный мотив.",
  canvas: { background_color: "#F5F2EB", text_color_primary: "#2C2A29", text_color_muted: "#756F68", accent_color: "#A38561", noise_opacity: .05, paper_texture: "cotton_deckle" },
  typography: { heading_font: "Cormorant Garamond", body_font: "Montserrat", heading_tracking: "tracking-tight", meta_tracking: "tracking-[0.2em]", italic_accent_words: ["и", "вместе", "приглашают"] },
  composition_rules: { hero_alignment: "center", card_framing: "double_fine_border", photo_treatment: { mask_type: "soft_arch", overlay_blend: "none", overlay_tint: null }, decorations: { wax_seal: { enabled: true, color: "#8A6654", symbol: "monogram", position: "rsvp_badge" }, foil_lines: { enabled: true, style: "single_hairline" } } },
  component_manifest: { hero_layout_component: "arch", timeline_style: "minimal_thread", dresscode_style: "swatch_circles", rsvp_style: "classic_stationery_card" },
  graphics_generation: { needed: false, prompt: "", placement: "framed_illustration" },
});
const themed = (input = spec) => ({ ...compileDesignSpec(input, baseTheme), designSpec: input });
const markup = (event = content, input = spec, photos: DirectedAsset[] = []) => renderToStaticMarkup(<EditorialInvitation content={event} theme={themed(input)} initialNow={0} photos={photos} guest="Мадина" embedded />);

test("all five compositions keep live content, canonical sections and the guest response form", () => {
  for (const archetype of DESIGN_ARCHETYPES) {
    const design = { ...spec, archetype, component_manifest: { ...spec.component_manifest, hero_layout_component: DESIGN_ARCHETYPE_COMPONENTS[archetype] } };
    const rendered = markup(content, design);
    expect(rendered.match(/<h1 /g)).toHaveLength(1);
    expect(rendered).toContain(`data-design-archetype="${archetype}"`);
    expect(rendered).toContain('data-studio-field="hosts.0.name"');
    expect(rendered).toContain('data-studio-field="venue.name"');
    expect(rendered).toContain('name="attendance"');
    expect(rendered).toContain('value="Мадина"');
    expect(rendered).toContain('action="https://example.com/rsvp"');
    expect(rendered).toContain('class="editorial-italic-accent"');
    const ids = [...rendered.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toEqual(["hero", "greeting", "countdown", "venue", "timeline", "dressCode", "wishes", "rsvp", "footer"]);
  }
});

test("a sparse draft invents no date, venue or optional content and has no floating RSVP stamp", () => {
  const draft = Content.parse({ slug: "draft", locale: "ru", eventType: "wedding", hosts: [{ name: "София" }], date: { start: "" }, venue: { name: "", address: "" } });
  const rendered = markup(draft);
  expect(rendered).not.toContain("dateTime=");
  expect(rendered).not.toContain('data-section="venue"');
  expect(rendered).not.toContain('data-section="rsvp"');
  expect(rendered).not.toContain('data-seal-position="rsvp_badge"');
  expect(rendered).not.toContain('data-studio-field="venue.name"');
  expect(rendered).toContain('data-native-graphic="true"');
});

test("the calendar remains available with a date and RSVP disabled", () => {
  expect(markup({ ...content, rsvp: undefined })).toContain('class="invitation-calendar"');
  expect(markup({ ...content, rsvp: undefined })).toContain("Google Calendar");
});

test("shaped mounts preserve the asset director's crop and use a rectangular mat for clipped protected regions", () => {
  const asset = { ...unusedAsset("protected", { width: 1200, height: 1600 }), role: "portrait" as const, subject: "person" as const, quality: "high" as const, maxViewportShare: .75, placement: { section: "greeting" as const, index: 0 } };
  const photo = directAsset(asset, "/protected.jpg", { width: 1200, height: 1600 }, "none")!;
  for (const mask of ["soft_arch", "oval_portrait", "organic_edge"] as const) expect(safeEditorialMask(photo, mask)).toBe("rectangular_passepartout");
  const rendered = markup(content, spec, [photo]);
  expect(rendered.match(/data-photo-id="protected"/g)).toHaveLength(1);
  expect(rendered).toContain('data-effective-mask="rectangular_passepartout"');
  expect(rendered).toContain(`data-crop="${photo.crop.mode}"`);
  expect(rendered).toContain('data-photo-section="greeting"');
});

test("a central protected region can use each shaped silhouette without changing its crop", () => {
  const asset = { ...unusedAsset("central", { width: 1200, height: 1600 }), role: "portrait" as const, quality: "high" as const, placement: { section: "hero" as const, index: 0 }, safeArea: { x: .4, y: .4, w: .2, h: .2 } };
  const photo = directAsset(asset, "/central.jpg", { width: 1200, height: 1600 }, "none")!;
  for (const mask of ["soft_arch", "oval_portrait", "organic_edge"] as const) expect(safeEditorialMask(photo, mask)).toBe(mask);
});

test("a pinned photo-only venue occupies its semantic place without inventing a venue block", () => {
  const sparse = { ...content, venue: { name: "", address: "" }, rsvp: undefined };
  const asset = { ...unusedAsset("venue-detail", { width: 1100, height: 700 }), role: "story" as const, subject: "venue" as const, placementPinned: true, placement: { section: "venue" as const, index: 0 } };
  const photo = directAsset(asset, "/venue.jpg", { width: 1100, height: 700 }, "none")!;
  const rendered = markup(sparse, spec, [photo]);
  expect(rendered).toContain('id="venue"');
  expect(rendered).not.toContain('data-section="venue"');
  expect(rendered.indexOf('id="venue"')).toBeLessThan(rendered.indexOf('id="timeline"'));
});

test("generated artwork is used once with its prescribed placement and never becomes the event text", () => {
  const rendered = renderToStaticMarkup(<EditorialInvitation content={content} theme={themed({ ...spec, graphics_generation: { needed: true, prompt: "An original engraved botanical illustration", placement: "floating_botanical" } })} initialNow={0} generatedVisual={{ src: "/generated.png", width: 1024, height: 1536 }} embedded />);
  expect(rendered.match(/src="\/generated.png"/g)).toHaveLength(1);
  expect(rendered).toContain('data-graphics-placement="floating_botanical"');
  expect(rendered).toContain('data-media-source="generated"');
  expect(rendered).toContain('id="hero-title"');
});
