import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { ProjectStore } from "./store";
import { Content } from "@/lib/schema/content";
import { Theme } from "@/lib/schema/theme";
import { resolveWallTime, wallTime } from "./date";
import { mutationRequest } from "./http";

let root: string;
let store: ProjectStore;
const demo = Content.parse(JSON.parse(await readFile(path.join(process.cwd(), "projects/demo/content.json"), "utf8")));
const theme = Theme.parse(JSON.parse(await readFile(path.join(process.cwd(), "projects/demo/concepts/arch/v2.json"), "utf8")));
const content = () => ({ ...structuredClone(demo), slug: "new-event", hosts: [{ name: "Дилшод" }, { name: "Малика" }], refs: [] });
const templates = [{ id: "arch", version: "2", theme }];
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), "invitation-studio-test-")); store = new ProjectStore(root); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

test("creates five actual themes, fresh v1 snapshots, list and reload", async () => {
  const project = await store.create(content());
  expect(project.concepts).toHaveLength(5);
  expect(project.concepts.every((concept) => concept.version === "1")).toBe(true);
  expect(project.concepts.find((concept) => concept.id === "arch")?.theme.artwork).toBe("suzani-atelier");
  expect((await store.list())[0].names).toBe("Дилшод и Малика");
  expect((await store.read("new-event")).revision).toBe(project.revision);
  await expect(store.create(content())).rejects.toMatchObject({ status: 409 });
  expect((await readdir(root)).some((name) => name.startsWith(".create"))).toBe(false);
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
