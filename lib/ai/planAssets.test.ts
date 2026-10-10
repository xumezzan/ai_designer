import Anthropic from "@anthropic-ai/sdk";
import { expect, test, vi } from "vitest";
import { planAssets } from "./planAssets";
import { unusedAsset } from "@/lib/assets/crop";

const photo = { id: "photo-1", width: 1600, height: 1000, base64: "dGVzdA==" };
const plan = { assets: [unusedAsset(photo.id, photo)], unifiedTreatment: "bw" };
const message = (input: unknown) => ({ id: "msg_test", type: "message", role: "assistant", model: "claude-sonnet-4-6", content: [{ type: "tool_use", id: "tool_1", name: "emit_asset_plan", input }], stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } });
test("SDK transport sends JPEG base64 and a forced structured tool; no prose JSON parsing", async () => {
  let request: Record<string, unknown> = {};
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async (_url, options) => {
    request = JSON.parse(String(options?.body));
    return Response.json(message(plan));
  } });
  expect(await planAssets([photo], sdk)).toMatchObject(plan);
  expect(request.tool_choice).toEqual({ type: "tool", name: "emit_asset_plan" });
  expect(JSON.stringify(request.messages)).toContain('"media_type":"image/jpeg"');
  expect(JSON.stringify(request.messages)).toContain(photo.base64);
});
test("invalid/unknown ids get one correction retry, never unvalidated saving", async () => {
  let calls = 0;
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => {
    calls++;
    return Response.json(message(calls === 1 ? { ...plan, assets: [{ ...plan.assets[0], id: "invented" }] } : plan));
  } });
  expect((await planAssets([photo], sdk)).assets[0].id).toBe(photo.id);
  expect(calls).toBe(2);
});
test("two invalid responses return an explicit failure", async () => {
  let calls = 0;
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async () => { calls++; return Response.json(message({ assets: [] })); } });
  await expect(planAssets([photo], sdk)).rejects.toMatchObject({ status: 502 });
  expect(calls).toBe(2);
});
test("missing key fails without sending images", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  try { await expect(planAssets([photo])).rejects.toMatchObject({ status: 503 }); }
  finally { vi.unstubAllEnvs(); }
});


test("multi-batch output keeps exact ids, one hero and a unified treatment", async () => {
  const photos = Array.from({ length: 9 }, (_, index) => ({ ...photo, id: `photo-${index}` }));
  let calls = 0;
  const sdk = new Anthropic({ apiKey: "test-key", maxRetries: 0, fetch: async (_url, options) => {
    calls++;
    const request = JSON.parse(String(options?.body));
    const ids: string[] = request.tools[0].input_schema.properties.assets.items.properties.id.enum;
    return Response.json(message({ unifiedTreatment: ids[0] === "photo-0" ? "bw" : "warm-film", assets: ids.map((id, index) => ({ ...unusedAsset(id, photo), role: index === 0 ? "hero" : "portrait", quality: "high", placement: { section: index === 0 ? "hero" : "greeting", index } })) }));
  } });
  const result = await planAssets(photos, sdk);
  expect(calls).toBe(2);
  expect(result.assets.map((asset) => asset.id)).toEqual(photos.map((source) => source.id));
  expect(result.assets.filter((asset) => asset.placement?.section === "hero")).toHaveLength(1);
  expect(result.assets[8].placement?.section).toBe("greeting");
  expect(result.unifiedTreatment).toBe("bw");
});
