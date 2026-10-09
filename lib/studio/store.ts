import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Content, type Content as EventContent } from "@/lib/schema/content";
import { demoConcepts, safeId } from "@/lib/projects/read";
import { validateTheme } from "@/lib/theme/validate";
import type { Theme } from "@/lib/schema/theme";

export class StudioError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type Concept = { id: string; version: string; theme: Theme };
export type Project = { content: EventContent; revision: string; concepts: Concept[] };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const encode = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

export function validateContent(raw: unknown) {
  const result = Content.safeParse(raw);
  if (!result.success) {
    const issues: Record<string, string> = {
      "rsvp.target": "Укажите действительный адрес Telegram, международный телефон или HTTPS-адрес приёма формы.",
      "date.start": "Укажите корректную дату и время события.",
      "date.timezone": "Укажите часовой пояс в формате Asia/Tashkent.",
      "venue.mapUrl": "Укажите полную ссылку на карту, начиная с https://.",
      "rsvp.deadline": "Проверьте дату, до которой гости должны ответить.",
    };
    throw new StudioError([...new Set(result.error.issues.map((issue) => issues[issue.path.join(".")] ?? "Проверьте обязательные поля анкеты и выбранные значения."))].join(" "));
  }
  const content = result.data;
  if (!content.hosts.every((host) => host.name.trim()) || !content.venue.name.trim() || !content.venue.address.trim()) {
    throw new StudioError("Заполните имена, название места и адрес.");
  }
  if (content.hosts.length > 12 || content.timeline.length > 40 || content.media.length + content.refs.length > 40 || encode(content).length > 150000) {
    throw new StudioError("Слишком много данных в анкете. Сократите текст или количество элементов.");
  }
  if (content.venue.mapUrl && !/^https?:\/\//i.test(content.venue.mapUrl)) throw new StudioError("Ссылка на карту должна начинаться с https:// или http://.");
  if (content.timeline.some((item) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) || !item.title.trim())) throw new StudioError("Укажите время и название каждого пункта программы.");
  return content;
}

