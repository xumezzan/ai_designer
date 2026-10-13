import Anthropic from "@anthropic-ai/sdk";
import { expect, test, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Content } from "@/lib/schema/content";
import { fixtureSeries } from "@/lib/generation/fixture";
import { generateSeries } from "./generateSeries";
import sharp from "sharp";
const content = Content.parse(JSON.parse(await readFile("projects/demo/content.json", "utf8")));
const input = { ...content, variantCount: 5, brief: "Великий Гэтсби, ар-деко, тёмный фон и золото" };
const message = (output: unknown) => ({ id: "msg_test", type: "message", role: "assistant", model: "claude-sonnet-4-6", content: [{ type: "tool_use", id: "tool_test", name: "emit_design_series", input: output }], stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
test("real SDK transport sends the brief and JPEG references with one forced series tool", async () => {
  let request: Record<string, unknown> = {};
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async (_url, options) => { request = JSON.parse(String(options?.body)); return Response.json(message(fixtureSeries)); } });
  const result = await generateSeries(input, [], [{ base64: "dGVzdA==" }], sdk);
  expect(result.themes).toHaveLength(5);
  expect(result.references).toBe(1);
  expect(result.model).toBe("claude-sonnet-4-6");
  expect(request.tool_choice).toEqual({ type: "tool", name: "emit_design_series" });
  expect(JSON.stringify(request.messages)).toContain(input.brief);
  expect(JSON.stringify(request.messages)).toContain('"media_type":"image/jpeg"');
  expect(JSON.stringify(request.messages)).not.toContain(content.hosts[0].name);
});
test("invalid series receives exactly one correction retry", async () => {
  let calls = 0;
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => { calls++; return Response.json(message(calls === 1 ? { ...fixtureSeries, variants: [] } : fixtureSeries)); } });
  expect((await generateSeries(input, [], [], sdk)).themes).toHaveLength(5);
  expect(calls).toBe(2);
});
test("two invalid responses fail explicitly rather than supplying stock themes", async () => {
  let calls = 0;
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => { calls++; return Response.json(message({})); } });
  await expect(generateSeries(input, [], [], sdk)).rejects.toMatchObject({ status: 502 });
  expect(calls).toBe(2);
});
test("blank briefs and missing credentials never send an API request", async () => {
  await expect(generateSeries({ ...input, brief: " " }, [], [])).rejects.toMatchObject({ status: 400 });
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  try { await expect(generateSeries(input, [], [])).rejects.toMatchObject({ status: 503 }); }
  finally { vi.unstubAllEnvs(); }
});
test("a provider rejection is sanitized and never becomes a generated series", async () => {
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => Response.json({ error: { type: "authentication_error", message: "sensitive provider detail" } }, { status: 401 }) });
  await expect(generateSeries(input, [], [], sdk)).rejects.toMatchObject({ status: 502, message: "Ключ Anthropic отклонён. Проверьте .env.local и перезапустите сервер." });
});

test.each([1, 2, 5])("image-enabled series creates one shared original asset for %s requested variants", async (variantCount) => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  const raw = structuredClone(fixtureSeries);
  raw.style.intent = { summary: "Ар-деко", cues: ["Геометрия"], avoid: ["Цветы"], referenceNotes: "", artworkPrompt: "Gold Art Deco fan on charcoal paper" };
  raw.variants.forEach((variant, index) => { variant.layout.visualPlacement = ["band", "side-left", "side-right", "medallion", "inset"][index] as typeof variant.layout.visualPlacement; });
  raw.variants = raw.variants.slice(0, variantCount);
  const data = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#161B20" } }).webp().toBuffer();
  const openai = vi.fn<typeof fetch>(async () => Response.json({ data: [{ b64_json: data.toString("base64") }] }));
  vi.stubGlobal("fetch", openai);
  const anthropic = vi.fn(async () => Response.json(message(raw)));
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: anthropic });
  try {
    const result = await generateSeries({ ...input, variantCount }, [], [], sdk, { createVisual: true });
    expect(result.themes).toHaveLength(variantCount);
    expect(result.visual?.record.references).toBe(0);
    expect(result.style.generatedVisual).toBeDefined();
    expect(new Set(result.themes.map((theme) => theme.generatedVisual?.id)).size).toBe(1);
    expect(result.themes.every((theme) => theme.artwork === "none")).toBe(true);
    expect(openai).toHaveBeenCalledTimes(1);
    expect(anthropic).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});

