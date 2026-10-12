/**
 * Vendor the current type-set families and measure their fallback faces.
 * Uses Next's bundled fontkit for metrics and an offline FontTools subsetter.
 * Usage: node scripts/prepare-fonts.mjs --python /path/to/venv/bin/python
 * Optional: --sources /path/to/cached/ttf --serif /path/to/Times.ttf --sans /path/to/Arial.ttf
 */
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fontkitModule = require("next/dist/compiled/@next/font/dist/fontkit");
const fontFromBuffer = fontkitModule.default.default ?? fontkitModule.default;
const root = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(readFileSync(`${root}registry/font-assets.config.json`, "utf8"));
const output = `${root}public/font-assets`;
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  if (!process.argv[index + 1]) throw new Error(`${name} requires a font file path`);
  return process.argv[index + 1];
};
const fallbackPaths = {
  serif: argument("--serif", "/System/Library/Fonts/Supplemental/Times New Roman.ttf"),
  sans: argument("--sans", "/System/Library/Fonts/Supplemental/Arial.ttf"),
};
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const fallbackBuffers = Object.fromEntries(Object.entries(fallbackPaths).map(([role, path]) => [role, readFileSync(path)]));
const fallbackFonts = Object.fromEntries(Object.entries(fallbackBuffers).map(([role, buffer]) => [role, fontFromBuffer(buffer)]));
const python = argument("--python", "python3");
const sources = argument("--sources", mkdtempSync(`${tmpdir()}/invitation-fonts-`));

async function fetchBuffer(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

// Measured widths, including Russian and Uzbek Latin; unsupported glyphs are excluded per subset.
const sample = "Любовь приглашение свадьба день семья друзья Сарвар Ёра Джаъфар Ситора " +
  "Oʻzbekiston Gʻayrat oila doʻstlar toʻy marosimi kelajak " +
  "aaabcdeeeefghiijklmnnoopqrrssttuvwxyz ĀāĂăĄąĒēĪīŌōŪūʻʼ";

function fallbackMetrics(font, fallback) {
  const characters = [...sample].filter((character) =>
    font.hasGlyphForCodePoint(character.codePointAt(0)) && fallback.hasGlyphForCodePoint(character.codePointAt(0)));
  if (characters.filter((character) => character !== " ").length < 2) {
    throw new Error(`Too few shared sample glyphs in ${font.familyName}`);
  }
  const average = (face) => characters.reduce((sum, character) =>
    sum + face.glyphForCodePoint(character.codePointAt(0)).advanceWidth, 0) / characters.length / face.unitsPerEm;
  const sizeAdjust = average(font) / average(fallback);
  const percent = (value) => `${(Math.abs(value) * 100).toFixed(4)}%`;
  return {
    sizeAdjust: percent(sizeAdjust),
    ascentOverride: percent(font.ascent / font.unitsPerEm / sizeAdjust),
    descentOverride: percent(font.descent / font.unitsPerEm / sizeAdjust),
    lineGapOverride: percent(font.lineGap / font.unitsPerEm / sizeAdjust),
    sampleGlyphs: characters.length,
  };
}

mkdirSync(output, { recursive: true });
const jobs = [];
for (const family of config.families) {
  const directory = family.id.replaceAll("-", "");
  const source = `${sources}/${directory}.ttf`;
  const base = `https://raw.githubusercontent.com/google/fonts/${config.sourceCommit}/`;
  const sourceUrl = base + family.sourcePath.split("/").map(encodeURIComponent).join("/");
  const sourceBuffer = existsSync(source) ? readFileSync(source) : await fetchBuffer(sourceUrl);
  const blobSha = createHash("sha1").update(`blob ${sourceBuffer.length}\0`).update(sourceBuffer).digest("hex");
  if (blobSha !== family.sourceSha) throw new Error(`Source hash mismatch for ${family.id}`);
  writeFileSync(source, sourceBuffer);
  const license = `${sources}/${directory}-OFL.txt`;
  const licenseBuffer = existsSync(license) ? readFileSync(license) :
    await fetchBuffer(base + `ofl/${directory}/OFL.txt`);
  writeFileSync(`${output}/${family.id}-LICENSE.txt`, licenseBuffer);
  jobs.push({ ...family, source, output });
}
const jobPath = `${sources}/jobs.json`;
writeFileSync(jobPath, JSON.stringify(jobs));
const subsetResult = spawnSync(python, [`${root}scripts/subset-fonts.py`, jobPath], { stdio: "inherit" });
if (subsetResult.error) throw subsetResult.error;
if (subsetResult.status !== 0) throw new Error("Subsetting failed. See public/font-assets/README.md for regeneration prerequisites.");
const toolsResult = spawnSync(python, ["-c", "import fontTools, brotli; print(fontTools.__version__, brotli.__version__)"], { encoding: "utf8" });
const manifest = { sourceCommit: config.sourceCommit, tools: toolsResult.stdout.trim(), sample, families: {} };
const css = ["/* Generated by scripts/prepare-fonts.mjs. SIL OFL faces; measured system fallback metrics. */"];
for (const family of config.families) {
  const fallback = fallbackFonts[family.fallback];
  const sourceFont = fontFromBuffer(readFileSync(`${sources}/${family.id.replaceAll("-", "")}.ttf`));
  const entry = { family: family.name, sourcePath: family.sourcePath, sourceSha: family.sourceSha,
    fallback: fallback.familyName, fallbackSha256: sha256(fallbackBuffers[family.fallback]),
    uzbekApostrophe: [0x02bb, 0x02bc].every((codepoint) => sourceFont.hasGlyphForCodePoint(codepoint)),
    latinExt: [..."ĀāĂăĄąĒēĪīŌōŪū"].every((character) => sourceFont.hasGlyphForCodePoint(character.codePointAt(0))), faces: [] };
  for (const weight of family.weights) for (const subset of config.subsets) {
    const filename = `${family.id}-${subset}-${weight}-normal.woff2`;
    const buffer = readFileSync(`${output}/${filename}`);
    const unicodeRange = family.ranges[subset];
    if (!unicodeRange) throw new Error(`No unicode-range for ${filename}`);
    const font = fontFromBuffer(buffer);
    const metrics = fallbackMetrics(font, fallback);
    const path = `/font-assets/${filename}`;
    writeFileSync(`${output}/${filename}`, buffer);
    entry.faces.push({ path, subset, weight, unicodeRange, sha256: sha256(buffer), bytes: buffer.length,
      unitsPerEm: font.unitsPerEm, ascent: font.ascent, descent: font.descent, lineGap: font.lineGap,
      features: font.availableFeatures, metrics });
    css.push(`@font-face { font-family: "${family.name}"; src: url("${path}") format("woff2"); font-weight: ${weight}; font-style: normal; font-display: swap; unicode-range: ${unicodeRange}; }`);
    css.push(`@font-face { font-family: "${family.name} Fallback"; src: local("${fallback.familyName}"); font-weight: ${weight}; font-style: normal; size-adjust: ${metrics.sizeAdjust}; ascent-override: ${metrics.ascentOverride}; descent-override: ${metrics.descentOverride}; line-gap-override: ${metrics.lineGapOverride}; unicode-range: ${unicodeRange}; }`);
  }
  manifest.families[family.id] = entry;
  console.log(`${family.name}: ${entry.faces.length} WOFF2 subsets, fallback ${fallback.familyName}`);
}
writeFileSync(`${root}registry/font-assets.generated.json`, JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(`${root}app/fonts.generated.css`, css.join("\n") + "\n");
