import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { Content } from "@/lib/schema/content";
import { Theme } from "@/lib/schema/theme";
import { ThemePatch } from "@/lib/schema/versions";
import { DesignSpec } from "@/lib/schema/designSpec";
import { compileDesignSpec, designSpecToCssVars } from "@/lib/design/spec";
import { contrastRatio } from "@/lib/theme/validate";
import { canonicalSectionOrder } from "@/lib/invitation/sections";
import { applyRefinement } from "./refine";
import { refinementTool, refineTheme } from "@/lib/ai/refineTheme";

const content = Content.parse(JSON.parse(readFileSync("projects/demo/content.json", "utf8")));
const context = { content, assetPlan: { assets: [], unifiedTreatment: "none" as const }, mediaInfo: {} };
const legacy = Theme.parse(JSON.parse(readFileSync("projects/demo/concepts/letter/v1.json", "utf8")));
legacy.layout.sectionOrder = canonicalSectionOrder(legacy.layout.sectionOrder);
function source() {
  const spec = DesignSpec.parse({
    design_title: "Письмо в шалфее", archetype: "ARCH_EDITORIAL", similarity_defense: "Арочное окно на льняной бумаге отличается от прошлой журнальной композиции.",
    canvas: { background_color: "#F5F2EB", text_color_primary: "#242220", text_color_muted: "#706A63", accent_color: "#B8976C", noise_opacity: .05, paper_texture: "cotton_deckle" },
    typography: { heading_font: "Cormorant Garamond", body_font: "Montserrat", heading_tracking: "tracking-tight", meta_tracking: "tracking-[0.2em]", italic_accent_words: ["и", "вместе"] },
    composition_rules: {
      hero_alignment: "center", card_framing: "arch_portal", photo_treatment: { mask_type: "soft_arch", overlay_blend: "none", overlay_tint: null },
      decorations: { wax_seal: { enabled: true, color: "#8A684E", symbol: "monogram", position: "hero_top" }, foil_lines: { enabled: true, style: "double_concentric" } },
    },
    component_manifest: { hero_layout_component: "arch", timeline_style: "minimal_thread", dresscode_style: "swatch_circles", rsvp_style: "classic_stationery_card" },
    graphics_generation: { needed: false, prompt: "", placement: "framed_illustration" },
  });
  return compileDesignSpec(spec, legacy);
}

