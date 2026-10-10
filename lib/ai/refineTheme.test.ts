import Anthropic from "@anthropic-ai/sdk";
import { expect, test, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Content } from "@/lib/schema/content";
import { fixtureSeries } from "@/lib/generation/fixture";
import { composeSeries } from "@/lib/generation/series";
import { refineTheme } from "./refineTheme";

const content = Content.parse(JSON.parse(await readFile("projects/demo/content.json", "utf8")));
const context = { content, assetPlan: { assets: [], unifiedTreatment: "none" as const }, mediaInfo: {} };
const source = composeSeries(fixtureSeries, "ru", []).themes[0];
const output = { patch: { foil: { enabled: false } }, summary: "Убрана золотая фольга." };
const message = (input: unknown) => ({ id: "msg_test", type: "message", role: "assistant", model: "claude-sonnet-4-6", content: [{ type: "tool_use", id: "tool_test", name: "emit_theme_patch", input }], stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
test("SDK uses a partial structured tool; removing foil preserves every other field and excludes event facts", async () => {
  let request: Record<string, unknown> = {};
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async (_url, options) => { request = JSON.parse(String(options?.body)); return Response.json(message(output)); } });
  const result = await refineTheme(source, "Убери золотую фольгу", context, sdk);
  expect(request.tool_choice).toEqual({ type: "tool", name: "emit_theme_patch" });
  expect(JSON.stringify(request.messages)).not.toContain(content.hosts[0].name);
  expect(result.changes.map((change) => change.path)).toEqual(["foil.enabled"]);
  expect(result.theme).toEqual({ ...source, foil: { ...source.foil, enabled: false } });
});
test("invalid patches get at most one correction retry", async () => {
  let calls = 0;
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => { calls++; return Response.json(message(calls === 1 ? { patch: { meta: { name: "regeneration" } }, summary: "Wrong" } : output)); } });
  expect((await refineTheme(source, "Убери фольгу", context, sdk)).theme.foil.enabled).toBe(false);
  expect(calls).toBe(2);
});
test("unsupported edits return an explanation once, without pretending to refine", async () => {
  let calls = 0;
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => { calls++; return Response.json(message({ patch: {}, summary: "Генерация новых изображений здесь не поддерживается." })); } });
  await expect(refineTheme(source, "Нарисуй новое фото", context, sdk)).rejects.toMatchObject({ status: 422 });
  expect(calls).toBe(1);
});
test("two invalid patches fail without an alternate design", async () => {
  let calls = 0;
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => { calls++; return Response.json(message({ patch: { html: "code" }, summary: "Wrong" })); } });
  await expect(refineTheme(source, "Темнее", context, sdk)).rejects.toMatchObject({ status: 502 });
  expect(calls).toBe(2);
});
test("blank instructions, missing keys and provider rejections fail explicitly", async () => {
  await expect(refineTheme(source, " ", context)).rejects.toMatchObject({ status: 400 });
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  try { await expect(refineTheme(source, "Темнее", context)).rejects.toMatchObject({ status: 503 }); }
  finally { vi.unstubAllEnvs(); }
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => Response.json({ error: { type: "authentication_error", message: "private provider detail" } }, { status: 401 }) });
  await expect(refineTheme(source, "Темнее", context, sdk)).rejects.toMatchObject({ status: 502, message: "Ключ Anthropic отклонён. Проверьте .env.local и перезапустите сервер." });
});
