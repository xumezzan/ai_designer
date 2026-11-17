import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { NativeInvitationAiProvider, artworkPrompt } from "./provider";
import type { ArtDirection, CatalogPlan } from "./schema";
import { moodProfiles } from "@/registry/moodProfiles";

const direction: ArtDirection = { paletteId: "ivory", artworkPrompt: "Original sculptural porcelain petals against pale limestone, with an airy garden composition.", summary: "Скульптурный сад" };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const plan: CatalogPlan = { themeId: "botanical-haute", summary: "Лён и ботаническая обложка" };

function planningResponse(output: unknown, stopReason = "end_turn") {
  return new Response(JSON.stringify({
    id: "msg_test", type: "message", role: "assistant", model: "configured-planner-model",
    content: [{ type: "text", text: JSON.stringify(output) }],
    stop_reason: stopReason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 20 },
  }), { headers: { "content-type": "application/json" } });
}

const wedding = {
  brief: "Мягкие ветви и светлая бумага", locale: "ru", eventType: "wedding",
  needsGreeting: true, needsClosing: true, needsDressCode: false,
} as const;

it("uses the configured Anthropic model with a bounded JSON output", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  vi.stubEnv("ANTHROPIC_MODEL", "configured-planner-model");
  const transport = vi.fn<typeof fetch>().mockResolvedValue(planningResponse(plan));
  expect(await new NativeInvitationAiProvider(transport).plan(wedding)).toEqual(plan);
  expect(transport).toHaveBeenCalledTimes(1);
  const body = JSON.parse(transport.mock.calls[0][1]!.body as string);
  expect(body).toMatchObject({
    model: "configured-planner-model",
    output_config: { format: {
      type: "json_schema",
      schema: {
        additionalProperties: false,
        required: ["themeId", "summary"],
        properties: { themeId: { enum: moodProfiles.map(({ id }) => id) } },
      },
    } },
  });
  expect(body.output_config.format.schema.properties.artworkPrompt).toBeUndefined();
});

it("never retries an Anthropic rate-limit response or exposes its raw message", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  const transport = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "private provider response" } }), { status: 429, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", transport);
  await expect(new NativeInvitationAiProvider().plan({ brief: "Скульптурный сад и фарфор", locale: "ru", eventType: "wedding", needsGreeting: true, needsClosing: true, needsDressCode: false })).rejects.toMatchObject({ code: "AI_PROVIDER_LIMIT", message: "AI_PROVIDER_LIMIT" });
  expect(transport).toHaveBeenCalledTimes(1);
});

it.each([401, 403])("reports an access configuration problem for HTTP %i without revealing provider details", async (status) => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(
    JSON.stringify({ type: "error", error: { message: "private provider response" } }),
    { status, headers: { "content-type": "application/json" } },
  ));
  await expect(new NativeInvitationAiProvider(transport).plan(wedding)).rejects.toMatchObject({
    code: "AI_NOT_CONFIGURED", message: "AI_NOT_CONFIGURED",
  });
  expect(transport).toHaveBeenCalledTimes(1);
});

it("plans an Uzbek personal greeting using only a registered theme and private visual references", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  const native: CatalogPlan = {
    themeId: "modern-editorial", sectionVariants: { gallery: "editorial" },
    headline: "Tugʻilgan kuningiz muborak!",
    greeting: "Har kuningiz quvonchga toʻlsin.",
    summary: "Iliq qogʻoz va jurnal uslubi",
  };
  const reference = await sharp({ create: { width: 32, height: 32, channels: 3, background: "ivory" } }).webp().toBuffer();
  const transport = vi.fn<typeof fetch>().mockResolvedValue(planningResponse(native));
  expect(await new NativeInvitationAiProvider(transport).plan({
    ...wedding, brief: "Mehmonlarsiz, samimiy tugʻilgan kun tabrigi",
    locale: "uz-latn", purpose: "greeting", eventType: "birthday", needsHeadline: true, references: [reference],
  })).toEqual(native);
  const body = JSON.parse(transport.mock.calls[0][1]!.body as string);
  const content = body.messages[0].content;
  const sent = JSON.parse(content[0].text);
  expect(sent).toMatchObject({
    purpose: "greeting", needsHeadline: true,
    themes: expect.arrayContaining([expect.objectContaining({ id: native.themeId })]),
  });
  expect(sent.references).toBeUndefined();
  expect(content[1]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/webp", data: reference.toString("base64") } });
  expect(transport).toHaveBeenCalledTimes(1);
});

