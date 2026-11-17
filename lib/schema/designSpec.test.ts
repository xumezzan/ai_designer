import { describe, expect, it } from "vitest";
import { DesignSpec, DESIGN_ARCHETYPE_COMPONENTS } from "./designSpec";

function specification() {
  return {
    design_title: "Письмо в шалфее", archetype: "ARCH_EDITORIAL", similarity_defense: "Арочное окно на льняной бумаге отличается от прошлой журнальной композиции.",
    canvas: { background_color: "#F5F2EB", text_color_primary: "#242220", text_color_muted: "#756F68", accent_color: "#B8976C", noise_opacity: .05, paper_texture: "cotton_deckle" },
    typography: { heading_font: "Cormorant Garamond", body_font: "Montserrat", heading_tracking: "tracking-tight", meta_tracking: "tracking-[0.2em]", italic_accent_words: ["и", "вместе"] },
    composition_rules: {
      hero_alignment: "center", card_framing: "arch_portal",
      photo_treatment: { mask_type: "soft_arch", overlay_blend: "none", overlay_tint: null },
      decorations: { wax_seal: { enabled: true, color: "#8A684E", symbol: "monogram", position: "hero_top" }, foil_lines: { enabled: true, style: "double_concentric" } },
    },
    component_manifest: { hero_layout_component: "arch", timeline_style: "minimal_thread", dresscode_style: "swatch_circles", rsvp_style: "classic_stationery_card" },
    graphics_generation: { needed: false, prompt: "", placement: "framed_illustration" },
  };
}

describe("editorial design specification", () => {
  it("accepts the exact user JSON shape and a native design without an image prompt", () => {
    expect(DesignSpec.parse(specification()).graphics_generation).toEqual({ needed: false, prompt: "", placement: "framed_illustration" });
  });

  it.each(Object.entries(DESIGN_ARCHETYPE_COMPONENTS))("requires the registered %s hero (%s)", (archetype, component) => {
    const raw = specification();
    expect(DesignSpec.safeParse({ ...raw, archetype, component_manifest: { ...raw.component_manifest, hero_layout_component: component } }).success).toBe(true);
    expect(DesignSpec.safeParse({ ...raw, archetype, component_manifest: { ...raw.component_manifest, hero_layout_component: component === "arch" ? "letter" : "arch" } }).success).toBe(false);
  });

  it.each(["#FFFFFF", "#ffffff", "#000000", "url(x)", "#123", "#123456; color:red"])("rejects forbidden paper pigment %s", (color) => {
    const raw = specification();
    expect(DesignSpec.safeParse({ ...raw, canvas: { ...raw.canvas, background_color: color } }).success).toBe(false);
  });

  it("normalizes every pigment, including seal and overlay", () => {
    const raw = specification();
    const parsed = DesignSpec.parse({ ...raw, canvas: { ...raw.canvas, accent_color: "#b8976c" }, composition_rules: { ...raw.composition_rules, photo_treatment: { ...raw.composition_rules.photo_treatment, overlay_blend: "multiply", overlay_tint: "#d8d5cd" } } });
    expect(parsed.canvas.accent_color).toBe("#B8976C");
    expect(parsed.composition_rules.photo_treatment.overlay_tint).toBe("#D8D5CD");
  });

  it.each([.029, .071, Number.POSITIVE_INFINITY])("rejects noise outside tactile bounds: %s", (noise) => {
    const raw = specification();
    expect(DesignSpec.safeParse({ ...raw, canvas: { ...raw.canvas, noise_opacity: noise } }).success).toBe(false);
  });

  // Build the hostile URL token dynamically so Tailwind's source scanner never
  // treats this security-test payload as an actual utility stylesheet.
  it.each(["font-serif", ["tracking-", "[url(x)]"].join(""), "tracking-[3em]", "tracking-[0.2em] bg-red-500", "tracking-[var(--x)]", "tracking-[1px]"])("rejects arbitrary CSS/class tracking %s", (token) => {
    const raw = specification();
    expect(DesignSpec.safeParse({ ...raw, typography: { ...raw.typography, heading_tracking: token } }).success).toBe(false);
  });

  it.each(["tracking-[0.1em]", "tracking-[0.26em]"])("keeps metadata numeric tracking in 0.15–0.25em: %s", (token) => {
    const raw = specification();
    expect(DesignSpec.safeParse({ ...raw, typography: { ...raw.typography, meta_tracking: token } }).success).toBe(false);
  });

  it("requires an actual prompt when a bitmap is requested", () => {
    const raw = specification();
    expect(DesignSpec.safeParse({ ...raw, graphics_generation: { ...raw.graphics_generation, needed: true } }).success).toBe(false);
    expect(DesignSpec.safeParse({ ...raw, graphics_generation: { ...raw.graphics_generation, needed: true, prompt: "Original botanical engraving on cotton paper, empty centre, no lettering." } }).success).toBe(true);
  });

  it("rejects unsupported fonts, geometry and extra schema fields", () => {
    const raw = specification();
    expect(DesignSpec.safeParse({ ...raw, typography: { ...raw.typography, heading_font: "Cinzel" } }).success).toBe(false);
    expect(DesignSpec.safeParse({ ...raw, composition_rules: { ...raw.composition_rules, shadow: "huge" } }).success).toBe(false);
    expect(DesignSpec.safeParse({ ...raw, custom_css: "body {display:none}" }).success).toBe(false);
  });

  it("rejects latent tinted overlays and requires lyric accent words", () => {
    const raw = specification();
    expect(DesignSpec.safeParse({ ...raw, composition_rules: { ...raw.composition_rules, photo_treatment: { ...raw.composition_rules.photo_treatment, overlay_tint: "#C5A880" } } }).success).toBe(false);
    expect(DesignSpec.safeParse({ ...raw, typography: { ...raw.typography, italic_accent_words: [] } }).success).toBe(false);
  });
});
