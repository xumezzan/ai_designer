import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { ProjectStore } from "./store";
import { Content } from "@/lib/schema/content";
import { Theme } from "@/lib/schema/theme";
import { resolveWallTime, wallTime } from "./date";
import { composeSeries, sharedStyleSignature } from "@/lib/generation/series";
import { fixtureSeries } from "@/lib/generation/fixture";
import { readDirectedPhotos } from "@/lib/assets/read";
import { mutationRequest } from "./http";
import { createHash, randomUUID } from "node:crypto";
import { readGeneratedVisual } from "@/lib/artwork/generated";

let root: string;
let store: ProjectStore;
const demo = Content.parse(JSON.parse(await readFile(path.join(process.cwd(), "projects/demo/content.json"), "utf8")));
const theme = Theme.parse(JSON.parse(await readFile(path.join(process.cwd(), "projects/demo/concepts/arch/v2.json"), "utf8")));
const content = () => ({ ...structuredClone(demo), slug: "new-event", hosts: [{ name: "Дилшод" }, { name: "Малика" }], refs: [] });
const templates = [{ id: "arch", version: "2", theme }];
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), "invitation-studio-test-")); store = new ProjectStore(root); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

test("commits original art with its batch, retains historical bytes, detects tampering and refuses stale writes", async () => {
  const project = await store.create({ ...content(), brief: "Ар-деко" });
  const data = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#222222" } }).webp().toBuffer();
  const record = { id: randomUUID(), sha256: createHash("sha256").update(data).digest("hex"), width: 1536, height: 1024, model: "test-fixture", prompt: "Controlled test image", createdAt: new Date().toISOString(), references: 0 };
  const raw = structuredClone(fixtureSeries);
  raw.style.generatedVisual = { id: record.id, sha256: record.sha256, width: record.width, height: record.height };
  const generated = { ...composeSeries(raw, "ru", []), model: "controlled-test", elapsedMs: 1, references: 0, visual: { data, record } };
  await expect(store.saveGeneration("new-event", { ...generated, visual: { data, record: { ...record, isolated: true } } }, project.revision, project.planRevision, project.generationRevision)).rejects.toThrow("Новый визуал не соответствует серии");
  const first = await store.saveGeneration("new-event", generated, project.revision, project.planRevision, project.generationRevision);
  expect(first.concepts.every((concept) => concept.theme.generatedVisual?.id === record.id)).toBe(true);
  expect((await readGeneratedVisual("new-event", record.id, raw.style.generatedVisual, root))?.data).toEqual(data);
  expect(await readGeneratedVisual("../escape", record.id, undefined, root)).toBeNull();
  expect(await readGeneratedVisual("new-event", "../escape", undefined, root)).toBeNull();
  const staleRecord = { ...record, id: randomUUID() };
  await expect(store.saveGeneration("new-event", { ...generated, visual: { data, record: staleRecord } }, project.revision, project.planRevision, project.generationRevision)).rejects.toMatchObject({ status: 409 });
  expect(await readdir(path.join(root, "new-event/art"))).toEqual([record.id]);
  await store.saveGeneration("new-event", { ...composeSeries(fixtureSeries, "ru", []), model: "controlled-test", elapsedMs: 1, references: 0 }, first.revision, first.planRevision, first.generationRevision);
  expect((await store.version("new-event", first.concepts[0].id, "1")).generatedVisual?.id).toBe(record.id);
  expect((await readGeneratedVisual("new-event", record.id, raw.style.generatedVisual, root))?.data).toEqual(data);
  await writeFile(path.join(root, "new-event/art", record.id, "image.webp"), "tampered");
  await expect(readGeneratedVisual("new-event", record.id, raw.style.generatedVisual, root)).rejects.toThrow("integrity");
});

test("creates an empty project without stock demo themes, then persists facts", async () => {
  const project = await store.create(content());
  expect(project.concepts).toHaveLength(0);
  expect(project.generation).toBeNull();
  expect(await readdir(path.join(root, "new-event/concepts"))).toEqual([]);
  expect((await store.list())[0].names).toBe("Дилшод и Малика");
  expect((await store.list())[0].preview).toBeNull();
  expect((await store.read("new-event")).revision).toBe(project.revision);
  await expect(store.create(content())).rejects.toMatchObject({ status: 409 });
  expect((await readdir(root)).some((name) => name.startsWith(".create"))).toBe(false);
});