test("OpenAI failure stops the series without a second paid attempt or Anthropic retry", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  const raw = structuredClone(fixtureSeries);
  raw.style.intent = { summary: "Ар-деко", cues: ["Геометрия"], avoid: [], referenceNotes: "", artworkPrompt: "Gold Art Deco engraving" };
  raw.variants[1].layout.visualPlacement = "side-left";
  raw.variants[2].layout.visualPlacement = "side-right";
  const openai = vi.fn<typeof fetch>(async () => Response.json({ error: "private-detail" }, { status: 429 }));
  vi.stubGlobal("fetch", openai);
  const anthropic = vi.fn(async () => Response.json(message(raw)));
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: anthropic });
  try {
    await expect(generateSeries(input, [], [], sdk, { createVisual: true })).rejects.toMatchObject({ status: 429 });
    expect(openai).toHaveBeenCalledTimes(1);
    expect(anthropic).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});

test.each([1, 2, 3, 4, 5])("requests exactly %s variants through the tool schema, prompt and saved preference", async (variantCount) => {
  let request: Record<string, unknown> = {};
  const raw = { ...fixtureSeries, variants: fixtureSeries.variants.slice(0, variantCount) };
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async (_url, options) => {
    request = JSON.parse(String(options?.body));
    return Response.json(message(raw));
  } });
  const result = await generateSeries({ ...input, variantCount }, [], [], sdk);
  expect(result.themes).toHaveLength(variantCount);
  const tools = request.tools as { input_schema: { properties: { variants: { minItems: number; maxItems: number } } } }[];
  expect(tools[0].input_schema.properties.variants).toMatchObject({ minItems: variantCount, maxItems: variantCount });
  expect(request.system).toContain(`exactly ${variantCount} designed invitations`);
  expect(JSON.stringify(request.messages)).toContain(`exactly ${variantCount} compositions`);
});

test.each([0, 6, 1.5, NaN])("invalid count %s is rejected before requesting a provider", async (variantCount) => {
  const transport = vi.fn(async () => Response.json(message(fixtureSeries)));
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: transport });
  await expect(generateSeries({ ...input, variantCount }, [], [], sdk)).rejects.toMatchObject({ status: 400 });
  expect(transport).not.toHaveBeenCalled();
});

test("a response with the wrong count is corrected instead of silently trimming or expanding it", async () => {
  let calls = 0;
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => {
    calls++;
    return Response.json(message({ ...fixtureSeries, variants: fixtureSeries.variants.slice(0, calls === 1 ? 3 : 2) }));
  } });
  const result = await generateSeries({ ...input, variantCount: 2 }, [], [], sdk);
  expect(result.themes).toHaveLength(2);
  expect(calls).toBe(2);
});

test("new requests default to one resolved reference design and can extract sourced facts in that same call", async () => {
  let request: Record<string, unknown> = {};
  const raw = { ...fixtureSeries, variants: fixtureSeries.variants.slice(0, 1), facts: { eventType: { value: "birthday", source: "birthday" }, hosts: { value: ["Latifa"], source: "Latifa" }, headline: null, day: null, venue: null, greeting: null, closing: null, dressCode: null } };
  const sdk = new Anthropic({ apiKey: "test-only", maxRetries: 0, fetch: async (_url, options) => { request = JSON.parse(String(options?.body)); return Response.json(message(raw)); } });
  const result = await generateSeries({ ...content, variantCount: undefined, brief: "Latifa birthday" }, [], [], sdk);
  expect(result.themes).toHaveLength(1); expect(result.facts?.hosts?.value).toEqual(["Latifa"]);
  expect(request.system).toContain("Produce ONE resolved composition");
  expect(request.system).toContain("No alternatives");
  expect(request.max_tokens).toBe(8192);
});
