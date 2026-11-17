import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.env.STUDIO_PLAYWRIGHT_MODULE).href);
const base = process.env.STUDIO_QA_URL ?? 'http://127.0.0.1:3153';
const output = path.join(process.cwd(), 'docs/studio-templates');
const browser = await chromium.launch({ headless: true, executablePath: process.env.STUDIO_CHROME });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const report = { responsive: [], palettes: [], checks: [], errors: [], externalRequests: [] };
const templates = { editorial: ['ivory','rose','champagne'], botanical: ['sage','ivory','forest'], classic: ['champagne','ivory','rose'], modern: ['terracotta','cobalt','clay'], corporate: ['ivory','slate','ink'], nocturne: ['ink','wine','forest'] };
const slug = `qa-studio-template-${randomUUID().slice(0, 8)}`;
const post = async (url, body) => {
  const response = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) });
  const result = await response.json();
  assert(response.ok, `${url}: ${JSON.stringify(result)}`);
  return result;
};
page.on('pageerror', error => report.errors.push(error.message));
page.on('request', request => { if (!['localhost','127.0.0.1'].includes(new URL(request.url()).hostname)) report.externalRequests.push(request.url()); });
const fit = () => page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('main.studio-template :is(h1,h2,p,address,input,button,summary)')].filter(element => element.checkVisibility() && (element.getBoundingClientRect().left < -1 || element.getBoundingClientRect().right > innerWidth + 1)).map(element => element.tagName + '.' + element.className) }));
const visit = async url => { const response = await page.goto(url, { waitUntil: 'networkidle' }); assert(response.ok(), `${url}: ${response.status()}`); await page.evaluate(() => document.fonts.ready); };
try {
  await mkdir(output, { recursive: true });
  for (const width of [320,390,430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [id, palettes] of Object.entries(templates)) {
      await visit(`${base}/templates/${id}`);
      const dimensions = await fit();
      assert(dimensions.document <= width && dimensions.overflow.length === 0, `${id}@${width}: ${JSON.stringify(dimensions)}`);
      assert.equal(await page.locator('main').getAttribute('data-studio-template'), id);
      report.responsive.push({ id, ...dimensions });
      if (width === 390) {
        await page.screenshot({ path: path.join(output, `${id}-opening.png`) });
        await page.screenshot({ path: path.join(output, `${id}-complete.png`), fullPage: true });
        for (const palette of palettes) {
          await visit(`${base}/templates/${id}?palette=${palette}`);
          assert.equal((await fit()).overflow.length, 0, `${id}/${palette} overflow`);
          report.palettes.push({ id, palette });
        }
      }
    }
  }
  report.checks.push('Six full mobile compositions at320/390/430, all18 approved palette alternatives, local fonts and zero text/control overflow');
  await page.setViewportSize({ width: 390, height: 844 });
  await visit(`${base}/studio/new`);
  await page.getByRole('button', { name: /Editorial Фотоистория/ }).click();
  assert.equal(await page.getByLabel('Опишите приглашение', { exact: true }).inputValue(), '');
  assert.equal(await page.getByRole('button', { name: /Создать приглашение/ }).isEnabled(), true);
  assert.equal(await page.getByRole('checkbox', { name: /Иллюстрация|визуал/i }).count(), 0);
  report.checks.push('Template-only creation enabled with no description or provider key; selecting a recipe preserves the brief');

  // The test server must have both provider keys empty. Manual generation and
  // deterministic palette refinement never call a model; vision stays incomplete.
  const demo = JSON.parse(await readFile('projects/demo/content.json','utf8'));
  let project = await post('/api/projects', { ...demo, slug, media: [], refs: [], brief: '', variantCount: 1, studioDesign: { templateId: 'editorial', paletteId: 'ivory' }, rsvp: { enabled: true, mode: 'form', target: `${base}/qa-template-response`, askGuestCount: true } });
  assert.equal(project.visionConfigured, false, 'Use a test server with ANTHROPIC_API_KEY empty');
  assert.equal(project.imagesConfigured, false, 'Use a test server with OPENAI_API_KEY empty');
  project = await post('/api/generate', { slug, revision: project.revision, planRevision: project.planRevision, generationRevision: project.generationRevision, createVisual: false });
  const concept = project.concepts[0];
  assert.equal(project.generation.model, 'authored-template-v1');
  assert.equal(concept.theme.studioTemplate.id, 'editorial');
  assert.equal(project.generation.style.studioTemplate.id, 'editorial');
  await visit(`${base}/preview/${slug}/${concept.id}/1?embed=1&guest=Алина`);
  await page.locator('#guest-name').fill('Алина и Тимур');
  await page.getByRole('button', { name: /Продолжить/ }).click();
  await page.locator('input[name=attendance]').check();
  await page.locator('#guest-count').fill('3');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  assert.equal(await page.locator('#guest-name').inputValue(), 'Алина и Тимур');
  await page.getByRole('button', { name: /Продолжить/ }).click();
  assert.equal(await page.locator('#guest-count').inputValue(), '3');
  await page.locator('#rsvp').screenshot({ path: path.join(output,'editorial-rsvp.png') });
  let submitted;
  await page.route(`${base}/qa-template-response`, async route => {
    submitted = { method: route.request().method(), data: Object.fromEntries(new URLSearchParams(route.request().postData())) };
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html lang=ru><body>Ответ принят</body></html>' });
  });
  await page.getByRole('button', { name: /Подтвердить присутствие/ }).click();
  await page.waitForURL(`${base}/qa-template-response`);
  assert.deepEqual(submitted, { method:'POST', data:{ name:'Алина и Тимур', attendance:'yes', guests:'3' } });
  report.checks.push('Manual API generation, persisted recipe, personalised RSVP, step/back values and native POST to locally intercepted test receiver');

  project = await post('/api/refine', { slug, conceptId: concept.id, fromVersion:'1', instruction:'Палитра: пыльная роза.', templatePatch:{paletteId:'rose'}, revision:project.revision, planRevision:project.planRevision, generationRevision:project.generationRevision });
  assert.equal(project.concepts[0].version,'2');
  assert.equal(project.concepts[0].theme.studioTemplate.paletteId,'rose');
  assert.equal(project.concepts[0].theme.layout.composition,concept.theme.layout.composition);
  report.checks.push('Deterministic palette API produces immutable v2 without changing composition or provider call');

  const noJs = await browser.newContext({ viewport:{width:320,height:844}, javaScriptEnabled:false });
  const staticPage = await noJs.newPage();
  for (const id of Object.keys(templates)) {
    await staticPage.goto(`${base}/templates/${id}`);
    assert.equal(await staticPage.locator('h1').isVisible(),true);
    assert.equal(await staticPage.locator('#venue').isVisible(),true);
  }
  await staticPage.goto(`${base}/preview/${slug}/${concept.id}/2?embed=1`);
  for (const selector of ['#guest-name','input[name=attendance]','#guest-count']) assert.equal(await staticPage.locator(selector).isVisible(),true);
  await noJs.close();
  report.checks.push('All six complete invitations and native response form remain usable without JavaScript');

  await page.emulateMedia({reducedMotion:'no-preference'});
  await visit(`${base}/templates/editorial`);
  await page.locator('#venue').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#venue').closest('[data-reveal]').dataset.reveal==='shown');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#venue').evaluate(element => getComputedStyle(element.closest('[data-reveal]')).transform),'none');
  report.checks.push('Authored reveal and reduced-motion fallback');
  await page.setViewportSize({width:1440,height:1000});
  for (const id of Object.keys(templates)) {
    await visit(`${base}/templates/${id}`);
    assert.equal((await fit()).overflow.length,0);
  }
  await visit(`${base}/templates`);
  await page.screenshot({path:path.join(output,'catalog-desktop.png'),fullPage:true});
  report.checks.push('Desktop enhancements and catalog preview');
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.externalRequests,[]);
  await writeFile(path.join(output,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({responsive:report.responsive.length,palettes:report.palettes.length,checks:report.checks,errors:report.errors},null,2));
} finally { await browser.close(); await rm(path.join(process.cwd(),'projects',slug),{recursive:true,force:true}); }
