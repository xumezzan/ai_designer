import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { snapshot } from "./snapshot.mjs";
import { overflow } from "./checks/overflow.mjs";
import { collision } from "./checks/collision.mjs";
import { clipping } from "./checks/clipping.mjs";
import { contrast } from "./checks/contrast.mjs";
import { measure } from "./checks/measure.mjs";
import { widow } from "./checks/widow.mjs";
import { fonts } from "./checks/fonts.mjs";
import { tap } from "./checks/tap.mjs";
import { resolution } from "./checks/resolution.mjs";
import { reducedMotion } from "./checks/reduced-motion.mjs";
import { lcp } from "./checks/lcp.mjs";
import { cls } from "./checks/cls.mjs";
import { faceCrop } from "./checks/face-crop.mjs";
import { busyPhoto } from "./checks/busy-photo.mjs";

export function mergeChecks(checks) {
  const ids = [...new Set(checks.map((check) => check.id))];
  return ids.map((id) => {
    const matches = checks.filter((check) => check.id === id);
    const status = ["error", "fail", "warning", "pass", "skipped"].find((status) => matches.some((check) => check.status === status));
    return { id, status, samples: matches.reduce((count, check) => count + check.samples, 0), findings: matches.flatMap((check) => check.findings).slice(0, 200) };
  });
}
async function restrict(context, url) {
  await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort());
}
export async function perform({ url, assets, output, testStyles }) {
  const playwrightModule = process.env.QA_PLAYWRIGHT_MODULE || "playwright";
  const { chromium } = await import(path.isAbsolute(playwrightModule) ? pathToFileURL(playwrightModule).href : playwrightModule);
  const browser = await chromium.launch({ headless: true, ...(process.env.QA_CHROME_EXECUTABLE ? { executablePath: process.env.QA_CHROME_EXECUTABLE } : {}) });
  const stop = async () => { await browser.close().catch(() => {}); process.exit(1); };
  process.once("SIGTERM", stop);
  const checks = [], evidence = [];
  let measurements;
  await mkdir(output, { recursive: true });
  try {
    for (const width of [390, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
      try {
        await restrict(context, url);
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const response = await page.goto(url, { waitUntil: "networkidle" });
        if (!response?.ok()) throw new Error("Preview unavailable");
        await page.evaluate(async () => {
          await document.fonts.ready;
          const height = document.documentElement.scrollHeight;
          if (height > 18000) throw new Error("Page exceeds bounded QA height");
          for (let y = 0; y < height; y += 700) { scrollTo(0, y); await new Promise((resolve) => requestAnimationFrame(resolve)); }
          await Promise.all([...document.images].map(async (image) => { try { await image.decode(); } catch { throw new Error("Image unavailable"); } }));
          scrollTo(0, 0);
        });
        if (testStyles) await page.addStyleTag({ content: testStyles }); // Only direct test harness callers; never supplied by an HTTP request.
        await page.waitForTimeout(150);
        const data = await snapshot(page, assets);
        if (data.fragments.length > 2000 || data.height > 18000) throw new Error("Page exceeds bounded QA size");
        const png = await page.screenshot({ fullPage: true, animations: "allow" });
        // A second paint marks opaque glyph cores independently of the real
        // foreground. This distinguishes a pale foil highlight from an
        // antialiasing edge instead of checking only the darkest foil pixel.
        const maskStyle = await page.addStyleTag({ content: [...new Set(data.fragments.map((box) => box.selector))].map((selector) => `main.invitation ${selector} { color: #ff00ff !important; -webkit-text-fill-color: #ff00ff !important; background-image: none !important; text-shadow: none !important; }`).join("\n") });
        const mask = await page.screenshot({ fullPage: true, animations: "allow" });
        await maskStyle.evaluate((element) => element.remove());
        const file = `viewport-${width}.png`; await writeFile(path.join(output, file), png); evidence.push({ file, label: `Полная страница · ${width} px` });
        checks.push(overflow(data), collision(data), clipping(data), await contrast(data, png, mask), measure(data), widow(data), fonts(data), tap(data), resolution(data), reducedMotion(data), faceCrop(data), busyPhoto(data));
        if (width !== 1024) {
          const file = `screen-${width}.png`; await page.screenshot({ path: path.join(output, file) }); evidence.push({ file, label: `Первый экран · ${width} px` });
        }
        if (width === 390) for (const [index, photo] of (await page.locator(".directed-photo").all()).slice(0, 2).entries()) {
          const file = `photo-${index}.png`; await photo.screenshot({ path: path.join(output, file) }); evidence.push({ file, label: `Фото · ${index + 1}` });
        }
      } finally { await context.close(); }
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 1 });
    try {
      await restrict(context, url);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8, connectionType: "cellular3g" });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.addInitScript(() => {
        window.__qaMetrics = { lcp: null, cls: 0, lcpSupported: false, clsSupported: false };
        try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__qaMetrics.lcp = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); window.__qaMetrics.lcpSupported = true; } catch { /* reported below */ }
        try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__qaMetrics.cls += entry.value; }).observe({ type: "layout-shift", buffered: true }); window.__qaMetrics.clsSupported = true; } catch { /* reported below */ }
      });
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      if (!response?.ok()) throw new Error("Performance preview unavailable");
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(2500);
      const metrics = await page.evaluate(() => window.__qaMetrics);
      measurements = { lcpMs: metrics.lcp, cls: metrics.clsSupported ? metrics.cls : null, profile: "Fast3G-150ms-1.6Mbps-4xCPU" };
      checks.push(lcp(metrics), metrics.clsSupported ? cls(metrics) : { id: "cls", status: "error", samples: 0, findings: [] });
    } finally { await context.close(); }
    return { checks: mergeChecks(checks), evidence, measurements };
  } finally { process.removeListener("SIGTERM", stop); await browser.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input = ""; for await (const chunk of process.stdin) input += chunk;
  try { process.stdout.write(JSON.stringify(await perform(JSON.parse(input)))); }
  catch { process.stderr.write("QA_BROWSER_UNAVAILABLE_OR_INCOMPLETE\n"); process.exitCode = 1; }
}
