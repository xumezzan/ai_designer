import { expect, test } from "vitest";
import sharp from "sharp";
import { overflow } from "../../qa/checks/overflow.mjs";
import { collision } from "../../qa/checks/collision.mjs";
import { clipping } from "../../qa/checks/clipping.mjs";
import { contrast } from "../../qa/checks/contrast.mjs";
import { faceCrop } from "../../qa/checks/face-crop.mjs";
import { reducedMotion } from "../../qa/checks/reduced-motion.mjs";
import { resolution } from "../../qa/checks/resolution.mjs";
import { mergeChecks } from "../../qa/run.mjs";
import { lcp } from "../../qa/checks/lcp.mjs";
import { cls } from "../../qa/checks/cls.mjs";
const box = { x: 20, y: 20, w: 80, h: 20, id: 0, selector: "#title", color: [30, 30, 30], alpha: 255, size: 16, weight: 400 };
const data = { viewport: 390, scrollWidth: 390, height: 900, fragments: [box], clipping: [], photos: [], animations: 0 };
test("overflow checks visible text even when the root hides horizontal overflow", () => {
  expect(overflow(data).status).toBe("pass");
  expect(overflow({ ...data, fragments: [{ ...box, x: -10 }] }).status).toBe("fail");
  expect(overflow({ ...data, scrollWidth: 420 }).status).toBe("fail");
});
test("collisions ignore repeated rectangles of the same text node but catch independent overlapping text", () => {
  expect(collision({ ...data, fragments: [box, box] }).status).toBe("pass");
  expect(collision({ ...data, fragments: [box, { ...box, id: 1, selector: "#copy" }] }).status).toBe("fail");
  expect(collision({ ...data, fragments: [{ ...box, ink: { x: 20, y: 21, w: 80, h: 6 } }, { ...box, id: 1, ink: { x: 20, y: 31, w: 80, h: 6 } }] }).status).toBe("pass");
  expect(clipping({ ...data, clipping: [{ selector: "#title" }] }).status).toBe("fail");
});
test("raster contrast catches low-contrast rendered text and foil cores; large text uses the AA large-type threshold", async () => {
  const png = async (ink: string) => sharp(Buffer.from(`<svg width="390" height="100"><rect width="390" height="100" fill="#ffffff"/><rect x="25" y="23" width="70" height="15" fill="${ink}"/></svg>`)).png().toBuffer();
  expect((await contrast(data, await png("#1e1e1e"))).status).toBe("pass");
  const gray = { ...data, fragments: [{ ...box, color: [150, 150, 150] }] };
  expect((await contrast(gray, await png("#969696"))).status).toBe("fail");
  expect((await contrast({ ...gray, fragments: [{ ...gray.fragments[0], size: 30 }] }, await png("#969696"))).status).toBe("pass");
});
test("protected crops, resolution and reduced motion are explicit defects, while 1–2x density is a warning", () => {
  expect(faceCrop({ ...data, photos: [{ selector: "#photo", protected: false }] }).status).toBe("fail");
  expect(resolution({ ...data, photos: [{ selector: "#photo", density: .8 }] }).status).toBe("fail");
  expect(resolution({ ...data, photos: [{ selector: "#photo", density: 1.5 }] }).status).toBe("warning");
  expect(reducedMotion({ ...data, animations: 1 }).status).toBe("fail");
  expect(resolution({ ...data, visuals: [{ selector: ".generated-visual img", density: .8 }] }).status).toBe("fail");
  expect(resolution({ ...data, visuals: [{ selector: ".generated-visual img", density: 2.1 }] }).status).toBe("pass");
});
test("a glyph mask catches pale foil highlights even when another part of the same text has a dark AA core", async () => {
  const image = async (a: string, b: string) => sharp(Buffer.from(`<svg width="390" height="100"><rect width="390" height="100" fill="#ffffff"/><rect x="25" y="23" width="30" height="15" fill="${a}"/><rect x="60" y="23" width="30" height="15" fill="${b}"/></svg>`)).png().toBuffer();
  const actual = await image("#1e1e1e", "#bbbbbb"), mask = await image("#ff00ff", "#ff00ff");
  expect((await contrast(data, actual, mask)).status).toBe("fail");
  expect((await contrast(data, await image("#1e1e1e", "#1e1e1e"), mask)).status).toBe("pass");
});
test("missing measurements stay incomplete; merging never hides an unavailable viewport or vision check", () => {
  expect(lcp({ lcp: null }).status).toBe("error");
  expect(lcp({ lcp: 3000 }).status).toBe("warning");
  expect(cls({ cls: .11 }).status).toBe("warning");
  expect(mergeChecks([{ id: "contrast", status: "pass", samples: 1, findings: [] }, { id: "contrast", status: "error", samples: 0, findings: [] }])[0].status).toBe("error");
});