test("project cover uses the current series, then preserves the selected version across new batches", async () => {
  const project = await store.create(content());
  const generated = { ...composeSeries(fixtureSeries, "ru", []), model: "controlled-test", elapsedMs: 1, references: 0 };
  const first = await store.saveGeneration("new-event", generated, project.revision, project.planRevision, project.generationRevision);
  expect((await store.list())[0].preview).toEqual({ href: `/preview/new-event/${first.concepts[0].id}/${first.concepts[0].version}?embed=1`, selected: false });
  const selected = first.concepts[2];
  await writeFile(path.join(root, "new-event/approved.json"), JSON.stringify({ conceptId: selected.id, version: selected.version, approvedAt: new Date().toISOString() }));
  const second = await store.saveGeneration("new-event", generated, first.revision, first.planRevision, first.generationRevision);
  expect(second.concepts.some((concept) => concept.id === selected.id)).toBe(false);
  expect((await store.list())[0].preview).toEqual({ href: `/preview/new-event/${selected.id}/${selected.version}?embed=1`, selected: true });
});

test("uncommitted initial generation directories stay invisible to readers", async () => {
  await store.create(content());
  await mkdir(path.join(root, "new-event/concepts/variant-pending-1"));
  expect((await store.read("new-event")).concepts).toEqual([]);
  expect((await store.list())[0].count).toBe(0);
});

test("save changes event facts, retains immutable themes and rejects stale revisions", async () => {
  const project = await store.create(content(), templates);
  const before = await readFile(path.join(root, "new-event/concepts/arch/v1.json"), "utf8");
  const saved = await store.update("new-event", { ...project.content, greeting: "Новый текст" }, project.revision);
  expect(saved.content.greeting).toBe("Новый текст");
  await expect(store.update("new-event", project.content, project.revision)).rejects.toMatchObject({ status: 409 });
  expect(await readFile(path.join(root, "new-event/concepts/arch/v1.json"), "utf8")).toBe(before);
  expect(await readdir(path.join(root, "new-event"))).not.toContain(".studio-lock");
});

test("rejects traversal, reserved demo/new, malformed facts and unsafe map links", async () => {
  await expect(store.create({ ...content(), slug: "../escape" }, templates)).rejects.toThrow("Адрес");
  await expect(store.create({ ...content(), slug: "demo" }, templates)).rejects.toMatchObject({ status: 403 });
  await expect(store.create({ ...content(), slug: "new" }, templates)).rejects.toThrow("Адрес");
  await expect(store.create({ ...content(), hosts: [{ name: " " }] }, templates)).rejects.toThrow("Заполните");
  await expect(store.create({ ...content(), venue: { ...content().venue, mapUrl: "javascript:alert(1)" } }, templates)).rejects.toThrow("Ссылка");
  await expect(store.read("missing")).rejects.toMatchObject({ status: 404 });
});

test("validates and converts uploads, keeps photos/refs separate, prevents form overwrites", async () => {
  const project = await store.create(content(), templates);
  const image = await sharp({ create: { width: 12, height: 12, channels: 3, background: "#334455" } }).png().toBuffer();
  const file = new File([new Uint8Array(image)], "portrait.png", { type: "image/png" });
  const photo = await store.upload("new-event", project.revision, "photo", file);
  expect(photo.content.media).toHaveLength(1);
  const filename = photo.content.media[0].src.split("/").at(-1)!;
  expect((await sharp(await store.media("new-event", filename)).metadata()).format).toBe("webp");
  const reference = await store.upload("new-event", photo.revision, "reference", file);
  expect(reference.content.refs).toHaveLength(1);
  const edited = await store.update("new-event", { ...reference.content, media: [], refs: [] }, reference.revision);
  expect(edited.content.media).toHaveLength(1);
  expect(edited.content.refs).toHaveLength(1);
  const removed = await store.removeMedia("new-event", edited.revision, photo.content.media[0].src);
  expect(removed.content.media).toHaveLength(0);
  await expect(store.media("new-event", filename)).rejects.toMatchObject({ status: 404 });
  await expect(store.media("new-event", "../../content.json")).rejects.toMatchObject({ status: 404 });
});

test("failed or stale uploads never leave orphan files", async () => {
  const project = await store.create(content(), templates);
  await expect(store.upload("new-event", project.revision, "photo", new File(["bad"], "bad.jpg"))).rejects.toThrow("Файл");
  const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  await expect(store.upload("new-event", "stale", "photo", new File([new Uint8Array(bytes)], "a.png"))).rejects.toMatchObject({ status: 409 });
  expect((await readdir(path.join(root, "new-event"))).includes("media")).toBe(false);
});

test("wall time uses event timezone and round trips positive, negative and fractional offsets", () => {
  expect(resolveWallTime("2027-04-24T17:00", "Asia/Tashkent")).toBe("2027-04-24T17:00:00+05:00");
  expect(resolveWallTime("2027-01-15T17:00", "America/New_York")).toBe("2027-01-15T17:00:00-05:00");
  expect(resolveWallTime("2027-04-24T17:00", "Asia/Kathmandu")).toBe("2027-04-24T17:00:00+05:45");
  expect(wallTime("2027-04-24T17:00:00+05:00", "Europe/Moscow")).toBe("2027-04-24T15:00");
});

