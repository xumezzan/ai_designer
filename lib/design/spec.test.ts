import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Theme } from "@/lib/schema/theme";
import { DesignSpec, DESIGN_ARCHETYPE_COMPONENTS } from "@/lib/schema/designSpec";
import { contrastRatio, validateTheme } from "@/lib/theme/validate";
import { availableDesignComponents, compileDesignSpec, designSpecContext, designSpecToCssVars, paperToneFamily } from "./spec";

function specification() {
  return DesignSpec.parse({
    design_title: "Письмо в шалфее", archetype: "ARCH_EDITORIAL", similarity_defense: "Арочное окно на льняной бумаге отличается от прошлой журнальной композиции.",
    canvas: { background_color: "#F5F2EB", text_color_primary: "#242220", text_color_muted: "#756F68", accent_color: "#B8976C", noise_opacity: .05, paper_texture: "cotton_deckle" },
    typography: { heading_font: "Cormorant Garamond", body_font: "Montserrat", heading_tracking: "tracking-tight", meta_tracking: "tracking-[0.2em]", italic_accent_words: ["и", "вместе"] },
    composition_rules: {
      hero_alignment: "center", card_framing: "arch_portal", photo_treatment: { mask_type: "soft_arch", overlay_blend: "none", overlay_tint: null },
      decorations: { wax_seal: { enabled: true, color: "#8A684E", symbol: "monogram", position: "hero_top" }, foil_lines: { enabled: true, style: "double_concentric" } },
    },
    component_manifest: { hero_layout_component: "arch", timeline_style: "minimal_thread", dresscode_style: "swatch_circles", rsvp_style: "classic_stationery_card" },
    graphics_generation: { needed: false, prompt: "", placement: "framed_illustration" },
  });
}
const legacy = Theme.parse(JSON.parse(readFileSync("projects/demo/concepts/letter/v1.json", "utf8")));

