import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readInvitation } from "@/lib/projects/read";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { composeSeries } from "./series";
import { fixtureSeries } from "./fixture";
import { assertDistinctDesigns, designContext, designIdentity, differingDesignAxes } from "./diversity";
import { compileDesignSpec } from "@/lib/design/spec";
import { editorialExamples } from "@/lib/design/fixtures";

const theme = composeSeries(fixtureSeries, "ru", []).themes[0];
test("new colours, motion and metadata do not distinguish the same rendered design", () => {
  const changed = { ...theme, palette: { ...theme.palette, accent: "#839871" }, motion: { ...theme.motion, preset: "drift" as const }, meta: { ...theme.meta, name: "Другое название" }, typographyScale: { ...theme.typographyScale, headlineTracking: ".02em" } };
  expect(differingDesignAxes(designIdentity(theme), designIdentity(changed))).toEqual([]);
  expect(() => assertDistinctDesigns([designIdentity(changed)], [designIdentity(theme)])).toThrow(/TWO visible axes/);
});
test("a type change alone is rejected, while type and spatial composition can distinguish a new invitation", () => {
  const changed = { ...theme, typeSet: "poetic" as const };
  expect(() => assertDistinctDesigns([designIdentity(changed)], [designIdentity(theme)])).toThrow();
  expect(() => assertDistinctDesigns([designIdentity({ ...changed, layout: { ...changed.layout, composition: "poster" } })], [designIdentity(theme)])).not.toThrow();
});
test("unused ornament and photographic choices cannot fake diversity", () => {
  const plain = { ...theme, ornament: { ...theme.ornament, placement: [] } };
  expect(designIdentity({ ...plain, ornament: { ...plain.ornament, pack: "none" }, layout: { ...plain.layout, photoArrangement: "offset" } })).toEqual(designIdentity(plain));
});
test("invisible finishes and normalized single-photo positions cannot fake diversity", () => {
  const plain = { ...theme, foil: { ...theme.foil, enabled: false }, photos: [{ id: "a", section: "greeting" as const, position: "before" as const, index: 0 }] };
  const changed = { ...plain, finishing: { ...plain.finishing, type: "silver-chrome" as const }, layout: { ...plain.layout, photoArrangement: "offset" as const }, photos: [{ ...plain.photos[0], position: "after" as const }] };
  expect(designIdentity(changed)).toEqual(designIdentity(plain));
});
test("generated art needs a different visual language, not new colours, asset ids or adjectives", () => {
  const scene = { ...theme, layout: { ...theme.layout, composition: "immersive" as const } };
  const first = designIdentity(scene, true, "Original gold Art Deco architectural stepped fan geometry on black background");
  const recoloured = designIdentity(scene, true, "Elegant original silver Art Deco architectural stepped fan geometry on blue background");
  expect(differingDesignAxes(first, recoloured)).toEqual([]);
  const floral = designIdentity({ ...scene, typeSet: "poetic" }, true, "Dimensional botanical foliage roses peonies intertwined in an asymmetric garden");
  expect(() => assertDistinctDesigns([floral], [first])).not.toThrow();
  expect(designContext(first).graphic).toBe("generated:scene");
});
test("Organic Paper is explicit; unrelated materials and typography keep their own renderer", async () => {
  const organic = (await readInvitation("demo", "letter", "2"))!;
  expect(organic.theme.layout.composition).toBe("organic-paper");
  const opening = renderToStaticMarkup(<ScrollNarrative {...organic} initialNow={0} embedded />);
  expect(opening).toContain('class="invitation organic-paper"');
  expect(opening).toContain('paper-hero-branch');
  for (const composition of ["letter", "poster", "folio", "arch", "botanical"] as const) {
    const html = renderToStaticMarkup(<ScrollNarrative content={organic.content} theme={{ ...theme, layout: { ...theme.layout, composition } }} initialNow={0} embedded />);
    expect(html).not.toContain('class="invitation organic-paper"');
    expect(html).not.toContain('paper-hero-branch');
    expect(html).toContain('data-crafted="atelier"');
    expect(html).toContain(theme.palette.bg);
  }
});
test("native material labels that do not alter Organic Paper cannot count as a new design", async () => {
  const { theme: organic } = (await readInvitation("demo", "letter", "2"))!;
  expect(designIdentity({ ...organic, surface: { ...organic.surface, texture: "deep-velvet" } })).toEqual(designIdentity(organic));
});

test("a repeated archetype is allowed with a new visible mask and materially different paper", () => {
  const first = compileDesignSpec(editorialExamples.arch, theme);
  const changed = structuredClone(editorialExamples.arch);
  changed.canvas.background_color = "#D5DDC8";
  changed.composition_rules.photo_treatment.mask_type = "oval_portrait";
  const second = compileDesignSpec(changed, theme);
  expect(() => assertDistinctDesigns([designIdentity(second)], [designIdentity(first)])).not.toThrow();
  expect(designIdentity(first).spec?.mask_type).toBe("soft_arch");
});
test("tiny paper hex edits cannot bypass the combination prohibition", () => {
  const first = compileDesignSpec(editorialExamples.arch, theme);
  const changed = structuredClone(editorialExamples.arch);
  changed.canvas.background_color = "#F5F1EB";
  changed.typography.heading_font = "Playfair Display";
  changed.composition_rules.card_framing = "floating_minimal";
  expect(() => assertDistinctDesigns([designIdentity(compileDesignSpec(changed, theme))], [designIdentity(first)])).toThrow(/combination repeats/);
});
test("a hidden RSVP seal cannot count as a different native graphic", () => {
  const first = compileDesignSpec(editorialExamples.botanical, { ...theme, layout: { ...theme.layout, sectionOrder: ["hero", "footer"] } });
  const changed = structuredClone(first);
  changed.designSpec!.composition_rules.decorations.wax_seal.symbol = "minimal_crest";
  expect(designIdentity(changed)).toEqual(designIdentity(first));
});