test("rejects invalid dates, IANA zones and DST gaps/ambiguous times", () => {
  expect(() => resolveWallTime("2027-02-30T17:00", "Asia/Tashkent")).toThrow();
  expect(() => resolveWallTime("2027-03-14T02:30", "America/New_York")).toThrow("нет");
  expect(() => resolveWallTime("2027-11-07T01:30", "America/New_York")).toThrow("повторяется");
  expect(() => resolveWallTime("2027-04-24T17:00", "Mars/Base")).toThrow("Часовой пояс".toLowerCase());
});

test("same-host writes work through Next's internal localhost URL, foreign origins fail", () => {
  expect(() => mutationRequest(new Request("http://localhost:3147/api/projects", { headers: { host: "127.0.0.1:3147", origin: "http://127.0.0.1:3147" } }))).not.toThrow();
  expect(() => mutationRequest(new Request("http://localhost:3147/api/projects", { headers: { host: "127.0.0.1:3147", origin: "https://foreign.example" } }))).toThrow("адреса");
});

test("plan revisions protect photo settings and reject foreign ids/undersized hero", async () => {
  const project = await store.create(content(), templates);
  const bytes = await sharp({ create: { width: 640, height: 400, channels: 3, background: "#334455" } }).png().toBuffer();
  const photo = await store.upload("new-event", project.revision, "photo", new File([new Uint8Array(bytes)], "photo.png"));
  const current = await store.read("new-event");
  expect(current.assetPlan.assets[0].role).toBe("unused");
  const asset = { ...current.assetPlan.assets[0], role: "portrait" as const, placement: { section: "greeting" as const, index: 0 } };
  const raw = { assets: [asset], unifiedTreatment: "bw" };
  const saved = await store.updatePlan("new-event", raw, photo.revision, current.planRevision);
  expect(saved.assetPlan.unifiedTreatment).toBe("bw");
  expect(saved.assetPlan.assets[0].maxViewportShare).toBe(.35);
  await expect(store.updatePlan("new-event", raw, photo.revision, current.planRevision)).rejects.toMatchObject({ status: 409 });
  await expect(store.updatePlan("new-event", { ...raw, assets: [{ ...asset, id: "foreign" }] }, photo.revision, saved.planRevision)).rejects.toThrow("План");
  await expect(store.updatePlan("new-event", { ...raw, assets: [{ ...asset, quality: "high", role: "hero", placement: { section: "hero", index: 0 } }] }, photo.revision, saved.planRevision)).rejects.toThrow("600");
  expect((await store.read("new-event")).assetPlan.unifiedTreatment).toBe("bw");
});


test("saving event facts preserves a valid full-photo theme and the independent photo plan", async () => {
  const project = await store.create(content(), templates);
  const bytes = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#334455" } }).png().toBuffer();
  const uploaded = await store.upload("new-event", project.revision, "photo", new File([new Uint8Array(bytes)], "photo.png"));
  const current = await store.read("new-event");
  const asset = { ...current.assetPlan.assets[0], role: "hero", quality: "high", placement: { section: "hero", index: 0 } };
  const saved = await store.updatePlan("new-event", { assets: [asset], unifiedTreatment: "bw" }, uploaded.revision, current.planRevision);
  const next = { ...theme, layout: { ...theme.layout, hero: "full-photo" } };
  await writeFile(path.join(root, "new-event/concepts/arch/v2.json"), JSON.stringify(next));
  await store.update("new-event", { ...current.content, greeting: "Обновлённый текст" }, uploaded.revision);
  const result = await store.read("new-event");
  expect(result.concepts[0].theme.layout.hero).toBe("full-photo");
  expect(result.planRevision).toBe(saved.planRevision);
  expect(result.content.greeting).toBe("Обновлённый текст");
});


