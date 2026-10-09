import Anthropic from "@anthropic-ai/sdk";
import { expect, test, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Content } from "@/lib/schema/content";
import { fixtureSeries } from "@/lib/generation/fixture";
import { generateSeries } from "./generateSeries";
const content = Content.parse(JSON.parse(await readFile("projects/demo/content.json", "utf8")));
const input = { ...content, brief: "Великий Гэтсби, ар-деко, тёмный фон и золото" };
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
