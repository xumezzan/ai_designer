import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
assert.equal(process.env.STUDIO_QA_LIVE, "1", "Explicit opt-in required: one real Anthropic + OpenAI image generation and automatic QA.");
const { chromium } = await import(pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROME_EXECUTABLE });
const base = process.env.STUDIO_QA_URL || "http://127.0.0.1:3147";
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const slug = process.env.STUDIO_QA_REUSE_SLUG || `qa-fidelity-${randomUUID().slice(0, 8)}`;
assert(/^qa-fidelity-[a-f0-9]{8}$/.test(slug), "Only disposable fictional fixtures may be reused");
const out = path.join(process.cwd(), "docs/fidelity");
await mkdir(out, { recursive: true });
const report = { slug, mode: "Production UI, real Anthropic interpretation, real OpenAI Images reference edit, automatic browser/vision QA", errors: [], variants: [], widths: [], checks: {} };
page.on("pageerror", (error) => report.errors.push(error.message));
try {
  let project;
  if (process.env.STUDIO_QA_REUSE_SLUG) {
    project = await (await page.request.get(`${base}/api/projects/${slug}`)).json();
    // Recheck the already paid-for artwork without image generation.
    for (const concept of project.concepts) {
      const qa = concept.history?.find((entry) => entry.version === concept.version)?.qa;
      if (qa && !qa.stale && !qa.report.checks.some((check) => ["fail", "error", "skipped"].includes(check.status))) continue;
      const checked = await page.request.post(`${base}/api/qa`, { timeout: 180000, data: { slug, conceptId: concept.id, version: concept.version, revision: project.revision, planRevision: project.planRevision, generationRevision: project.generationRevision } });
      assert.equal(checked.status(), 200);
    }
    project = await (await page.request.get(`${base}/api/projects/${slug}`)).json();
  } else {
  const demo = JSON.parse(await readFile("projects/demo/content.json", "utf8"));
  const created = await page.request.post(`${base}/api/projects`, { data: { ...demo, slug, hosts: [{ name: "Алина" }, { name: "Тимур" }], headline: undefined, media: [], refs: [], brief: "Великий Гэтсби: глубокий тёмно-зелёный фон, тонкая золотая гравировка ар-деко, веер и ступенчатые арки, ромбы. Ориентируйся на материал и геометрию референса. Никаких цветов. Пять вариантов в едином стиле: по-разному размести новый рисунок, имена и дату. Без золотого текста с бликами." } });
  assert.equal(created.status(), 201);
  project = await created.json();
  assert.equal(project.imagesConfigured, true);
  const uploaded = await page.request.post(`${base}/api/projects/${slug}/media`, { multipart: { revision: project.revision, kind: "reference", file: { name: "art-deco-reference.png", mimeType: "image/png", buffer: await readFile("docs/fidelity/imagegen-demo.png") } } });
  assert.equal(uploaded.status(), 200);
  project = await uploaded.json();
  await page.goto(`${base}/studio/${slug}`);
  await page.getByRole("button", { name: "04 Пять дизайнов", exact: true }).click();
  assert.equal(await page.getByRole("checkbox", { name: "Создать новый визуал по брифу и референсам", exact: true }).last().isChecked(), true);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/generate"), { timeout: 540000 });
  await page.getByRole("button", { name: "Сгенерировать 5 вариантов", exact: true }).click();
  const response = await responsePromise;
  const body = await response.json();
  if (response.status() !== 200) { report.failure = { status: response.status(), error: body.error }; throw new Error(body.error || `HTTP ${response.status()}`); }
  project = body;
  }
  assert.equal(project.concepts.length, 5);
  assert(project.generation.style.intent);
  const ref = project.generation.style.generatedVisual;
  assert(ref);
  assert.equal(new Set(project.concepts.map((concept) => concept.theme.generatedVisual?.id)).size, 1);
  assert(new Set(project.concepts.map((concept) => concept.theme.layout.visualPlacement)).size >= 3);
  const asset = await page.request.get(`${base}/art/${slug}/${ref.id}`);
  assert.equal(asset.status(), 200);
  assert.match(asset.headers()["content-type"], /image\/webp/);
  await writeFile(path.join(out, "openai-live.webp"), await asset.body());
  const provenance = JSON.parse(await readFile(path.join("projects", slug, "art", ref.id, "meta.json"), "utf8"));
  assert.equal(provenance.references, 1);
  report.visual = provenance;
  report.intent = project.generation.style.intent;
  report.style = project.generation.style;
  for (const concept of project.concepts) {
    const qa = concept.history?.find((version) => version.version === concept.version)?.qa;
    assert(qa && !qa.stale);
    assert(!qa.report.checks.some((check) => ["fail", "error", "skipped"].includes(check.status)), `Unexpected hard/incomplete QA finding in ${concept.id}`);
    report.variants.push({ id: concept.id, name: concept.theme.meta.name, layout: concept.theme.layout, qa: qa.report.checks.map(({ id, status, findings }) => ({ id, status, findings })) });
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/preview/${slug}/${concept.id}/${concept.version}?embed=1`, { waitUntil: "networkidle" });
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode())); });
      const geometry = await page.evaluate(() => {
        const image = document.querySelector(".generated-visual img");
        const box = image.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, imageLoaded: image.naturalWidth > 0, imageWidth: box.width, horizontalFit: box.left >= -1 && box.right <= innerWidth + 1 };
      });
      assert(!geometry.overflow && geometry.imageLoaded && geometry.horizontalFit);
      await page.screenshot({ path: path.join(out, `${concept.theme.layout.visualPlacement}-${concept.theme.layout.composition}-${width}.png`) });
      report.widths.push({ conceptId: concept.id, width, ...geometry });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/studio/${slug}`);
  await page.getByRole("button", { name: "04 Пять дизайнов", exact: true }).click();
  await page.getByText("Как AI понял бриф", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, "studio-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, "studio-mobile.png"), fullPage: true });
  assert.equal(report.errors.length, 0);
  report.checks = { referenceInput: true, originalArtwork: true, coherentFive: true, responsive: true, visibleIntent: true, automaticQa: true };
  console.log(JSON.stringify({ slug, model: provenance.model, placements: report.variants.map((variant) => variant.layout.visualPlacement), hardFailures: report.variants.flatMap((variant) => variant.qa.filter((check) => check.status === "fail").map((check) => `${variant.id}: ${check.id}`)), errors: report.errors }));
} finally {
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