describe("refinement of exact editorial specifications", () => {
  it("makes a legacy darker palette patch visible while preserving source and metadata", () => {
    const before = source();
    const snapshot = structuredClone(before);
    const result = applyRefinement(before, { palette: { bg: "#392A24", surface: "#48372F" } }, context);
    const spec = result.theme.designSpec!;
    const vars = designSpecToCssVars(spec);
    expect(spec.canvas.background_color).toBe("#392A24");
    expect(vars["--bg"]).toBe(result.theme.palette.bg);
    expect(vars["--ink"]).toBe(result.theme.palette.ink);
    expect(contrastRatio(result.theme.palette.ink, result.theme.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(result.theme.layout).toEqual(before.layout);
    expect(result.theme.meta).toEqual(before.meta);
    expect(result.theme.designSpec!.similarity_defense).toBe(before.designSpec!.similarity_defense);
    expect(before).toEqual(snapshot);
    expect(result.adjustments).toContain("Editorial stationery uses one paper tone; palette.bg applies to the canvas and paper surface.");
  });

  it("merges nested exact tokens without defaults, preserving every unrequested detail", () => {
    const before = source();
    const patch = { designSpec: { typography: { heading_font: "Playfair Display", italic_accent_words: ["и"] }, composition_rules: { decorations: { wax_seal: { color: "#75443B", symbol: "olive_wreath" } } } } };
    expect(ThemePatch.parse(patch)).toEqual(patch);
    const result = applyRefinement(before, patch, context);
    expect(result.theme.designSpec!.typography).toEqual({ ...before.designSpec!.typography, heading_font: "Playfair Display", italic_accent_words: ["и"] });
    expect(result.theme.designSpec!.composition_rules.decorations.wax_seal).toEqual({ ...before.designSpec!.composition_rules.decorations.wax_seal, color: "#75443B", symbol: "olive_wreath" });
    expect(result.theme.designSpec!.component_manifest).toEqual(before.designSpec!.component_manifest);
    expect(result.theme.photos).toEqual(before.photos);
    expect(result.theme.layout.sectionOrder).toEqual(before.layout.sectionOrder);
  });

  it("updates exact ink/muted/accent for legacy palette edits and exact foil for legacy removal", () => {
    const before = source();
    const result = applyRefinement(before, { palette: { ink: "#382A24", muted: "#645C53", accent: "#936B4B" }, foil: { enabled: false }, finishing: { type: "none" } }, context);
    expect(result.theme.designSpec!.canvas).toMatchObject({ text_color_primary: "#382A24", text_color_muted: "#645C53", accent_color: "#936B4B" });
    expect(result.theme.designSpec!.composition_rules.decorations.foil_lines.enabled).toBe(false);
    expect(result.theme.designSpec!.composition_rules.decorations.wax_seal).toEqual(before.designSpec!.composition_rules.decorations.wax_seal);
  });

  it("changes an explicitly selected archetype only with its registered matching hero", () => {
    const before = source();
    expect(() => applyRefinement(before, { designSpec: { archetype: "RAW_ASYMMETRIC" } }, context)).toThrow("Use poster");
    const result = applyRefinement(before, { designSpec: { archetype: "RAW_ASYMMETRIC", component_manifest: { hero_layout_component: "poster" } } }, context);
    expect(result.theme.layout.composition).toBe("poster");
    expect(result.theme.designSpec!.archetype).toBe("RAW_ASYMMETRIC");
  });

  it("allows moving existing original art but forbids new prompts, removal and asset replacement", () => {
    const before = source();
    before.designSpec!.graphics_generation = { needed: true, prompt: "Original botanical engraving on cotton stock.", placement: "framed_illustration" };
    const reference = { id: "72b0b3f7-f7ec-430d-a8bf-d84c43c67b88", sha256: "a".repeat(64), width: 1536, height: 1024, kind: "accent" as const };
    before.generatedVisual = reference;
    const result = applyRefinement(before, { designSpec: { graphics_generation: { placement: "floating_botanical" } } }, context);
    expect(result.theme.generatedVisual).toEqual(reference);
    expect(result.theme.designSpec!.graphics_generation).toEqual({ ...before.designSpec!.graphics_generation, placement: "floating_botanical" });
    expect(result.theme.layout.visualPlacement).toBe("side-right");
    for (const patch of [
      { designSpec: { graphics_generation: { prompt: "New art" } } },
      { designSpec: { graphics_generation: { needed: false } } },
      { generatedVisual: { ...reference, id: "invented" } },
    ]) expect(() => applyRefinement(before, patch, context)).toThrow();
  });

  it("rejects unsupported legacy fields instead of accepting invisible changes", () => {
    const before = source();
    for (const patch of [
      { typeSet: "modernist" }, { materialSet: "glass" }, { layout: { composition: "cinematic" } },
      { typographyScale: { displayScale: "monumental" } }, { atmosphere: { vignetteStrength: .3 } },
      { artwork: "suzani-atelier" }, { ornament: { pack: "art-deco" } },
      { finishing: { type: "silver-chrome" } }, { layout: { visualPlacement: "side-left" } },
    ]) expect(() => applyRefinement(before, patch, context)).toThrow();
  });

  it("maps legacy physicality/typographic controls and validates the final full specification", () => {
    const before = source();
    const result = applyRefinement(before, { atmosphere: { grainIntensity: .06 }, surface: { texture: "smooth", borderStyle: "double-hairline" }, typographyScale: { headlineTracking: "-0.04em", metaTracking: ".22em" } }, context);
    expect(result.theme.designSpec!.canvas).toMatchObject({ noise_opacity: .06, paper_texture: "smooth_vellum" });
    expect(result.theme.designSpec!.composition_rules.card_framing).toBe("double_fine_border");
    expect(result.theme.designSpec!.typography).toMatchObject({ heading_tracking: "tracking-[-0.04em]", meta_tracking: "tracking-[0.22em]" });
    expect(() => applyRefinement(before, { atmosphere: { grainIntensity: .1 } }, context)).toThrow();
    expect(() => applyRefinement(before, { typographyScale: { metaTracking: ".1em" } }, context)).toThrow();
    expect(() => applyRefinement(before, { designSpec: { composition_rules: { photo_treatment: { overlay_tint: "#AABBCC" } } } }, context)).toThrow("null tint");
  });

  it("protects metadata, natural pigments and the four-category edit limit", () => {
    const before = source();
    for (const patch of [
      { designSpec: { design_title: "New title" } }, { designSpec: { similarity_defense: "new story" } },
      { palette: { bg: "#000000" } }, { designSpec: { canvas: { text_color_primary: "#FFFFFF" } } },
      { designSpec: { canvas: {}, typography: {}, composition_rules: {}, component_manifest: {}, graphics_generation: {} } },
    ]) expect(() => applyRefinement(before, patch, context)).toThrow();
    expect(() => applyRefinement(before, { designSpec: { canvas: { background_color: before.palette.bg } } }, context)).toThrow("does not change");
    expect(() => applyRefinement(legacy, { designSpec: { canvas: { noise_opacity: .06 } } }, context)).toThrow("existing editorial");
  });

  it("rejects contradictory legacy/exact requests and records necessary contrast repair", () => {
    const before = source();
    expect(() => applyRefinement(before, { palette: { bg: "#EFE8DB" }, designSpec: { canvas: { background_color: "#C9D0B7" } } }, context)).toThrow("Conflicting");
    const result = applyRefinement(before, { designSpec: { canvas: { text_color_primary: before.palette.bg } } }, context);
    expect(result.adjustments.some((adjustment) => adjustment.includes("contrast"))).toBe(true);
    expect(result.theme.designSpec!.canvas.text_color_primary).toBe(result.theme.palette.ink);
  });

  it("advertises only partial exact choices while excluding metadata and generation controls", () => {
    const root = refinementTool().input_schema as { properties: { patch: { properties: { designSpec: { required: string[]; properties: Record<string, { required?: string[]; properties?: Record<string, unknown> }> } } } } };
    const exact = root.properties.patch.properties.designSpec;
    expect(exact.required).toEqual([]);
    expect(exact.properties).not.toHaveProperty("design_title");
    expect(exact.properties).not.toHaveProperty("similarity_defense");
    expect(exact.properties.canvas.required).toEqual([]);
    expect(exact.properties.graphics_generation.properties).toEqual({ placement: { type: "string", enum: ["hero_background", "framed_illustration", "floating_botanical"] } });
    expect(JSON.stringify(root)).not.toContain('"generatedVisual"');
  });

  it("uses the structured exact patch through the existing SDK with no new graphic call", async () => {
    const before = source();
    const output = { patch: { designSpec: { canvas: { noise_opacity: .06 }, component_manifest: { timeline_style: "vertical_cards" } } }, summary: "Усилена фактура бумаги и изменено оформление программы." };
    let calls = 0;
    let request: Record<string, unknown> = {};
    const client = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async (_url, options) => {
      calls++;
      request = JSON.parse(String(options?.body));
      return Response.json({ id: "msg_test", type: "message", role: "assistant", model: "test", content: [{ type: "tool_use", id: "tool_test", name: "emit_theme_patch", input: output }], stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } });
    } });
    const result = await refineTheme(before, "Сделай бумагу немного фактурнее и программу в карточках", context, client);
    expect(calls).toBe(1);
    expect(request.tool_choice).toEqual({ type: "tool", name: "emit_theme_patch" });
    expect(result.theme.designSpec!.canvas.noise_opacity).toBe(.06);
    expect(result.theme.designSpec!.component_manifest.timeline_style).toBe("vertical_cards");
    expect(result.theme.designSpec!.archetype).toBe(before.designSpec!.archetype);
    expect(result.theme.generatedVisual).toBe(before.generatedVisual);
    expect(request.system).toContain("never forced to pass novelty/anti-repeat rules again");
  });
});
