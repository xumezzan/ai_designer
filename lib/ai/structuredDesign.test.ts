import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Content } from "@/lib/schema/content";
import { DesignSpec } from "@/lib/schema/designSpec";
import { directAsset, unusedAsset } from "@/lib/assets/crop";
import { composeSpecification } from "@/lib/generation/designSpec";
import { designIdentity } from "@/lib/generation/diversity";
import { availableDesignComponents } from "@/lib/design/spec";
import { generateSeries } from "./generateSeries";
import { generateVisual } from "./generateVisual";

// A real SDK still serializes the tool transport, but both providers are
// controlled. These tests never request a paid or external image.
vi.mock("./generateVisual", () => ({ generateVisual: vi.fn() }));
beforeEach(() => {
  vi.mocked(generateVisual).mockReset().mockImplementation(async () => { throw new Error("An unplanned image request reached the test boundary"); });
});

type JsonSchema = { type?: string; properties?: Record<string, JsonSchema>; required?: string[]; additionalProperties?: boolean; enum?: unknown[]; items?: JsonSchema; minItems?: number; maxItems?: number };
type RequestPayload = {
  system: string; tool_choice: unknown; tools: { name: string; input_schema: JsonSchema }[];
  messages: { role: string; content: { type: string; text?: string; source?: unknown }[] }[];
};
const message = (input: unknown) => ({ id: "msg_structured_test", type: "message", role: "assistant", model: "claude-sonnet-4-6", content: [{ type: "tool_use", id: "tool_spec", name: "emit_design_series", input }], stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
function provider(...outputs: unknown[]) {
  const requests: RequestPayload[] = [];
  const transport = vi.fn<typeof fetch>(async (_url, options) => {
    requests.push(JSON.parse(String(options?.body)) as RequestPayload);
    return Response.json(message(outputs[Math.min(requests.length - 1, outputs.length - 1)]));
  });
  return { requests, transport, sdk: new Anthropic({ apiKey: "test-only", maxRetries: 0, fetch: transport }) };
}
function event(brief = "Арочная редакционная композиция на льняной бумаге.") {
  return Content.parse({ slug: "structured-tests", locale: "ru", eventType: "wedding", hosts: [{ name: "" }],
    date: { start: "", timezone: "Asia/Tashkent", showCountdown: false }, venue: { name: "", address: "" },
    timeline: [], brief, variantCount: 1 });
}
function specification() {
  return DesignSpec.parse({
    design_title: "Льняной архив", archetype: "ARCH_EDITORIAL", similarity_defense: "Арочная форма, двойное паспарту и холодная хлопковая фактура образуют самостоятельную композицию.",
    canvas: { background_color: "#F5F2EB", text_color_primary: "#242220", text_color_muted: "#5D5A51", accent_color: "#B8976C", noise_opacity: .05, paper_texture: "cotton_deckle" },
    typography: { heading_font: "Cormorant Garamond", body_font: "Montserrat", heading_tracking: "tracking-tight", meta_tracking: "tracking-[0.2em]", italic_accent_words: ["и", "вместе"] },
    composition_rules: { hero_alignment: "center", card_framing: "arch_portal", photo_treatment: { mask_type: "soft_arch", overlay_blend: "none", overlay_tint: null },
      decorations: { wax_seal: { enabled: true, color: "#8A684E", symbol: "monogram", position: "hero_top" }, foil_lines: { enabled: true, style: "double_concentric" } } },
    component_manifest: { hero_layout_component: "arch", timeline_style: "minimal_thread", dresscode_style: "swatch_circles", rsvp_style: "classic_stationery_card" },
    graphics_generation: { needed: false, prompt: "", placement: "framed_illustration" },
  });
}
function emptyFacts() {
  return { eventType: null, hosts: null, headline: null, day: null, venue: null, venueAddress: null, venueNote: null,
    venueMapUrl: null, greeting: null, wishes: null, timeline: null, closing: null, dressCode: null };
}
const envelope = (design_spec = specification()) => ({ facts: null, design_spec, photos: [] });

describe("structured haute-design generation", () => {
  it("uses the strict facts/spec/photos transport and preserves grounded facts and owner photos", async () => {
    const content = event("Анна и Иван приглашают на свадьбу. Приходите праздновать вместе. Арочная композиция на хлопковой бумаге.");
    const info = { width: 1600, height: 2000 };
    const photo = directAsset({ ...unusedAsset("owner-photo", info), role: "portrait", quality: "high", placement: { section: "greeting", index: 0 } }, "/owner-photo.webp", info, "none")!;
    const spec = specification();
    const facts = { ...emptyFacts(), hosts: { value: ["Анна", "Иван"], source: "Анна и Иван" }, greeting: { value: "Приходите праздновать вместе.", source: "Приходите праздновать вместе." } };
    const photos = [{ id: photo.asset.id, section: "greeting", index: 0, position: "before" }];
    const mock = provider({ facts, design_spec: spec, photos });
    const result = await generateSeries(content, [photo], [{ base64: "dGVzdA==" }], mock.sdk, { structuredDesign: true });

    expect(mock.transport).toHaveBeenCalledTimes(1);
    expect(result.themes).toHaveLength(1);
    expect(result.themes[0].designSpec).toEqual(spec);
    expect(result.themes[0].photos).toEqual(photos);
    expect(result.themes[0].layout.sectionOrder).toContain("greeting");
    expect(result.facts?.hosts?.value).toEqual(["Анна", "Иван"]);
    expect(result.facts?.greeting?.source).toBe("Приходите праздновать вместе.");
    expect(result.references).toBe(1);
    expect(result.visual).toBeUndefined();
    expect(generateVisual).not.toHaveBeenCalled();
    expect(mock.requests[0].tool_choice).toEqual({ type: "tool", name: "emit_design_series" });
    const schema = mock.requests[0].tools[0].input_schema;
    expect(schema.required).toEqual(["facts", "design_spec", "photos"]);
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties!)).toEqual(["facts", "design_spec", "photos"]);
    expect(schema.properties!.design_spec.additionalProperties).toBe(false);
    expect(schema.properties!.photos).toMatchObject({ minItems: 1, maxItems: 1 });
    expect(schema.properties!.photos.items!.properties!.id.enum).toEqual([photo.asset.id]);
    expect(JSON.stringify(mock.requests[0].messages)).toContain('"media_type":"image/jpeg"');
  });

  it("skips the image provider when the resolved specification needs no graphic, even when permission is enabled", async () => {
    const mock = provider(envelope());
    const result = await generateSeries(event(), [], [], mock.sdk, { structuredDesign: true, createVisual: true });
    expect(result.themes[0].designSpec?.graphics_generation.needed).toBe(false);
    expect(result.themes[0].generatedVisual).toBeUndefined();
    expect(result.style.generatedVisual).toBeUndefined();
    expect(result.visual).toBeUndefined();
    expect(mock.transport).toHaveBeenCalledTimes(1);
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("corrects an invalid specification exactly once and retains the strict transport on retry", async () => {
    const invalid = { ...specification(), canvas: { ...specification().canvas, background_color: "#FFFFFF" } };
    const mock = provider({ facts: null, design_spec: invalid, photos: [] }, envelope());
    const result = await generateSeries(event(), [], [], mock.sdk, { structuredDesign: true });
    expect(result.themes[0].designSpec?.canvas.background_color).toBe("#F5F2EB");
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mock.requests[1].messages)).toContain("Previous output was invalid");
    expect(JSON.stringify(mock.requests[1].messages)).toContain("natural paper tone");
    expect(mock.requests[1].tools[0].input_schema.required).toEqual(["facts", "design_spec", "photos"]);
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("fails after two invalid specs rather than creating an unrelated fallback", async () => {
    const mock = provider({ facts: null, design_spec: {}, photos: [] });
    await expect(generateSeries(event(), [], [], mock.sdk, { structuredDesign: true })).rejects.toMatchObject({ status: 502 });
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("rejects a legacy or bare specification response when the structured transport was requested", async () => {
    const mock = provider(specification(), { facts: null, style: {}, variants: [] });
    await expect(generateSeries(event(), [], [], mock.sdk, { structuredDesign: true })).rejects.toMatchObject({ status: 502 });
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("corrects unexpected root transport fields rather than silently ignoring them", async () => {
    const mock = provider({ ...envelope(), custom_css: "body { display:none }" }, envelope());
    const result = await generateSeries(event(), [], [], mock.sdk, { structuredDesign: true });
    expect(result.themes[0].designSpec?.design_title).toBe("Льняной архив");
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mock.requests[1].messages)).toContain("custom_css");
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("rejects a needed graphic before the image boundary when creation was disabled", async () => {
    const spec = specification();
    spec.graphics_generation = { needed: true, prompt: "Fine-art botanical engraving, isolated olive sprig, no text or people.", placement: "framed_illustration" };
    const mock = provider(envelope(spec));
    await expect(generateSeries(event(), [], [], mock.sdk, { structuredDesign: true, createVisual: false })).rejects.toMatchObject({ status: 502 });
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mock.requests[1].messages)).toContain("Graphics creation was not selected");
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("can resolve a disabled-graphic correction into native decoration without requesting an image", async () => {
    const invalid = specification();
    invalid.graphics_generation = { needed: true, prompt: "Fine-art botanical engraving on matte cotton.", placement: "floating_botanical" };
    const mock = provider(envelope(invalid), envelope());
    const result = await generateSeries(event(), [], [], mock.sdk, { structuredDesign: true, createVisual: false });
    expect(result.themes[0].designSpec?.graphics_generation.needed).toBe(false);
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("requests one controlled image only when the accepted specification requires it", async () => {
    const spec = specification();
    spec.graphics_generation = { needed: true, prompt: "Fine-art editorial oil sketch on cotton paper with a quiet central reading field, no text or people.", placement: "hero_background" };
    const visual = { data: Buffer.from("controlled test artwork"), record: { id: "12345678-1234-4123-8123-123456789abc", sha256: "a".repeat(64), width: 1024, height: 1536, isolated: false, kind: "scene" as const, model: "test-image-provider", prompt: "Controlled test", createdAt: "2026-10-13T00:00:00.000Z", references: 0 } };
    vi.mocked(generateVisual).mockResolvedValue(visual);
    const mock = provider(envelope(spec));
    const result = await generateSeries(event(), [], [], mock.sdk, { structuredDesign: true, createVisual: true });
    expect(mock.transport).toHaveBeenCalledTimes(1);
    expect(generateVisual).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateVisual).mock.calls[0][0].intent).toMatchObject({ visualKind: "scene", artworkPrompt: spec.graphics_generation.prompt });
    expect(result.visual).toBe(visual);
    expect(result.style.generatedVisual).toMatchObject({ id: visual.record.id, kind: "scene" });
    expect(result.themes[0].generatedVisual).toEqual(result.style.generatedVisual);
    expect(result.themes[0].designSpec).toEqual(spec);
  });

  it("corrects a repeated archetype/mask/paper combination before any image request", async () => {
    const content = event();
    const previous = designIdentity(composeSpecification(specification(), [], content, []).themes[0]);
    const repeated = specification();
    repeated.canvas.background_color = "#F6F2EC";
    repeated.typography.heading_font = "Playfair Display";
    repeated.composition_rules.hero_alignment = "left_bleed";
    const distinct = specification();
    distinct.archetype = "RAW_ASYMMETRIC";
    distinct.component_manifest.hero_layout_component = "poster";
    distinct.canvas.background_color = "#ABB79C";
    distinct.canvas.paper_texture = "cold_press";
    distinct.composition_rules.hero_alignment = "asymmetric_offset";
    distinct.composition_rules.card_framing = "raw_deckle_shadow";
    distinct.composition_rules.photo_treatment.mask_type = "oval_portrait";
    const mock = provider(envelope(repeated), envelope(distinct));
    const result = await generateSeries(content, [], [], mock.sdk, { structuredDesign: true, createVisual: true, recentDesigns: [previous] });
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mock.requests[1].messages)).toContain("combination repeats");
    expect(result.themes[0].designSpec?.archetype).toBe("RAW_ASYMMETRIC");
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("sends the verified inventory and bounded visual history without other projects' facts or art prompts", async () => {
    const privateSpec = specification();
    privateSpec.design_title = "Чужая семейная история";
    privateSpec.similarity_defense = "Private family editorial notes.";
    privateSpec.graphics_generation = { needed: true, prompt: "UniquePrivateArtworkName botanical manuscript engraving", placement: "floating_botanical" };
    const previous = designIdentity(composeSpecification(privateSpec, [], event(), []).themes[0], true, privateSpec.graphics_generation.prompt);
    const next = specification();
    next.archetype = "MINIMALIST_TYPOGRAPHIC";
    next.component_manifest.hero_layout_component = "letter";
    next.typography.heading_font = "Playfair Display";
    next.canvas.background_color = "#A7B396";
    const content = { ...event(), hosts: [{ name: "CurrentPrivateHostName" }] };
    const mock = provider(envelope(next));
    await generateSeries(content, [], [], mock.sdk, { structuredDesign: true, recentDesigns: [previous] });
    const context = JSON.parse(mock.requests[0].messages[0].content[0].text!) as Record<string, unknown>;
    expect(context.availableComponents).toEqual(availableDesignComponents());
    expect(context.recentDesigns).toHaveLength(1);
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain(privateSpec.design_title);
    expect(serialized).not.toContain(privateSpec.similarity_defense);
    expect(serialized.toLowerCase()).not.toContain("uniqueprivateartworkname");
    expect(serialized).not.toContain("CurrentPrivateHostName");
    expect(serialized).not.toContain("design_title");
    expect(serialized).not.toContain("similarity_defense");
    expect(context.knownFacts).toMatchObject({ hosts: true });
    const fontSchema = mock.requests[0].tools[0].input_schema.properties!.design_spec.properties!.typography.properties!;
    expect(fontSchema.heading_font.enum).toEqual(["Cormorant Garamond", "Playfair Display"]);
    expect(fontSchema.body_font.enum).toEqual(["Montserrat", "Jost"]);
  });

  it.each([2, 5])("rejects old %s-variant direct requests before the structured provider", async (variantCount) => {
    const mock = provider(envelope());
    await expect(generateSeries({ ...event(), variantCount }, [], [], mock.sdk, { structuredDesign: true })).rejects.toMatchObject({ status: 400 });
    expect(mock.transport).not.toHaveBeenCalled();
    expect(generateVisual).not.toHaveBeenCalled();
  });
});
