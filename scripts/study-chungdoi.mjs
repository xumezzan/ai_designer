import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only public-reference study. Opens every catalog detail and its actual
// preview link, then opens the invitation. Never submits RSVP or copies assets.
const { chromium } = await import(pathToFileURL(process.env.QA_PLAYWRIGHT_MODULE).href);
const output = path.resolve('docs/chungdoi-mobile');
await mkdir(path.join(output, 'screenshots'), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROME_EXECUTABLE, args: ['--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
const reportPath = path.join(output, 'measurements.json');
let previous;
try { previous = JSON.parse(await readFile(reportPath, 'utf8')); } catch {}
const report = { source: 'https://chungdoi.com/ru/templates', measuredAt: new Date().toISOString(), viewport: { width: 390, height: 844, mobile: true, touch: true }, method: 'Real browser navigation, actual preview links, opening-cover click, full-page scroll and computed styles. Screenshots are reference evidence only.', templates: [], failures: [] };
async function settle() {
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 6000))]));
  await page.waitForTimeout(500);
}
async function shot(id, suffix, fullPage = false) {
  const filename = `screenshots/${id}-${suffix}.jpg`;
  await page.screenshot({ path: path.join(output, filename), type: 'jpeg', quality: 76, fullPage });
  return filename;
}
async function measure() {
  return page.evaluate(() => {
    const shown = e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
    const style = e => { const s = getComputedStyle(e), b = e.getBoundingClientRect(); return { tag: e.tagName, class: typeof e.className === 'string' ? e.className.slice(0, 180) : '', font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, line: s.lineHeight, tracking: s.letterSpacing, color: s.color, bg: s.backgroundColor, width: +b.width.toFixed(1), height: +b.height.toFixed(1), padding: s.padding, radius: s.borderRadius, shadow: s.boxShadow, blur: s.backdropFilter, perspective: s.perspective, transform: s.transform, duration: s.transitionDuration, animation: s.animationName }; };
    const headings = [...document.querySelectorAll('h1,h2,h3')].filter(shown).slice(0, 18).map(e => ({ label: e.innerText.slice(0, 65), ...style(e) }));
    const text = [...document.querySelectorAll('p')].filter(shown).slice(0, 8).map(style);
    const material = [...document.querySelectorAll('main,section,article,div')].filter(shown).map(e => ({ e, s: getComputedStyle(e) })).filter(({ s }) => s.backdropFilter !== 'none' || s.perspective !== 'none' || (s.boxShadow !== 'none' && (s.backgroundImage !== 'none' || s.borderRadius !== '0px'))).slice(0, 24).map(({ e }) => style(e));
    const images = [...document.querySelectorAll('img')].filter(shown).map(e => { const s = getComputedStyle(e), b = e.getBoundingClientRect(); return { alt: (e.alt || '').slice(0, 65), natural: [e.naturalWidth,e.naturalHeight], rendered: [+b.width.toFixed(1),+b.height.toFixed(1)], fit: s.objectFit, position: s.objectPosition, loaded: e.complete && e.naturalWidth > 0 }; });
    const controls = [...document.querySelectorAll('button,a,input,select,textarea')].filter(shown).slice(0, 30).map(e => ({ tag: e.tagName, label: (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.getAttribute('type') || '').slice(0, 65), width: +e.getBoundingClientRect().width.toFixed(1), height: +e.getBoundingClientRect().height.toFixed(1), href: e.tagName === 'A' ? e.getAttribute('href') : undefined }));
    return { viewport: [innerWidth,innerHeight], scrollWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight, headings, text, material, images, controls };
  });
}
async function scanMotion() {
  const height = await page.evaluate(() => { document.documentElement.style.scrollBehavior='auto'; return document.documentElement.scrollHeight; });
  const samples = [];
  for (let y=0; y<height; y+=750) {
    await page.evaluate(y => scrollTo({top:y,behavior:'instant'}),y);
    await page.waitForTimeout(140);
    const sample = await page.evaluate(() => document.getAnimations().slice(0, 30).map(a => {
      const effect = a.effect, target = effect?.target, frames = effect?.getKeyframes() || [], timing = effect?.getComputedTiming();
      return { class: typeof target?.className === 'string' ? target.className.slice(0,160) : target?.tagName, name: a.animationName || a.transitionProperty || '', duration: timing?.duration, delay: timing?.delay, iterations: timing?.iterations === Infinity ? 'infinite' : timing?.iterations, easing: timing?.easing, properties: [...new Set(frames.flatMap(f=>Object.keys(f).filter(k=>!['offset','computedOffset','easing','composite'].includes(k))))], transform: frames.map(f=>f.transform).filter(Boolean).slice(0,3), opacity: frames.map(f=>f.opacity).filter(v=>v!==undefined).slice(0,3) };
    }));
    samples.push(...sample);
  }
  return [...new Map(samples.map(s => [JSON.stringify(s),s])).values()];
}
try {
  await page.goto(report.source, { waitUntil:'domcontentloaded', timeout:45000 });
  await settle();
  const catalog = await page.evaluate(() => [...new Map([...document.querySelectorAll('a[href]')].filter(a=>/^\/ru\/templates\/[^/]+$/.test(new URL(a.href).pathname) && !a.href.includes('/collections')).map(a=>[a.href,{ id: new URL(a.href).pathname.split('/').at(-1), name: a.innerText.split('\n')[0], detailUrl:a.href }])).values()]);
  report.catalog = catalog;
  await writeFile(path.join(output,'catalog.json'),JSON.stringify(catalog,null,2));
  console.log(`Catalog: ${catalog.length} templates`);
  for (const [index, entry] of catalog.entries()) {
    const complete = previous?.templates?.find(t=>t.id===entry.id && t.status==='opened');
    if (process.env.STUDY_RESUME === '1' && complete) { report.templates.push(complete); console.log(`${index+1}/${catalog.length} ${entry.id} — recorded`); continue; }
    const item = { ...entry, status:'pending', errors:[] };
    const onError = error => item.errors.push(error.message);
    page.on('pageerror', onError);
    try {
      await page.setViewportSize({width:390,height:844});
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.goto(entry.detailUrl,{waitUntil:'domcontentloaded',timeout:45000});
      const preview = page.locator('a[href*="/demo"]').first();
      await preview.waitFor({timeout:10000});
      item.previewUrl = await preview.getAttribute('href');
      item.previewUrl = new URL(item.previewUrl,entry.detailUrl).href;
      await page.goto(item.previewUrl,{waitUntil:'domcontentloaded',timeout:45000});
      await settle();
      item.cover = await measure();
      item.coverShot = await shot(entry.id,'cover');
      const open = page.locator('a[href="?open=1"]').first();
      if (await open.count()) { await open.click(); item.openedBy='cover link click'; }
      else {
        const opener = page.getByRole('button',{name:/^(Открыть|Открыть приглашение)$/}).first();
        if (await opener.count()) { await opener.click(); item.openedBy='cover button click'; }
        else item.openedBy='no opening cover';
      }
      await page.waitForTimeout(1450);
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await settle();
      item.heroShot=await shot(entry.id,'hero');
      item.motion=await scanMotion();
      await page.waitForTimeout(1100);
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      item.invitation=await measure();
      item.fullShot=await shot(entry.id,'full',true);
      await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight*.42,behavior:'instant'}));
      await page.waitForTimeout(500);
      item.middleShot=await shot(entry.id,'middle');
      await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      await page.waitForTimeout(250);
      item.footerShot=await shot(entry.id,'footer');
      item.widthChecks=[];
      for (const width of [320,430]) {
        await page.setViewportSize({width,height:844});
        await page.waitForTimeout(200);
        item.widthChecks.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight})));
      }
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(250);
      item.reducedMotionRunning=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);
      item.status='opened';
      console.log(`${index+1}/${catalog.length} ${entry.id} — opened, ${item.invitation.pageHeight}px, ${item.motion.length} motion samples`);
    } catch(error) {
      item.status='failed'; item.failure=error.message;
      report.failures.push({id:entry.id,error:error.message});
      console.log(`${index+1}/${catalog.length} ${entry.id} — FAILED: ${error.message.slice(0,130)}`);
    } finally { page.off('pageerror',onError); }
    report.templates.push(item);
    await writeFile(reportPath,JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify({catalog:report.catalog.length,opened:report.templates.filter(t=>t.status==='opened').length,failures:report.failures},null,2));
} finally {
  await writeFile(reportPath,JSON.stringify(report,null,2));
  await browser.close();
}