it("requests full-bleed art inside the invitation with one native image call and validates decoded bytes", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_IMAGE_MODEL", "configured-image-model");
  const bytes = await sharp({ create: { width: 256, height: 384, channels: 3, background: "ivory" } }).png().toBuffer();
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: bytes.toString("base64") }] })));
  const artwork = await new NativeInvitationAiProvider(transport).createArtwork(direction, []);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][0]).toBe("https://api.openai.com/v1/images/generations");
  const body = JSON.parse(transport.mock.calls[0][1]!.body as string);
  expect(body).toMatchObject({ model: "configured-image-model", n: 1, size: "1024x1536", output_format: "webp" });
  expect(body.prompt).toContain("IS THE SURFACE");
  expect(body.prompt).toContain("no physical invitation card");
  expect(artworkPrompt(direction)).toContain("no physical invitation card");
  expect((await sharp(artwork).metadata()).format).toBe("webp");
});

it("bounds verbose rationale metadata without losing a valid design or clipping visible copy", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  const original = { ...plan, greeting: "Тёплые слова остаются целыми.", summary: "Тёплая бумага и выразительная типографика. ".repeat(20) };
  const transport = vi.fn<typeof fetch>().mockResolvedValue(planningResponse(original));
  const output = await new NativeInvitationAiProvider(transport).plan(wedding);
  expect(output).toMatchObject({ themeId: original.themeId, greeting: original.greeting });
  expect(output.summary.length).toBeLessThanOrEqual(400);
  expect(output.summary).toMatch(/…$/u);
  expect(original.summary.startsWith(output.summary.slice(0, -1))).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
});

it("uses owned WebP references in the edits endpoint", async () => {
  const bytes = await sharp({ create: { width: 256, height: 384, channels: 3, background: "ivory" } }).webp().toBuffer();
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: bytes.toString("base64") }] })));
  await new NativeInvitationAiProvider(transport).createArtwork(direction, [bytes]);
  expect(transport.mock.calls[0][0]).toBe("https://api.openai.com/v1/images/edits");
  const form = transport.mock.calls[0][1]!.body as FormData;
  expect(form.getAll("image[]")).toHaveLength(1);
  expect((form.get("image[]") as File).type).toBe("image/webp");
});

it.each([
  ["provider rejection", () => new Response("private provider details", { status: 500 })],
  ["invalid decoded image", () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("not an image").toString("base64") }] }))],
  ["oversized response", () => new Response("{}", { headers: { "content-length": String(30 * 1024 * 1024) } })],
] as const)("fails safely without retry on %s", async (_name, response) => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(response());
  await expect(new NativeInvitationAiProvider(transport).createArtwork(direction, [])).rejects.toMatchObject({ code: "AI_IMAGE_FAILED", message: "AI_IMAGE_FAILED" });
  expect(transport).toHaveBeenCalledTimes(1);
});

it.each([
  { ...plan, themeId: "unknown" },
  { ...plan, artworkPrompt: direction.artworkPrompt },
  { ...plan, sectionVariants: { venue: "arbitrary-layout" } },
  { ...plan, greeting: "a".repeat(1601) },
])("rejects a response outside the catalog contract %#", async (output) => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  const transport = vi.fn<typeof fetch>().mockResolvedValue(planningResponse(output));
  await expect(new NativeInvitationAiProvider(transport).plan(wedding)).rejects.toMatchObject({ code: "AI_PLAN_FAILED" });
});

it("rejects truncated output even when the returned JSON could be parsed", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  const transport = vi.fn<typeof fetch>().mockResolvedValue(planningResponse(plan, "max_tokens"));
  await expect(new NativeInvitationAiProvider(transport).plan(wedding)).rejects.toMatchObject({ code: "AI_PLAN_FAILED" });
});

it("builds visibly distinct image directions for silk, porcelain and night garden without rasterising the website", () => {
  const promptFor = (scene: "silk" | "porcelain" | "night-garden") => artworkPrompt({ ...direction, artDirection: { title: "Material concept", scene, layout: "immersive" } });
  const silk = promptFor("silk"), porcelain = promptFor("porcelain"), garden = promptFor("night-garden");
  expect(silk).toContain("flowing silk");
  expect(porcelain).toContain("matte porcelain");
  expect(garden).toContain("nocturnal garden");
  expect(new Set([silk, porcelain, garden]).size).toBe(3);
  for (const prompt of [silk, porcelain, garden]) {
    expect(prompt).toContain("no physical invitation card");
    expect(prompt).toContain("never an image of a website");
    expect(prompt).toContain("Do not rasterise webpage sections");
    expect(prompt).not.toContain("Collection: Sculpted Garden");
  }
});
