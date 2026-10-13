import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Content, type Content as EventContent } from "@/lib/schema/content";
import { safeId } from "@/lib/projects/read";
import { validateTheme } from "@/lib/theme/validate";
import { Theme } from "@/lib/schema/theme";
import { AssetPlan, type AssetPlan as PhotoPlan } from "@/lib/schema/assetPlan";
import { heroGrade, unusedAsset, type ImageInfo } from "@/lib/assets/crop";
import { photoInfo, readDirectedPhotos } from "@/lib/assets/read";
import { availablePhotoLayout, hasHeroPhoto } from "@/lib/assets/layout";
import { Generation } from "@/lib/schema/generation";
import { artDirection, composeSeries, sharedStyleSignature, type GeneratedSeries } from "@/lib/generation/series";
import { Approval, VersionId, VersionRecord, type HistoryItem } from "@/lib/schema/versions";
import { applyRefinement, type RefinedTheme } from "@/lib/versions/refine";
import { QaReport, QA_ENGINE, type QaState } from "@/lib/schema/qa";
import { digest, rendererRevision } from "@/lib/qa/fingerprint";
import { approvalProblem } from "@/lib/qa/policy";
import { VisualRecord } from "@/lib/schema/visual";
import { readGeneratedVisual } from "@/lib/artwork/generated";

