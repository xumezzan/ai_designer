import { expect, test } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { inspectVision } from "./vision";
test("vision uses forced tool output for three questions and does not turn malformed or failed calls into passes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "qa-vision-test-"));
  try {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
    const evidence = [390, 1440].map((width) => ({ file: `screen-${width}.png`, label: `Screen ${width}` }));
    for (const entry of evidence) await writeFile(path.join(directory, entry.file), png);
    const input = { checks: ["face-crop", "busy-photo", "alignment"].map((id) => ({ id, defect: id === "face-crop" ? "yes" : "uncertain", viewport: 390, reason: "Контролируемый ответ" })) };
    let request: unknown;
    const client = { messages: { create: async (params: unknown) => { request = params; return { stop_reason: "tool_use", content: [{ type: "tool_use", name: "report_visual_defects", input }] }; } } } as unknown as Anthropic;
    const result = await inspectVision(directory, evidence, client);
    expect(request).toMatchObject({ tool_choice: { type: "tool", name: "report_visual_defects" }, max_tokens: 1600 });
    expect(result.checks.map((check) => check.status)).toEqual(["fail", "warning", "warning"]);
    input.checks[1].id = "face-crop";
    expect((await inspectVision(directory, evidence, client)).checks.every((check) => check.status === "error")).toBe(true);
    const broken = { messages: { create: async () => { throw new Error("offline"); } } } as unknown as Anthropic;
    expect((await inspectVision(directory, evidence, broken)).model).toBeNull();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