describe("bounded design-spec compiler", () => {
  it("compiles a valid registered theme and persists the exact specification", () => {
    const spec = specification();
    const theme = compileDesignSpec(spec, legacy);
    expect(Theme.parse(theme).designSpec).toEqual(theme.designSpec);
    expect(validateTheme(theme, { locale: "ru" }).ok).toBe(true);
    expect(theme.layout).toMatchObject({ composition: "arch", preset: "scroll-narrative", hero: "typographic", visualPlacement: "inset" });
    expect(theme.palette).toMatchObject({ bg: spec.canvas.background_color, surface: spec.canvas.background_color, ink: spec.canvas.text_color_primary });
    expect(theme.meta.name).toBe(spec.design_title);
  });

  it.each(Object.entries(DESIGN_ARCHETYPE_COMPONENTS))("compiles %s to its actual %s component", (archetype, id) => {
    const original = specification();
    const spec = DesignSpec.parse({ ...original, archetype, component_manifest: { ...original.component_manifest, hero_layout_component: id } });
    expect(compileDesignSpec(spec, legacy).layout.composition).toBe(id);
  });

  it("preserves photo placements, semantic section order and motion without mutating inputs", () => {
    const base = { ...legacy, photos: [{ id: "owner-photo", section: "greeting" as const, index: 0, position: "before" as const }] };
    const spec = specification();
    const snapshot = structuredClone({ base, spec });
    const result = compileDesignSpec(spec, base);
    expect(result.photos).toEqual(snapshot.base.photos);
    expect(result.layout.sectionOrder).toEqual(snapshot.base.layout.sectionOrder);
    expect(result.motion.preset).toBe(base.motion.preset);
    expect({ base, spec }).toEqual(snapshot);
    expect(result.layout.composition).not.toBe("organic-paper");
  });

  it("repairs primary and small copy together in the saved specification and CSS vars", () => {
    const spec = specification();
    spec.canvas.text_color_primary = "#B8976C";
    spec.canvas.text_color_muted = "#C5BCAE";
    const result = compileDesignSpec(spec, legacy);
    const normalized = result.designSpec!;
    const vars = designSpecToCssVars(normalized);
    expect(contrastRatio(result.palette.ink, result.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(result.palette.muted, result.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(vars["--ink"]).toBe(result.palette.ink);
    expect(vars["--muted"]).toBe(result.palette.muted);
    expect(normalized.canvas.text_color_primary).not.toBe(spec.canvas.text_color_primary);
    expect(result.palette.accent).toBe(spec.canvas.accent_color);
  });

  it("removes old bitmap art when the resolved spec does not request it", () => {
    const visual = { id: "12345678-1234-4123-8123-123456789abc", sha256: "a".repeat(64), width: 1024, height: 1536 };
    const result = compileDesignSpec(specification(), { ...legacy, artwork: "suzani-atelier", generatedVisual: visual });
    expect(result.generatedVisual).toBeUndefined();
    expect(result.artwork).toBe("none");
    expect(result.ornament.pack).toBe("none");
    const spec = specification();
    spec.graphics_generation = { needed: true, prompt: "Botanical engraving on handmade cotton paper.", placement: "hero_background" };
    expect(compileDesignSpec(spec, { ...legacy, generatedVisual: visual }).generatedVisual).toEqual(visual);
  });

  it("publishes exact fonts, bounded tracking, seal and tint without duplicate grain", () => {
    const spec = specification();
    spec.typography.heading_font = "Playfair Display";
    spec.typography.body_font = "Jost";
    spec.typography.heading_tracking = "tracking-[-0.03em]";
    spec.typography.meta_tracking = "tracking-widest";
    spec.composition_rules.photo_treatment = { mask_type: "oval_portrait", overlay_blend: "soft_light", overlay_tint: "#BFB7A6" };
    const vars = designSpecToCssVars(spec);
    expect(vars["--font-display"]).toContain('"Playfair Display"');
    expect(vars["--font-body"]).toContain('"Jost"');
    expect(vars["--editorial-font-display"]).toBe(vars["--font-display"]);
    expect(vars["--font-display"]).toContain('"Cormorant Garamond"');
    expect(vars["--font-body"]).toContain('"Montserrat"');
    expect(vars["--inv-tracking-headline"]).toBe("-0.03em");
    expect(vars["--inv-tracking-meta"]).toBe("0.2em");
    expect(vars["--editorial-overlay-blend"]).toBe("soft-light");
    expect(vars["--editorial-overlay-tint"]).toBe("#BFB7A6");
    expect(vars["--editorial-noise-opacity"]).toBe("0.05");
    expect(vars["--grain-opacity"]).toBe("0");
    expect(vars["--grain-fine-opacity"]).toBe("0");
    expect(Object.keys(vars).every((key) => key.startsWith("--"))).toBe(true);
  });

  it("counts broad paper tones rather than insignificant hex changes", () => {
    expect(paperToneFamily("#F5F2EB")).toBe("linen");
    expect(paperToneFamily("#F6F2EC")).toBe("linen");
    expect(paperToneFamily("#FAF8F5")).toBe("linen");
    expect(paperToneFamily("#AAB29B")).toBe("sage");
    expect(paperToneFamily("#AD806E")).toBe("terracotta");
    expect(paperToneFamily("#392A24")).toBe("espresso");
    expect(paperToneFamily("#2C2A29")).toBe("graphite");
  });

  it("exposes actual component choices and a context without private names or prompts", () => {
    const inventory = availableDesignComponents();
    expect(inventory.hero_components).toHaveLength(5);
    expect(inventory.media_masks).toContain("organic_edge");
    const spec = specification();
    spec.design_title = "Private title";
    spec.graphics_generation = { needed: true, prompt: "Private original artwork direction", placement: "floating_botanical" };
    const context = designSpecContext(spec);
    expect(context).toMatchObject({ archetype: "ARCH_EDITORIAL", mask_type: "soft_arch", paper_tone: "linen", graphics_placement: "floating_botanical" });
    expect(JSON.stringify(context)).not.toContain("Private");
  });
});