test("generation atomically selects five validated variants and retains previous immutable batches", async () => {
  const project = await store.create({ ...content(), brief: "Тёмное ар-деко" });
  const generated = { ...composeSeries(fixtureSeries, "ru", []), model: "controlled-test", elapsedMs: 100, references: 0 };
  const first = await store.saveGeneration("new-event", generated, project.revision, project.planRevision, project.generationRevision);
  expect(first.concepts).toHaveLength(5);
  expect(first.generation?.brief).toBe("Тёмное ар-деко");
  expect(new Set(first.concepts.map((concept) => sharedStyleSignature(concept.theme))).size).toBe(1);
  const oldFile = path.join(root, "new-event/concepts", first.concepts[0].id, "v1.json");
  const before = await readFile(oldFile, "utf8");
  await expect(store.saveGeneration("new-event", generated, project.revision, project.planRevision, project.generationRevision)).rejects.toMatchObject({ status: 409 });
  const second = await store.saveGeneration("new-event", generated, first.revision, first.planRevision, first.generationRevision);
  expect(second.generation?.batchId).not.toBe(first.generation?.batchId);
  expect(second.concepts).toHaveLength(5);
  expect(await readdir(path.join(root, "new-event/concepts"))).toHaveLength(10);
  expect(await readFile(oldFile, "utf8")).toBe(before);
  expect(second.concepts.some((concept) => concept.id === first.concepts[0].id)).toBe(false);
  const mixed = structuredClone(generated); mixed.themes[1].palette.bg = "#223344";
  await expect(store.saveGeneration("new-event", mixed, second.revision, second.planRevision, second.generationRevision)).rejects.toThrow("одном стиле");
  expect((await store.read("new-event")).generation?.batchId).toBe(second.generation?.batchId);
  const changed = await store.update("new-event", { ...second.content, brief: "Новый бриф" }, second.revision);
  await expect(store.saveGeneration("new-event", generated, second.revision, second.planRevision, second.generationRevision)).rejects.toMatchObject({ status: 409 });
  expect(changed.content.brief).toBe("Новый бриф");
});

test("removing a generated hero photo keeps the project readable and allows a new generation", async () => {
  const project = await store.create({ ...content(), brief: "Тёмное ар-деко" });
  const bytes = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#334455" } }).png().toBuffer();
  const uploaded = await store.upload("new-event", project.revision, "photo", new File([new Uint8Array(bytes)], "photo.png"));
  const current = await store.read("new-event");
  const asset = { ...current.assetPlan.assets[0], quality: "high", role: "portrait", placement: { section: "greeting", index: 0 } };
  const plan = await store.updatePlan("new-event", { assets: [asset], unifiedTreatment: "bw" }, uploaded.revision, current.planRevision);
  const photos = await readDirectedPhotos(uploaded.content, plan.assetPlan, path.join(root, "new-event"));
  const series = structuredClone(fixtureSeries);
  series.variants.forEach((variant) => { variant.photos = [{ id: asset.id, section: "hero", index: 0, position: "after" }]; });
  series.variants[0].layout.hero = "full-photo";
  const generated = { ...composeSeries(series, "ru", photos), model: "controlled-test", elapsedMs: 100, references: 0 };
  const batch = await store.saveGeneration("new-event", generated, uploaded.revision, plan.planRevision, current.generationRevision);
  const file = path.join(root, "new-event/concepts", batch.concepts[0].id, "v1.json");
  const before = await readFile(file, "utf8");
  await store.removeMedia("new-event", batch.revision, uploaded.content.media[0].src);
  const removed = await store.read("new-event");
  expect(removed.concepts[0].theme.layout.hero).toBe("typographic");
  expect(await readFile(file, "utf8")).toBe(before);
  const next = await store.saveGeneration("new-event", { ...composeSeries(fixtureSeries, "ru", []), model: "controlled-test", elapsedMs: 100, references: 0 }, removed.revision, removed.planRevision, removed.generationRevision);
  expect(next.concepts).toHaveLength(5);
});

test.each([1, 2, 3, 4, 5])("persists and lists a project with %s generated variants", async (variantCount) => {
  const project = await store.create({ ...content(), brief: "Ар-деко", variantCount });
  const raw = { ...fixtureSeries, variants: fixtureSeries.variants.slice(0, variantCount) };
  const generated = { ...composeSeries(raw, "ru", []), model: "controlled-test", elapsedMs: 1, references: 0 };
  const saved = await store.saveGeneration("new-event", generated, project.revision, project.planRevision, project.generationRevision);
  expect(saved.concepts).toHaveLength(variantCount);
  const reloaded = await store.read("new-event");
  expect(reloaded.content.variantCount).toBe(variantCount);
  expect(reloaded.generation?.concepts).toHaveLength(variantCount);
  expect(reloaded.concepts.every(concept => concept.history?.length === 1)).toBe(true);
  expect((await store.list())[0].count).toBe(variantCount);
});

test("wrong-count batches and invalid count preferences leave the previous project intact", async () => {
  const project = await store.create({ ...content(), brief: "Ар-деко", variantCount: 2 });
  const generated = { ...composeSeries(fixtureSeries, "ru", []), model: "controlled-test", elapsedMs: 1, references: 0 };
  await expect(store.saveGeneration("new-event", generated, project.revision, project.planRevision, project.generationRevision)).rejects.toMatchObject({ status: 400 });
  expect((await store.read("new-event")).generation).toBeNull();
  for (const variantCount of [0, 6, 1.5]) {
    await expect(store.update("new-event", { ...project.content, variantCount }, project.revision)).rejects.toMatchObject({ status: 400 });
  }
  expect((await store.read("new-event")).content.variantCount).toBe(2);
});
