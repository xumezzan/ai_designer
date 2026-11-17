import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdir, mkdtemp, rm, writeFile, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { composeSeries } from "./series";
import { fixtureSeries } from "./fixture";
import { readRecentDesigns } from "./history";
import { designIdentity, MAX_RECENT_DESIGNS } from "./diversity";
import { TYPE_SET_IDS } from "@/registry/keys";
import type { Theme } from "@/lib/schema/theme";

let root: string;
const theme = composeSeries(fixtureSeries, "ru", []).themes[0];
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), "invitation-design-memory-")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
async function save(slug: string, concept: string, design: Theme, version = 1) {
  const directory = path.join(root, slug, "concepts", concept);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `v${version}.json`), JSON.stringify(design));
}
test("memory includes older batches, selects the newest version and excludes event facts", async () => {
  await save("event-a", "old-batch", { ...theme, meta: { ...theme.meta, name: "PRIVATE NAME", rationale: "PRIVATE VENUE" } });
  const later = { ...theme, typeSet: "poetic" as const, layout: { ...theme.layout, composition: "poster" as const } };
  await save("event-a", "active-batch", theme);
  await save("event-a", "active-batch", later, 2);
  await writeFile(path.join(root, "event-a", "generation.json"), JSON.stringify({ concepts: [{ id: "active-batch", version: "2" }] }));
  const memory = await readRecentDesigns(root, "event-a");
  expect(memory).toContainEqual(designIdentity(theme));
  expect(memory).toContainEqual(designIdentity(later));
  expect(JSON.stringify(memory)).not.toMatch(/PRIVATE|active-batch|event-a/);
});
test("memory is bounded, chronological and deduplicates repeated directions", async () => {
  for (let index = 0; index < 20; index++) {
    await save("other-event", `design-${index}`, { ...theme, typeSet: TYPE_SET_IDS[index % TYPE_SET_IDS.length], layout: { ...theme.layout, composition: ["letter", "poster", "folio"][Math.floor(index / 6) % 3] as Theme["layout"]["composition"] } });
  }
  const current = { ...theme, typeSet: "handwritten" as const, layout: { ...theme.layout, composition: "botanical" as const } };
  await save("current-event", "current", current);
  await save("current-event", "duplicate", current);
  const memory = await readRecentDesigns(root, "current-event");
  expect(memory).toHaveLength(MAX_RECENT_DESIGNS);
  expect(memory[0]).toEqual(designIdentity(current));
  expect(new Set(memory.map((entry) => JSON.stringify(entry))).size).toBe(memory.length);
});
test("a newer other-project design precedes an older current-project design", async () => {
  await save("current-event", "old", theme);
  await utimes(path.join(root, "current-event", "concepts", "old", "v1.json"), 1, 1);
  const newer = { ...theme, typeSet: "poetic" as const };
  await save("other-event", "newer", newer);
  const memory = await readRecentDesigns(root, "current-event");
  expect(memory[0]).toEqual(designIdentity(newer));
  expect(memory[1]).toEqual(designIdentity(theme));
});
test("missing or incomplete legacy files do not break a new request", async () => {
  expect(await readRecentDesigns(path.join(root, "missing"), "current-event")).toEqual([]);
  await mkdir(path.join(root, "incomplete", "concepts", "broken"), { recursive: true });
  await writeFile(path.join(root, "incomplete", "concepts", "broken", "v1.json"), "{broken json");
  expect(await readRecentDesigns(root, "current-event")).toEqual([]);
});
