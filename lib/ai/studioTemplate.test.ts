import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Content } from "@/lib/schema/content";
import type { StudioSelection } from "@/lib/schema/studioTemplate";
import { directAsset, unusedAsset } from "@/lib/assets/crop";
import { designIdentity } from "@/lib/generation/diversity";
import { composeStudioTemplate } from "@/lib/generation/studioTemplate";
import { applyBriefFacts } from "@/lib/studio/briefFacts";
import { studioTemplates, studioTemplateCatalog, studioCompositionPresets } from "@/registry/studioTemplates";
import { generateSeries } from "./generateSeries";
import { generateVisual } from "./generateVisual";

vi.mock("./generateVisual", () => ({ generateVisual: vi.fn() }));
beforeEach(() => vi.mocked(generateVisual).mockReset());

type JsonSchema = { properties?: Record<string, JsonSchema>; required?: string[]; additionalProperties?: boolean; enum?: unknown[]; items?: JsonSchema; minItems?: number; maxItems?: number };
type RequestPayload = { system: string; tools: { input_schema: JsonSchema }[]; messages: { content: { type: string; text?: string }[] }[] };
const message = (input: unknown) => ({ id: "msg_recipe", type: "message", role: "assistant", model: "claude-sonnet-4-6", content: [{ type: "tool_use", id: "tool_recipe", name: "emit_design_series", input }], stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
function provider(...outputs: unknown[]) {
  const requests: RequestPayload[] = [];
  const transport = vi.fn<typeof fetch>(async (_url, options) => {
    requests.push(JSON.parse(String(options?.body)) as RequestPayload);
    return Response.json(message(outputs[Math.min(requests.length - 1, outputs.length - 1)]));
  });
  return { requests, transport, sdk: new Anthropic({ apiKey: "test-only", maxRetries: 0, fetch: transport }) };
}
function event(brief = "Сдержанное редакционное приглашение, крупные имена и тёплая бумага.") {
  return Content.parse({ slug: "recipe-tests", locale: "ru", eventType: "wedding", hosts: [{ name: "" }],
    date: { start: "", timezone: "Asia/Tashkent", showCountdown: false }, venue: { name: "", address: "" }, timeline: [], brief, variantCount: 1 });
}
function selection(templateId: StudioSelection["templateId"] = "editorial"): StudioSelection {
  const template = studioTemplates.find((candidate) => candidate.id === templateId)!;
  return { templateId, paletteId: template.defaultPaletteId, fontPairId: template.defaultFontPairId, ornamentSetId: template.ornamentSetId, composition: structuredClone(studioCompositionPresets[templateId]) };
}
const envelope = (selected = selection()) => ({ facts: null, selection: selected, rationale: "Крупная антиква и спокойный тон бумаги поддерживают камерный характер приглашения.", photos: [] });
const emptyFacts = () => ({ eventType: null, hosts: null, headline: null, day: null, venue: null, venueAddress: null, venueNote: null,
  venueMapUrl: null, greeting: null, wishes: null, timeline: null, closing: null, dressCode: null });

describe("curated studio-template generation", () => {
  it("selects registered IDs and complete bounded composition through transport and never asks for an image", async () => {
    const mock = provider(envelope());
    const result = await generateSeries(event(), [], [{ base64: "dGVzdA==" }], mock.sdk, { curatedTemplates: true, createVisual: true });
    expect(mock.transport).toHaveBeenCalledTimes(1);
    expect(result.themes).toHaveLength(1);
    const { templateId, ...tokens } = selection();
    expect(result.themes[0].studioTemplate).toEqual({ id: templateId, revision: 1, ...tokens });
    expect(result.themes[0].designSpec).toBeUndefined();
    expect(result.themes[0].generatedVisual).toBeUndefined();
    expect(result.style.studioTemplate).toEqual(result.themes[0].studioTemplate);
    expect(result.visual).toBeUndefined();
    expect(result.references).toBe(1);
    expect(generateVisual).not.toHaveBeenCalled();
    const schema = mock.requests[0].tools[0].input_schema;
    expect(schema.required).toEqual(["facts", "selection", "rationale", "photos"]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties!.selection.required).toEqual(["templateId", "paletteId", "fontPairId", "ornamentSetId", "composition"]);
    const context = JSON.parse(mock.requests[0].messages[0].content[0].text!);
    expect(context.studioTemplates).toEqual(studioTemplateCatalog());
    expect(context.createVisual).toBe(false);
    expect(context.studioDesign).toEqual({ templateId: "auto", paletteId: "auto" });
    expect(mock.requests[0].system).toContain("ПЕРЕВОД НАСТРОЕНИЯ В КОМПОЗИЦИЮ");
    expect(schema.properties!.selection.properties!.composition.required).toContain("sectionVariants");
  });

  it("preserves grounded facts, known edits, each photo and the owner's pinned placement", async () => {
    const content = { ...event("Анна и Иван приглашают на свадьбу. Приходите праздновать вместе."), venue: { name: "Место выбрано владельцем", address: "" } };
    const info = { width: 1600, height: 2000 };
    const photo = directAsset({ ...unusedAsset("owner-photo", info), role: "portrait", quality: "high", placementPinned: true, placement: { section: "greeting", index: 0 } }, "/owner-photo.webp", info, "none")!;
    const facts = { ...emptyFacts(), hosts: { value: ["Анна", "Иван"], source: "Анна и Иван" }, greeting: { value: "Приходите праздновать вместе.", source: "Приходите праздновать вместе." }, venue: { value: "Другое место", source: "свадьбу" } };
    const mock = provider({ ...envelope(), facts, photos: [{ id: photo.asset.id, section: "hero", index: 0, position: "after" }] });
    const result = await generateSeries(content, [photo], [], mock.sdk, { curatedTemplates: true });
    expect(result.facts?.hosts?.value).toEqual(["Анна", "Иван"]);
    expect(result.facts?.greeting?.source).toBe("Приходите праздновать вместе.");
    expect(applyBriefFacts(content, result.facts).venue.name).toBe("Место выбрано владельцем");
    expect(result.themes[0].photos).toEqual([{ id: "owner-photo", section: "greeting", index: 0, position: "before" }]);
    expect(result.themes[0].layout.sectionOrder).toContain("greeting");
    expect(result.themes[0].layout.sectionOrder).toContain("venue");
    const context = JSON.parse(mock.requests[0].messages[0].content[0].text!);
    expect(context.knownFacts.venue).toBe(true);
    const photoSchema = mock.requests[0].tools[0].input_schema.properties!.photos;
    expect(photoSchema).toMatchObject({ minItems: 1, maxItems: 1 });
    expect(photoSchema.items!.properties!.id.enum).toEqual(["owner-photo"]);
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it.each(["template", "palette"] as const)("enforces an explicit %s choice before accepting the provider output", async (pin) => {
    const selected = selection();
    const content = { ...event(), studioDesign: { templateId: pin === "template" ? "botanical" as const : "auto" as const, paletteId: pin === "palette" ? "wine" as const : "auto" as const } };
    const mock = provider(envelope(selected));
    await expect(generateSeries(content, [], [], mock.sdk, { curatedTemplates: true })).rejects.toMatchObject({ status: 502 });
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mock.requests[1].messages)).toContain(`explicitly selected ${pin === "template" ? "templateId" : "paletteId"}`);
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it.each([
    { fontPairId: "modernist", composition: { ...studioCompositionPresets.editorial, typographyAccent: "italic-serif-accent" } },
    { paletteId: "wine", ornamentSetId: "chinese-garden" },
  ])("rejects incompatible cross-template tags rather than reverting silently", async (overrides) => {
    const mock = provider({ ...envelope(), selection: { ...selection(), ...overrides } });
    await expect(generateSeries(event(), [], [], mock.sdk, { curatedTemplates: true })).rejects.toMatchObject({ status: 502 });
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("retries repeated automatic compositions and accepts a visibly different combination", async () => {
    const content = event();
    const previous = composeStudioTemplate(selection(), [], envelope().rationale, content, []).themes[0];
    const different = { ...selection(), paletteId: "wine" as const, fontPairId: "poetic" as const,
      composition: { ...studioCompositionPresets.editorial, heroLayout: "typographic-poster" as const, surfaceStyle: "flat" as const, typographyAccent: "oversized-display" as const } };
    const mock = provider(envelope(), envelope(different));
    const result = await generateSeries(content, [], [], mock.sdk, { curatedTemplates: true, recentDesigns: [designIdentity(previous)] });
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(result.themes[0].studioTemplate?.composition?.heroLayout).toBe("typographic-poster");
    expect(JSON.parse(mock.requests[0].messages[0].content[0].text!).recentDesigns).toHaveLength(1);
    expect(generateVisual).not.toHaveBeenCalled();
  });

  it("preserves the owner's explicit family even when recent history repeats it", async () => {
    const content = { ...event(), studioDesign: { templateId: "editorial" as const, paletteId: "auto" as const } };
    const previous = composeStudioTemplate(selection(), [], envelope().rationale, content, []).themes[0];
    const mock = provider(envelope());
    const result = await generateSeries(content, [], [], mock.sdk, { curatedTemplates: true, recentDesigns: [designIdentity(previous)] });
    expect(mock.transport).toHaveBeenCalledTimes(1);
    expect(result.themes[0].studioTemplate).toEqual(previous.studioTemplate);
  });

  it("requires complete nested composition from new AI output with one corrective retry", async () => {
    const legacy = selection();
    delete legacy.composition;
    const mock = provider({ ...envelope(), selection: legacy }, envelope());
    const result = await generateSeries(event(), [], [], mock.sdk, { curatedTemplates: true, createVisual: false });
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(result.themes[0].studioTemplate?.composition).toEqual(studioCompositionPresets.editorial);
    expect(JSON.stringify(mock.requests[1].messages)).toContain("composition");
  });

  it("uses event types as guidance while letting the brief choose a compatible parametric skeleton", async () => {
    const content = { ...event(), eventType: "corporate" as const };
    const mock = provider(envelope());
    const result = await generateSeries(content, [], [], mock.sdk, { curatedTemplates: true });
    expect(result.themes[0].studioTemplate?.id).toBe("editorial");
    expect(generateVisual).not.toHaveBeenCalled();
    const legacy = selection();
    delete legacy.composition;
    expect(() => composeStudioTemplate(legacy, [], envelope().rationale, content, [])).toThrow(/eventTypes/);
  });

  it("rejects invented tokens and legacy design specifications instead of silently accepting them", async () => {
    const invalid = { ...envelope(), selection: { ...selection(), background_color: "#F3EEE6" } };
    const mock = provider(invalid, { facts: null, design_spec: {}, photos: [] });
    await expect(generateSeries(event(), [], [], mock.sdk, { curatedTemplates: true })).rejects.toMatchObject({ status: 502 });
    expect(mock.transport).toHaveBeenCalledTimes(2);
    expect(generateVisual).not.toHaveBeenCalled();
  });
});

describe("brief-driven parameter combinations", () => {
  it.each([
    { brief: "Камерный ужин при свечах", selected: { templateId: "classic", paletteId: "wine", fontPairId: "ceremony", ornamentSetId: "deco-lines", composition: { ...studioCompositionPresets.classic, heroLayout: "framed-arch", photoShape: "arch", surfaceStyle: "bordered-hairline", spacingScale: "airy-gallery", typographyAccent: "italic-serif-accent", decorConfig: { placement: "frame", density: "subtle", opacity: .25 }, sectionVariants: { countdown: "date-led", program: "editorial-list", venue: "card", gallery: "editorial", rsvp: "minimal" } } } },
    { brief: "Дерзкая рейв-вечеринка", selected: { templateId: "modern", paletteId: "cobalt", fontPairId: "modernist", ornamentSetId: "graphic-ribbon", composition: { ...studioCompositionPresets.modern, heroLayout: "typographic-poster", photoShape: "sharp", surfaceStyle: "flat", spacingScale: "compact-poster", typographyAccent: "oversized-display", decorConfig: { placement: "background-pattern", density: "rich", opacity: .15 }, sectionVariants: { countdown: "tiles", program: "cards", venue: "split", gallery: "filmstrip", rsvp: "split" } } } },
    { brief: "Утренний бранч в саду", selected: { templateId: "editorial", paletteId: "sage", fontPairId: "editorial", ornamentSetId: "botanical-engraving", composition: { ...studioCompositionPresets.editorial, heroLayout: "split-editorial", photoShape: "polaroid", surfaceStyle: "soft-gradient", spacingScale: "airy-gallery", typographyAccent: "classic-centered", decorConfig: { placement: "corners", density: "subtle", opacity: .3 }, sectionVariants: { countdown: "inline", program: "timeline", venue: "stacked", gallery: "grid", rsvp: "card" } } } },
  ] as const)("preserves distinct registered choices for $brief with graphics disabled", async ({ brief, selected }) => {
    const mock = provider(envelope(selected));
    const result = await generateSeries({ ...event(brief), eventType: "other" }, [], [], mock.sdk, { curatedTemplates: true, createVisual: false });
    expect(result.themes[0].studioTemplate).toMatchObject({ paletteId: selected.paletteId, fontPairId: selected.fontPairId, ornamentSetId: selected.ornamentSetId, composition: selected.composition });
    expect(result.style.studioTemplate).toEqual(result.themes[0].studioTemplate);
    expect(result.themes[0].photos).toEqual([]);
    expect(generateVisual).not.toHaveBeenCalled();
    expect(mock.requests[0].system).toContain(brief.toLowerCase());
  });
});
