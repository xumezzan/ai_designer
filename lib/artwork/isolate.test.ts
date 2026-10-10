import sharp from "sharp";
import { expect, test } from "vitest";
import { isolateDecoration, visualMatte } from "./isolate";

test.each(["#000000", "#FFFFFF"] as const)("neutral matte %s and its compression noise disappear without losing ornament or transparency", async (matte) => {
  const white = matte === "#FFFFFF";
  const bg = white ? 255 : 0;
  const near = white ? 250 : 5;
  const pixels = Buffer.from([bg, bg, bg, 255, near, near, near, 255, 160, 80, 30, 255, bg, bg, bg, 0]);
  const source = await sharp(pixels, { raw: { width: 4, height: 1, channels: 4 } }).png().toBuffer();
  const result = await sharp(await isolateDecoration(source, matte)).ensureAlpha().raw().toBuffer();
  expect(result[3]).toBe(0); expect(result[7]).toBe(0); expect(result[15]).toBe(0);
  expect(result[11]).toBeGreaterThan(100);
  // Reconstruct the source color over its neutral matte: no antialiasing halo.
  const alpha = result[11] / 255;
  for (let channel = 0; channel < 3; channel++) expect(Math.abs(result[8 + channel] * alpha + bg * (1 - alpha) - pixels[8 + channel])).toBeLessThanOrEqual(1);
});
test("matte choice matches dark and light themes", () => {
  expect(visualMatte("#10131B")).toBe("#000000");
  expect(visualMatte("#F3F1EC")).toBe("#FFFFFF");
});