export class ProjectStore {
  constructor(private root = path.join(process.cwd(), "projects")) {}
  private directory(slug: string, writable = false) {
    if (!safeId(slug) || slug === "new") throw new StudioError("Адрес проекта: 1–64 латинских буквы, цифры и дефисы.");
    if (writable && slug === "demo") throw new StudioError("Демонстрационный проект доступен только для просмотра.", 403);
    return path.join(this.root, slug);
  }
  private async snapshot(slug: string) {
    try {
      const text = await readFile(path.join(this.directory(slug), "content.json"), "utf8");
      const content = Content.parse(JSON.parse(text));
      if (content.slug !== slug) throw new Error("Project directory and slug differ");
      return { content, revision: hash(text) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StudioError("Проект не найден.", 404);
      throw error;
    }
  }
  async read(slug: string): Promise<Project> {
    const snapshot = await this.snapshot(slug);
    const root = path.join(this.directory(slug), "concepts");
    const directories = await readdir(root, { withFileTypes: true });
    const concepts = await Promise.all(directories.filter((entry) => entry.isDirectory() && safeId(entry.name)).map(async (entry) => {
      const files = await readdir(path.join(root, entry.name));
      const version = files.map((file) => /^v([1-9]\d{0,4})\.json$/.exec(file)?.[1]).filter((v): v is string => Boolean(v)).sort((a, b) => Number(b) - Number(a))[0];
      if (!version) throw new Error(`No concept version: ${entry.name}`);
      const raw = JSON.parse(await readFile(path.join(root, entry.name, `v${version}.json`), "utf8"));
      const result = validateTheme(raw, { locale: snapshot.content.locale });
      if (!result.ok) throw new Error(`Invalid concept: ${result.errors.join("; ")}`);
      return { id: entry.name, version, theme: result.theme };
    }));
    const order = ["letter", "poster", "folio", "arch", "botanical"];
    concepts.sort((a, b) => order.indexOf(a.theme.layout.composition) - order.indexOf(b.theme.layout.composition));
    return { ...snapshot, concepts };
  }
  async list() {
    await mkdir(this.root, { recursive: true });
    const dirs = await readdir(this.root, { withFileTypes: true });
    return (await Promise.all(dirs.filter((dir) => dir.isDirectory() && safeId(dir.name)).map(async (dir) => {
      const project = await this.read(dir.name);
      const info = await stat(path.join(this.root, dir.name, "content.json"));
      return { slug: dir.name, names: project.content.hosts.map((host) => host.name).join(" и "), date: project.content.date.start, timezone: project.content.date.timezone, venue: project.content.venue.name, count: project.concepts.length, updated: info.mtimeMs };
    }))).sort((a, b) => b.updated - a.updated);
  }
  async create(raw: unknown, templates?: Concept[]) {
    const content = validateContent(raw);
    const destination = this.directory(content.slug, true);
    if (content.media.length || content.refs.length) throw new StudioError("Загрузите изображения после создания проекта.");
    const concepts = templates ?? await demoConcepts();
    for (const concept of concepts) {
      if (!safeId(concept.id)) throw new StudioError("Некорректный шаблон.");
      const result = validateTheme(concept.theme, { locale: content.locale });
      if (!result.ok) throw new StudioError("Выбранные темы не поддерживают язык проекта.");
    }
    await mkdir(this.root, { recursive: true });
    const pending = path.join(this.root, `.create-${randomUUID()}`);
    await mkdir(pending);
    try {
      await writeFile(path.join(pending, "content.json"), encode(content), { flag: "wx" });
      await writeFile(path.join(pending, "asset-plan.json"), encode({ assets: [], unifiedTreatment: "none" }), { flag: "wx" });
      for (const concept of concepts) {
        const dir = path.join(pending, "concepts", concept.id);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, "v1.json"), encode(concept.theme), { flag: "wx" });
      }
      await rename(pending, destination);
    } catch (error) {
      if (["EEXIST", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? "")) throw new StudioError("Этот адрес уже занят. Выберите другой.", 409);
      throw error;
    } finally { await rm(pending, { recursive: true, force: true }); }
    return this.read(content.slug);
  }
  private async mutate(slug: string, revision: string, change: (content: EventContent) => Promise<EventContent>) {
    const dir = this.directory(slug, true);
    await this.snapshot(slug);
    const lock = path.join(dir, ".studio-lock");
    try { await mkdir(lock); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new StudioError("Проект сейчас сохраняется. Повторите через несколько секунд.", 409);
      throw error;
    }
    const temporary = path.join(dir, `.content-${randomUUID()}.json`);
    try {
      const current = await this.snapshot(slug);
      if (current.revision !== revision) throw new StudioError("Проект изменён в другой вкладке. Скопируйте свои изменения и обновите страницу.", 409);
      const content = validateContent(await change(current.content));
      const text = encode(content);
      await writeFile(temporary, text, { flag: "wx" });
      await rename(temporary, path.join(dir, "content.json"));
      return { content, revision: hash(text) };
    } finally {
      await rm(temporary, { force: true });
      await rm(lock, { recursive: true, force: true });
    }
  }
  async update(slug: string, raw: unknown, revision: string) {
    const proposed = validateContent(raw);
    if (proposed.slug !== slug) throw new StudioError("Адрес созданного проекта изменить нельзя.");
    return this.mutate(slug, revision, async (current) => {
      const project = await this.read(slug);
      for (const concept of project.concepts) {
        if (!validateTheme(concept.theme, { locale: proposed.locale }).ok) throw new StudioError("Темы проекта не поддерживают выбранный язык.");
      }
      return { ...proposed, media: current.media, refs: current.refs };
    });
  }
  async upload(slug: string, revision: string, kind: string, file: File) {
    if (kind !== "photo" && kind !== "reference") throw new StudioError("Выберите фотографию или референс.");
    if (!file.size || file.size > 15 * 1024 * 1024) throw new StudioError("Размер изображения должен быть от 1 байта до 15 МБ.");
    const bytes = Buffer.from(await file.arrayBuffer());
    let output: Buffer;
    try {
      const image = sharp(bytes, { limitInputPixels: 40000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
      output = await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
    } catch { throw new StudioError("Файл не удалось прочитать. Выберите обычное изображение JPG, PNG или WebP."); }
    const id = randomUUID();
    const filename = `${id}.webp`;
    const directory = path.join(this.directory(slug, true), "media");
    const src = `/api/projects/${slug}/media/${filename}`;
    let written = false;
    try {
      return await this.mutate(slug, revision, async (content) => {
        if (content.media.length + content.refs.length >= 40) throw new StudioError("В проекте уже 40 изображений. Удалите ненужные перед загрузкой.");
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, filename), output, { flag: "wx" });
        written = true;
        return kind === "photo" ? { ...content, media: [...content.media, { id, src }] } : { ...content, refs: [...content.refs, src] };
      });
    } catch (error) {
      if (written) await rm(path.join(directory, filename), { force: true });
      throw error;
    }
  }
  async removeMedia(slug: string, revision: string, src: string) {
    const result = await this.mutate(slug, revision, async (content) => {
      if (!content.media.some((media) => media.src === src) && !content.refs.includes(src)) throw new StudioError("Изображение не найдено.", 404);
      return { ...content, media: content.media.filter((media) => media.src !== src), refs: content.refs.filter((ref) => ref !== src) };
    });
    // Original files are retained so future approved snapshots can still refer to them.
    return result;
  }
  async media(slug: string, filename: string) {
    if (!/^[a-f0-9-]{36}\.webp$/.test(filename)) throw new StudioError("Изображение не найдено.", 404);
    const project = await this.snapshot(slug);
    const src = `/api/projects/${slug}/media/${filename}`;
    if (!project.content.media.some((media) => media.src === src) && !project.content.refs.includes(src)) throw new StudioError("Изображение не найдено.", 404);
    try { return await readFile(path.join(this.directory(slug), "media", filename)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new StudioError("Изображение не найдено.", 404);
      throw error;
    }
  }
}
export const projectStore = new ProjectStore();