export class StudioError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type Concept = { id: string; version: string; theme: Theme; history?: HistoryItem[] };
export type Planning = { assetPlan: PhotoPlan; planRevision: string; mediaInfo: Record<string, ImageInfo> };
export type Project = { content: EventContent; revision: string; concepts: Concept[]; visionConfigured: boolean; imagesConfigured?: boolean; generation: Generation | null; generationRevision: string; approval: Approval | null; approvalRevision: string; approvalQa?: QaState | null } & Planning;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const encode = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
async function optionalText(file: string) {
  try { return await readFile(file, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw error; }
}

export function validateContent(raw: unknown) {
  const result = Content.safeParse(raw);
  if (!result.success) {
    const issues: Record<string, string> = {
      "rsvp.target": "Укажите действительный адрес Telegram, международный телефон или HTTPS-адрес приёма формы.",
      "date.start": "Укажите корректную дату и время события.",
      "date.timezone": "Укажите часовой пояс в формате Asia/Tashkent.",
      "venue.mapUrl": "Укажите полную ссылку на карту, начиная с https://.",
      "rsvp.deadline": "Проверьте дату, до которой гости должны ответить.",
      "variantCount": "Выберите количество вариантов от 1 до 5.",
    };
    throw new StudioError([...new Set(result.error.issues.map((issue) => issues[issue.path.join(".")] ?? "Проверьте обязательные поля анкеты и выбранные значения."))].join(" "));
  }
  const content = result.data;
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
    const planning = await this.planning(slug, snapshot.content);
    const qaContext = { contentRevision: snapshot.revision, planRevision: planning.planRevision, rendererRevision: await rendererRevision() };
    const root = path.join(this.directory(slug), "concepts");
    let generationText = "";
    try { generationText = await readFile(path.join(this.directory(slug), "generation.json"), "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const generation = generationText ? Generation.parse(JSON.parse(generationText)) : null;
    const directories = await readdir(root, { withFileTypes: true });
    const concepts = await Promise.all(directories.filter((entry) => entry.isDirectory() && safeId(entry.name) && (generation ? generation.concepts.some((concept) => concept.id === entry.name) : !entry.name.startsWith("variant-"))).map(async (entry) => {
      const files = await readdir(path.join(root, entry.name));
      const version = generation?.concepts.find((concept) => concept.id === entry.name)?.version ?? files.map((file) => /^v([1-9]\d{0,4})\.json$/.exec(file)?.[1]).filter((v): v is string => Boolean(v)).sort((a, b) => Number(b) - Number(a))[0];
      if (!version) throw new Error(`No concept version: ${entry.name}`);
      const raw = JSON.parse(await readFile(path.join(root, entry.name, `v${version}.json`), "utf8"));
      const parsed = Theme.parse(raw);
      const hasHero = hasHeroPhoto(parsed, planning.assetPlan, planning.mediaInfo);
      const result = validateTheme(availablePhotoLayout(parsed, hasHero), { locale: snapshot.content.locale, hasHighQualityAsset: hasHero });
      if (!result.ok) throw new Error(`Invalid concept: ${result.errors.join("; ")}`);
      return { id: entry.name, version, theme: result.theme, history: await this.history(slug, entry.name, qaContext) };
    }));
    if (generation && concepts.length !== generation.concepts.length) throw new Error("Generation references missing concepts");
    const order = ["letter", "poster", "folio", "arch", "botanical"];
    concepts.sort((a, b) => order.indexOf(a.theme.layout.composition) - order.indexOf(b.theme.layout.composition));
    const approvalText = await optionalText(path.join(this.directory(slug), "approved.json"));
    const approval = approvalText ? Approval.parse(JSON.parse(approvalText)) : null;
    if (approval) await this.version(slug, approval.conceptId, approval.version);
    const approvalQa = approval ? (concepts.find((concept) => concept.id === approval.conceptId)?.history ?? await this.history(slug, approval.conceptId, qaContext)).find((entry) => entry.version === approval.version)?.qa ?? null : null;
    return { ...snapshot, ...planning, concepts, generation, generationRevision: hash(generationText), approval, approvalQa, approvalRevision: hash(approvalText), visionConfigured: Boolean(process.env.ANTHROPIC_API_KEY), imagesConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()) };
  }
  async version(slug: string, conceptId: string, version: string): Promise<Theme> {
    if (!safeId(conceptId) || !VersionId.safeParse(version).success) throw new StudioError("Некорректный вариант или номер версии.");
    const text = await optionalText(path.join(this.directory(slug), "concepts", conceptId, `v${version}.json`));
    if (!text) throw new StudioError("Версия не найдена.", 404);
    return Theme.parse(JSON.parse(text));
  }
  private async history(slug: string, conceptId: string, context?: { contentRevision: string; planRevision: string; rendererRevision: string }): Promise<HistoryItem[]> {
    const directory = path.join(this.directory(slug), "concepts", conceptId);
    const files = await readdir(directory);
    return Promise.all(files.map((file) => /^v([1-9]\d{0,4})\.json$/.exec(file)?.[1]).filter((version): version is string => Boolean(version)).sort((a, b) => Number(b) - Number(a)).map(async (version) => {
      const theme = await this.version(slug, conceptId, version);
      const text = await optionalText(path.join(directory, `v${version}.meta.json`));
      const record = text ? VersionRecord.parse(JSON.parse(text)) : null;
      if (record && record.version !== version) throw new Error("Version provenance mismatch");
      const reportText = context ? await optionalText(path.join(directory, "qa", `v${version}.json`)) : "";
      const report = reportText ? QaReport.parse(JSON.parse(reportText)) : null;
      if (report && (report.slug !== slug || report.conceptId !== conceptId || report.version !== version)) throw new Error("QA identity mismatch");
      const qa: QaState | undefined = report && context ? { report, stale: report.engine !== QA_ENGINE || report.contentRevision !== context.contentRevision || report.planRevision !== context.planRevision || report.rendererRevision !== context.rendererRevision || report.themeRevision !== digest(JSON.stringify(theme)) } : undefined;
      return { version, name: theme.meta.name, record, ...(qa ? { qa } : {}) };
    }));
  }
  qaDirectory(slug: string, conceptId: string, version: string, runId: string) {
    if (!safeId(conceptId) || !VersionId.safeParse(version).success || !/^[a-f0-9-]{36}$/.test(runId)) throw new StudioError("Некорректная проверка.");
    return path.join(this.directory(slug, true), "concepts", conceptId, "qa", `v${version}-${runId}`);
  }
  async saveQa(raw: QaReport, generationRevision: string) {
    const report = QaReport.parse(raw);
    if (report.engine !== QA_ENGINE) throw new StudioError("Версия проверки устарела.", 409);
    return this.locked(report.slug, report.contentRevision, async () => {
      const project = await this.read(report.slug);
      this.checkDesign(project, report.conceptId, report.planRevision, generationRevision);
      const theme = await this.version(report.slug, report.conceptId, report.version);
      if (digest(JSON.stringify(theme)) !== report.themeRevision || await rendererRevision() !== report.rendererRevision) throw new StudioError("Дизайн изменился во время проверки. Повторите её.", 409);
      const directory = path.join(this.directory(report.slug), "concepts", report.conceptId, "qa");
      await mkdir(directory, { recursive: true });
      await this.atomicJson(path.join(directory, `v${report.version}.json`), report);
      return this.read(report.slug);
    });
  }
  async qaEvidence(slug: string, conceptId: string, version: string, file: string) {
    await this.version(slug, conceptId, version);
    const text = await optionalText(path.join(this.directory(slug), "concepts", conceptId, "qa", `v${version}.json`));
    const report = text ? QaReport.parse(JSON.parse(text)) : null;
    if (!report?.evidence.some((entry) => entry.file === file)) throw new StudioError("Снимок проверки не найден.", 404);
    return readFile(path.join(this.qaDirectory(slug, conceptId, version, report.runId), file));
  }
  private checkDesign(project: Project, conceptId: string, planRevision: string, generationRevision: string) {
    if (project.planRevision !== planRevision || project.generationRevision !== generationRevision) throw new StudioError("Фото или варианты изменились. Обновите страницу и повторите.", 409);
    if (!project.generation || !project.generation.concepts.some((concept) => concept.id === conceptId)) throw new StudioError("Выберите вариант из текущей серии.", 404);
  }
  private async atomicJson(file: string, value: unknown) {
    const pending = `${file}.${randomUUID()}.tmp`;
    try { await writeFile(pending, encode(value), { flag: "wx" }); await rename(pending, file); }
    finally { await rm(pending, { force: true }); }
  }
  async restoreVersion(slug: string, conceptId: string, version: string, revision: string, planRevision: string, generationRevision: string) {
    return this.locked(slug, revision, async () => {
      const project = await this.read(slug);
      this.checkDesign(project, conceptId, planRevision, generationRevision);
      const source = await this.version(slug, conceptId, version);
      const hasHero = hasHeroPhoto(source, project.assetPlan, project.mediaInfo);
      const valid = validateTheme(availablePhotoLayout(source, hasHero), { locale: project.content.locale, hasHighQualityAsset: hasHero });
      if (!valid.ok) throw new StudioError("Эта версия не подходит текущим данным проекта.");
      await this.atomicJson(path.join(this.directory(slug), "generation.json"), { ...project.generation!, concepts: project.generation!.concepts.map((concept) => concept.id === conceptId ? { ...concept, version } : concept) });
      return this.read(slug);
    });
  }
  async approveVersion(slug: string, conceptId: string, version: string, revision: string, planRevision: string, generationRevision: string, approvalRevision: string, qaOverride = false) {
    return this.locked(slug, revision, async () => {
      const project = await this.read(slug);
      this.checkDesign(project, conceptId, planRevision, generationRevision);
      if (project.approvalRevision !== approvalRevision) throw new StudioError("Выбранная версия изменилась. Обновите страницу.", 409);
      const source = await this.version(slug, conceptId, version);
      const hasHero = hasHeroPhoto(source, project.assetPlan, project.mediaInfo);
      if (!validateTheme(availablePhotoLayout(source, hasHero), { locale: project.content.locale, hasHighQualityAsset: hasHero }).ok) throw new StudioError("Выбранная версия не подходит текущим данным проекта.");
      const qa = project.concepts.find((concept) => concept.id === conceptId)?.history?.find((entry) => entry.version === version)?.qa;
      const problem = approvalProblem(qa, qaOverride === true);
      if (problem) throw new StudioError(problem, 409);
      const approval = Approval.parse({ conceptId, version, approvedAt: new Date().toISOString(), qa: { runId: qa!.report.runId, override: qaOverride === true } });
      await this.atomicJson(path.join(this.directory(slug), "approved.json"), approval);
      return this.read(slug);
    });
  }
  async saveRefinement(input: { slug: string; conceptId: string; fromVersion: string; instruction: string; revision: string; planRevision: string; generationRevision: string; source: Theme; result: RefinedTheme }) {
    const { slug, conceptId, fromVersion, instruction, result } = input;
    return this.locked(slug, input.revision, async () => {
      const project = await this.read(slug);
      this.checkDesign(project, conceptId, input.planRevision, input.generationRevision);
      const source = await this.version(slug, conceptId, fromVersion);
      if (JSON.stringify(source) !== JSON.stringify(input.source)) throw new StudioError("Исходная версия изменилась во время правки.", 409);
      const checked = applyRefinement(source, result.patch, project);
      const history = await this.history(slug, conceptId);
      const version = String(Math.max(...history.map((item) => Number(item.version))) + 1);
      if (!VersionId.safeParse(version).success) throw new StudioError("Достигнут предел версий этого варианта.");
      const provenance = VersionRecord.parse({ version, fromVersion, instruction, createdAt: new Date().toISOString(), summary: result.summary, model: result.model, elapsedMs: result.elapsedMs, changes: checked.changes, adjustments: checked.adjustments });
      const directory = path.join(this.directory(slug), "concepts", conceptId);
      const temporary = path.join(directory, `.refine-${randomUUID()}`);
      const targets: string[] = [];
      let committed = false;
      await mkdir(temporary);
      try {
        // Atomic hard links publish complete files with write-once semantics.
        const { link } = await import("node:fs/promises");
        for (const [name, value] of [[`v${version}.json`, checked.theme], [`v${version}.meta.json`, provenance]] as const) {
          await writeFile(path.join(temporary, name), encode(value), { flag: "wx" });
          await link(path.join(temporary, name), path.join(directory, name));
          targets.push(path.join(directory, name));
        }
        await this.atomicJson(path.join(this.directory(slug), "generation.json"), { ...project.generation!, concepts: project.generation!.concepts.map((concept) => concept.id === conceptId ? { ...concept, version } : concept) });
        committed = true;
      } finally {
        await rm(temporary, { recursive: true, force: true });
        if (!committed) for (const target of targets) await rm(target, { force: true });
      }
      return this.read(slug);
    });
  }
  async list() {
    await mkdir(this.root, { recursive: true });
    const dirs = await readdir(this.root, { withFileTypes: true });
    return (await Promise.all(dirs.filter((dir) => dir.isDirectory() && safeId(dir.name)).map(async (dir) => {
      const project = await this.read(dir.name);
      const info = await stat(path.join(this.root, dir.name, "content.json"));
      const first = project.generation || dir.name === "demo" ? project.concepts[0] : undefined;
      const cover = project.approval ?? first;
      const preview = cover ? { href: `/preview/${dir.name}/${"conceptId" in cover ? cover.conceptId : cover.id}/${cover.version}?embed=1`, selected: Boolean(project.approval) } : null;
      return { slug: dir.name, names: project.content.hosts.map((host) => host.name).join(" и "), date: project.content.date.start, day: project.content.date.day, timezone: project.content.date.timezone, venue: project.content.venue.name, count: project.generation || dir.name === "demo" ? project.concepts.length : 0, preview, updated: info.mtimeMs };
    }))).sort((a, b) => b.updated - a.updated);
  }
  async create(raw: unknown, templates?: Concept[]) {
    const content = validateContent(raw);
    const destination = this.directory(content.slug, true);
    if (content.media.length || content.refs.length) throw new StudioError("Загрузите изображения после создания проекта.");
    const concepts = templates ?? [];
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
      await mkdir(path.join(pending, "concepts"));
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
  private async locked<T>(slug: string, revision: string, action: (content: EventContent) => Promise<T>) {
    const dir = this.directory(slug, true);
    await this.snapshot(slug);
    const lock = path.join(dir, ".studio-lock");
    try { await mkdir(lock); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new StudioError("Проект сейчас сохраняется. Повторите через несколько секунд.", 409);
      throw error;
    }
    try {
      const current = await this.snapshot(slug);
      if (current.revision !== revision) throw new StudioError("Проект изменён в другой вкладке. Скопируйте свои изменения и обновите страницу.", 409);
      return await action(current.content);
    } finally { await rm(lock, { recursive: true, force: true }); }
  }
  private async mutate(slug: string, revision: string, change: (content: EventContent) => Promise<EventContent>) {
    return this.locked(slug, revision, async (current) => {
      const content = validateContent(await change(current));
      const text = encode(content);
      const temporary = path.join(this.directory(slug), `.content-${randomUUID()}.json`);
      try {
        await writeFile(temporary, text, { flag: "wx" });
        await rename(temporary, path.join(this.directory(slug), "content.json"));
        return { content, revision: hash(text) };
      } finally { await rm(temporary, { force: true }); }
    });
  }
  async planning(slug: string, content?: EventContent): Promise<Planning> {
    const current = content ?? (await this.snapshot(slug)).content;
    const text = await readFile(path.join(this.directory(slug), "asset-plan.json"), "utf8");
    const stored = AssetPlan.parse(JSON.parse(text));
    const mediaInfo = await photoInfo(this.directory(slug), current);
    const assets = current.media.map((media) => stored.assets.find((asset) => asset.id === media.id) ?? unusedAsset(media.id, mediaInfo[media.id]));
    return { assetPlan: { ...stored, assets }, planRevision: hash(text), mediaInfo };
  }
  async updatePlan(slug: string, raw: unknown, revision: string, planRevision: string) {
    return this.locked(slug, revision, async (content) => {
      const current = await this.planning(slug, content);
      if (current.planRevision !== planRevision) throw new StudioError("Настройки фотографий изменены в другой вкладке. Обновите страницу перед сохранением.", 409);
      const parsed = AssetPlan.safeParse(raw);
      if (!parsed.success) throw new StudioError("Проверьте область сохранения, формат кадра и качество фото. На первом экране можно разместить только качественное фото.");
      const plan = parsed.data;
      if (plan.assets.length !== content.media.length || plan.assets.some((asset) => !current.mediaInfo[asset.id])) throw new StudioError("План должен содержать все фотографии проекта, без референсов и повторов.");
      if (plan.assets.some((asset) => (asset.role === "hero" || asset.placement?.section === "hero") && !heroGrade(current.mediaInfo[asset.id]))) throw new StudioError("Фото для первого экрана должно иметь минимум 600 px по короткой стороне и 1200 px по длинной.");
      if (plan.assets.filter((asset) => asset.placement?.section === "hero").length > 1) throw new StudioError("Для первого экрана выберите одно фото.");
      plan.assets = plan.assets.map((asset) => asset.quality === "low" || Math.min(current.mediaInfo[asset.id].width, current.mediaInfo[asset.id].height) < 480 ? { ...asset, maxViewportShare: Math.min(asset.maxViewportShare, .35) } : asset);
      const temporary = path.join(this.directory(slug), `.plan-${randomUUID()}.json`);
      const text = encode(plan);
      try {
        await writeFile(temporary, text, { flag: "wx" });
        await rename(temporary, path.join(this.directory(slug), "asset-plan.json"));
      } finally { await rm(temporary, { force: true }); }
      return { ...current, assetPlan: plan, planRevision: hash(text) };
    });
  }
  async saveGeneration(slug: string, result: GeneratedSeries, revision: string, planRevision: string, generationRevision: string) {
    return this.locked(slug, revision, async (content) => {
      const project = await this.read(slug);
      if (project.planRevision !== planRevision || project.generationRevision !== generationRevision) throw new StudioError("Проект или варианты изменились во время генерации. Обновите страницу и повторите.", 409);
      if (!content.brief?.trim()) throw new StudioError("Опишите желаемый стиль перед генерацией.");
      if (result.themes.length !== (content.variantCount ?? 5) || (result.mode !== "exploration" && result.themes.some((theme) => sharedStyleSignature(theme) !== sharedStyleSignature(result.themes[0])))) throw new StudioError("Серия должна содержать выбранное количество композиций в одном стиле.");
      const expected = { ...result.themes[0], ...result.style, ornament: { ...result.style.ornament, placement: result.themes[0].ornament.placement } };
      if (result.mode !== "exploration" && sharedStyleSignature(result.themes[0]) !== sharedStyleSignature(expected)) throw new StudioError("Стиль вариантов не совпадает со стилем серии.");
      const photos = await readDirectedPhotos(content, project.assetPlan, this.directory(slug));
      const validated = composeSeries({ mode: result.mode, style: result.style, variants: result.themes.map((theme) => ({ ...(result.mode === "exploration" ? { direction: artDirection(theme) } : {}), name: theme.meta.name, rationale: theme.meta.rationale, layout: theme.layout, ornamentPlacement: theme.ornament.placement, photos: theme.photos ?? [] })) }, content.locale, photos);
      if (result.themes.some((theme, index) => sharedStyleSignature(theme) !== sharedStyleSignature(validated.themes[index]))) throw new StudioError("Вариант содержит изменения вне разрешённого художественного направления.");
      const visual = result.visual;
      const visualRef = validated.style.generatedVisual;
      if (visual) {
        const record = VisualRecord.parse(visual.record);
        const info = await sharp(visual.data).metadata();
        if (!visualRef || visualRef.id !== record.id || visualRef.sha256 !== record.sha256 || createHash("sha256").update(visual.data).digest("hex") !== record.sha256 || info.width !== record.width || info.height !== record.height || info.format !== "webp" || visualRef.width !== record.width || visualRef.height !== record.height || Boolean(visualRef.isolated) !== Boolean(record.isolated) || (visualRef.kind ?? "accent") !== (record.kind ?? "accent")) throw new StudioError("Новый визуал не соответствует серии.");
      } else if (visualRef && !await readGeneratedVisual(slug, visualRef.id, visualRef, this.root)) throw new StudioError("Визуал серии не найден.");
      const batchId = randomUUID();
      const concepts = validated.themes.map((theme, index) => ({ id: `variant-${batchId.slice(0, 8)}-${index + 1}`, version: "1", theme }));
      const generation = Generation.parse({ mode: validated.mode, batchId, createdAt: new Date().toISOString(), brief: content.brief, model: result.model, elapsedMs: result.elapsedMs, style: validated.style, adjustments: result.adjustments, references: result.references, concepts: concepts.map(({ id, version }) => ({ id, version })) });
      const pending = path.join(this.directory(slug), `.generation-${batchId}.json`);
      const created: string[] = [];
      let committed = false;
      try {
        if (visual) {
          const directory = path.join(this.directory(slug), "art", visual.record.id);
          await mkdir(path.dirname(directory), { recursive: true });
          await mkdir(directory);
          created.push(directory);
          await writeFile(path.join(directory, "image.webp"), visual.data, { flag: "wx" });
          await writeFile(path.join(directory, "meta.json"), encode(visual.record), { flag: "wx" });
        }
        for (const concept of concepts) {
          const directory = path.join(this.directory(slug), "concepts", concept.id);
          await mkdir(directory);
          created.push(directory);
          await writeFile(path.join(directory, "v1.json"), encode(concept.theme), { flag: "wx" });
          await writeFile(path.join(directory, "meta.json"), encode({ createdAt: generation.createdAt, assignedLayout: concept.theme.layout.composition, assignedMaterial: concept.theme.materialSet }), { flag: "wx" });
          await writeFile(path.join(directory, "v1.meta.json"), encode(VersionRecord.parse({ version: "1", fromVersion: null, createdAt: generation.createdAt, instruction: "Исходная генерация по брифу", summary: concept.theme.meta.rationale, model: result.model, elapsedMs: result.elapsedMs, changes: [], adjustments: result.adjustments })), { flag: "wx" });
        }
        await writeFile(pending, encode(generation), { flag: "wx" });
        await rename(pending, path.join(this.directory(slug), "generation.json"));
        committed = true;
      } finally {
        await rm(pending, { force: true });
        if (!committed) for (const directory of created) await rm(directory, { recursive: true, force: true });
      }
      return this.read(slug);
    });
  }
  async update(slug: string, raw: unknown, revision: string) {
    const proposed = validateContent(raw);
    if (proposed.slug !== slug) throw new StudioError("Адрес созданного проекта изменить нельзя.");
    return this.mutate(slug, revision, async (current) => {
      const project = await this.read(slug);
      for (const concept of project.concepts) {
        if (!validateTheme(concept.theme, { locale: proposed.locale, hasHighQualityAsset: hasHeroPhoto(concept.theme, project.assetPlan, project.mediaInfo) }).ok) throw new StudioError("Темы проекта не поддерживают выбранный язык.");
      }
      return { ...proposed, media: current.media, refs: current.refs };
    });
  }
  async upload(slug: string, revision: string, kind: string, file: File) {
    if (kind !== "photo" && kind !== "reference") throw new StudioError("Выберите фотографию или референс.");
    if (!file.size || file.size > 15 * 1024 * 1024) throw new StudioError("Размер изображения должен быть от 1 байта до 15 МБ.");
    const bytes = Buffer.from(await file.arrayBuffer());
    let output: Buffer;
    let dimensions: ImageInfo;
    try {
      const image = sharp(bytes, { limitInputPixels: 40000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
      const processed = await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
      output = processed.data;
      dimensions = { width: processed.info.width, height: processed.info.height };
    } catch { throw new StudioError("Файл не удалось прочитать. Выберите обычное изображение JPG, PNG или WebP."); }
    const id = randomUUID();
    const filename = `${id}.webp`;
    const directory = path.join(this.directory(slug, true), "media");
    const src = `/api/projects/${slug}/media/${filename}`;
    let written = false;
    try {
      const result = await this.mutate(slug, revision, async (content) => {
        if (content.media.length + content.refs.length >= 40) throw new StudioError("В проекте уже 40 изображений. Удалите ненужные перед загрузкой.");
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, filename), output, { flag: "wx" });
        written = true;
        return kind === "photo" ? { ...content, media: [...content.media, { id, src }] } : { ...content, refs: [...content.refs, src] };
      });
      return { ...result, uploadedInfo: kind === "photo" ? { id, ...dimensions } : null };
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
