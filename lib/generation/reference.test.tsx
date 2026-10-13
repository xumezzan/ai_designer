import Anthropic from "@anthropic-ai/sdk";
import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Content } from "@/lib/schema/content";
import { Theme } from "@/lib/schema/theme";
import { validateTheme } from "@/lib/theme/validate";
import { ScrollNarrative } from "@/components/layouts/ScrollNarrative";
import { fixtureSeries } from "@/lib/generation/fixture";
import { composeSeries } from "@/lib/generation/series";
import { generateSeries } from "@/lib/ai/generateSeries";
import { directAsset, unusedAsset } from "@/lib/assets/crop";
import { portraitTextZone } from "@/lib/invitation/reference";
import { editCanvasText } from "@/lib/studio/live";
import fontFacts from "@/registry/reference-font.generated.json";

const content = Content.parse({ slug: "reference-test", locale: "ru", eventType: "birthday", hosts: [{ name: "Latifa" }], brief: "Great Gatsby birthday", date: { start: "", day: "2026-07-12" }, venue: { name: "Мирас", address: "" }, greeting: "", closing: "a little party never killed somebody! See you!", dressCode: { title: "Great Gatsby", note: "Золото, серебро, чёрный", swatches: ["#C8A84B", "#B0B8C1", "#0A0A0D"] }, variantCount: 1 });
function series(composition: "cinematic" | "portrait-story") {
  const raw = structuredClone(fixtureSeries);
  raw.style.ornament.pack = "none";
  raw.variants = [{ ...raw.variants[0], ornamentPlacement: [], layout: { ...raw.variants[0].layout, hero: "typographic", composition, sectionOrder: ["hero", "dressCode", "venue", "footer"] } }];
  return raw;
}

test.each(["cinematic", "portrait-story"] as const)("%s preserves all live facts and omits unknown time/RSVP/people", (composition) => {
  const theme = composeSeries(series(composition), "ru", []).themes[0];
  const html = renderToStaticMarkup(<ScrollNarrative content={content} theme={theme} initialNow={0} embedded />);
  expect(html).toContain(`data-composition="${composition}"`);
  for (const field of ["hosts.0.name", "dressCode.title", "dressCode.note", "closing"]) expect(html).toContain(`data-studio-field="${field}"`);
  expect(html).toContain('dateTime="2026-07-12"');
  expect(html).toContain("Мирас");
  expect(html).not.toContain('id="countdown"');
  expect(html).not.toContain('id="rsvp"');
  expect(html).not.toContain("18:30");
  expect(html).not.toContain("18th Birthday");
  expect(html).not.toContain("Джаъфар");
  expect(html).not.toContain("scene-cover-art");
});

test.each(["cinematic", "portrait-story"] as const)("%s makes one design request and zero bitmap requests, even with image creation enabled", async (composition) => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const bitmap = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", bitmap);
  const transport = vi.fn(async () => Response.json({ id: "test", type: "message", role: "assistant", model: "test", content: [{ type: "tool_use", id: "test", name: "emit_design_series", input: series(composition) }], stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } }));
  const sdk = new Anthropic({ apiKey: "test", maxRetries: 0, fetch: transport });
  try {
    const result = await generateSeries(content, [], [], sdk, { createVisual: true });
    expect(result.themes).toHaveLength(1);
    expect(result.visual).toBeUndefined();
    expect(transport).toHaveBeenCalledTimes(1);
    expect(bitmap).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});

test("native stories reject decorative bitmap frames and retain protected photos exactly once", () => {
  const raw = series("portrait-story");
  const info = { width: 1200, height: 1600 };
  const asset = { ...unusedAsset("personal-photo", info), quality: "high" as const, role: "hero" as const, placement: { section: "hero" as const, index: 0 }, maxViewportShare: 1, safeArea: { x: .2, y: .2, w: .6, h: .6 } };
  const photo = directAsset(asset, "/personal-photo.webp", info, "none")!;
  raw.variants[0].photos = [{ id: asset.id, section: "hero", index: 0, position: "before" }];
  const theme = composeSeries(raw, "ru", [photo]).themes[0];
  const html = renderToStaticMarkup(<ScrollNarrative content={content} theme={theme} photos={[photo]} initialNow={0} embedded />);
  expect(html.match(/data-photo-id="personal-photo"/g)).toHaveLength(1);
  expect(portraitTextZone(photo)).toBe("outside");
  expect(html).toContain('data-text-zone="outside"');
  const bitmap = { id: "9f51f89f-49d9-437b-a963-5f79eafe7531", sha256: "a".repeat(64), width: 1024, height: 1536, isolated: false, kind: "scene" as const };
  expect(validateTheme(Theme.parse({ ...theme, generatedVisual: bitmap })).ok).toBe(false);
});

test("real dress-code copy edits remain validated data and immediately render", () => {
  const edited = editCanvasText(content, "dressCode.note", "Чёрный и серебро")!;
  expect(edited.dressCode?.note).toBe("Чёрный и серебро");
  expect(editCanvasText(content, "dressCode.swatches", "red")).toBeNull();
  expect(editCanvasText(content, "dressCode.title", "X".repeat(300))).toBeNull();
});

test("vendored display font matches recorded source bytes and relies on explicit Cyrillic fallback", () => {
  const data = readFileSync(`public${fontFacts.path}`);
  expect(createHash("sha256").update(data).digest("hex")).toBe(fontFacts.sha256);
  const require = createRequire(import.meta.url); const fontkitModule = require("next/dist/compiled/@next/font/dist/fontkit");
  const font = (fontkitModule.default.default ?? fontkitModule.default)(data);
  for (const letter of "Latifa0123456789") expect(font.hasGlyphForCodePoint(letter.codePointAt(0))).toBe(true);
  expect(font.hasGlyphForCodePoint(0x0410)).toBe(false);
  expect(font.unitsPerEm).toBe(fontFacts.unitsPerEm);
});
