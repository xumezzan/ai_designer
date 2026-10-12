import { afterEach, expect, test, vi } from "vitest";
import sharp from "sharp";
import { fixtureSeries } from "@/lib/generation/fixture";
import { generateVisual, visualPrompt } from "./generateVisual";
const style = { ...fixtureSeries.style, intent: { summary: "Ар-деко", cues: ["Геометрия", "Золото"], avoid: ["Цветы"], referenceNotes: "", artworkPrompt: "Original Art Deco fan in fine gold engraving on dark charcoal paper" } };
const image = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#334455" } }).png().toBuffer();
afterEach(() => vi.unstubAllEnvs());
test.each([undefined, "gpt-image-2"])("generation uses the default or explicit model %s, decodes real raster bytes and records provenance", async (configuredModel) => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-secret");
  vi.stubEnv("OPENAI_IMAGE_MODEL", configuredModel);
  const model = configuredModel ?? "gpt-image-2.5-sunburst";
  const transport = vi.fn<typeof fetch>(async (url, options) => {
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    const body = JSON.parse(String(options?.body));
    expect(body).toMatchObject({ model, n: 1, size: "1536x1024", quality: "high", background: "opaque", output_format: "webp" });
    expect(body.prompt).toContain(style.intent.artworkPrompt);
    expect(body.prompt).toContain("No text");
    return Response.json({ data: [{ b64_json: image.toString("base64") }] });
  });
  const visual = await generateVisual(style, [], transport);
  expect(visual.record).toMatchObject({ model, references: 0, width: 1536, height: 1024, isolated: true });
  expect(visual.record.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect((await sharp(visual.data).metadata()).format).toBe("webp");
  expect(JSON.stringify(visual.record)).not.toContain("test-only-secret");
  expect(transport).toHaveBeenCalledTimes(1);
});
test("image prompts require isolated graphics on a neutral monochrome matte", () => {
  expect(visualPrompt(style)).toContain("#000000");
  expect(visualPrompt({ ...style, palette: { ...style.palette, bg: "#F3F1EC" } })).toContain("#FFFFFF");
  expect(visualPrompt(style)).toContain("No invitation layout, mockups");
  expect(visualPrompt(style)).toContain("frames, borders");
});
test("uploaded reference bytes are sent as multipart image inputs, never as remote URLs", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-secret");
  vi.stubEnv("OPENAI_IMAGE_MODEL", undefined);
  await generateVisual(style, [{ base64: image.toString("base64") }], async (url, options) => {
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    const form = options?.body as FormData;
    expect(form.get("model")).toBe("gpt-image-2.5-sunburst");
    expect(form.get("quality")).toBe("high");
    expect(form.getAll("image[]")).toHaveLength(1);
    expect(Buffer.from(await (form.get("image[]") as File).arrayBuffer())).toEqual(image);
    expect(form.get("background")).toBe("opaque");
    expect((options?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    return Response.json({ data: [{ b64_json: image.toString("base64") }] });
  });
});
test("missing key or too many references reject before any paid request", async () => {
  const transport = vi.fn<typeof fetch>();
  vi.stubEnv("OPENAI_API_KEY", "");
  await expect(generateVisual(style, [], transport)).rejects.toMatchObject({ status: 503 });
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  await expect(generateVisual(style, Array.from({ length: 17 }, () => ({ base64: "" })), transport)).rejects.toMatchObject({ status: 400 });
  expect(transport).not.toHaveBeenCalled();
});
test.each([401, 403, 429, 500])("sanitizes provider %s and never retries or supplies stock artwork", async (status) => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  const transport = vi.fn<typeof fetch>(async () => Response.json({ error: "private provider diagnostic" }, { status }));
  await expect(generateVisual(style, [], transport)).rejects.not.toThrow("private provider diagnostic");
  expect(transport).toHaveBeenCalledTimes(1);
});
test.each([{ data: [{ url: "https://untrusted.example/image" }] }, { data: [{ b64_json: "YmFk" }] }, {}])("refuses URL-only, corrupt or missing images", async (body) => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  await expect(generateVisual(style, [], async () => Response.json(body))).rejects.toMatchObject({ status: 502 });
});
