/**
 * Font support check (SPEC §16).
 *
 * For every candidate family this script:
 *   1. requests `https://fonts.googleapis.com/css2?family=<name>&subset=cyrillic`
 *      (plus a full-subset css2 request, because U+02BB lives in the latin
 *      subset and would never appear in the cyrillic-restricted response),
 *   2. parses every `unicode-range` from the returned @font-face blocks,
 *   3. verifies coverage of U+0400–04FF (the U+0400–045F core is the pass
 *      criterion — Google's own cyrillic subset never covers the full block)
 *      and the presence of U+02BB / U+02BC (Uzbek Latin apostrophes),
 *   4. writes `registry/fonts.generated.json` — the registry is populated from
 *      this output, never from memory.
 *
 * When fonts.googleapis.com is unreachable (e.g. offline or firewalled), the
 * script falls back to the `@fontsource` npm mirror of the same Google Fonts
 * metadata and records the source per family in the output. Run with
 * `--strict` to fail on any unmeasured family.
 *
 * Usage: npm run check-fonts  [-- --strict]
 */
import { gunzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GOOGLE_CSS2 = "https://fonts.googleapis.com/css2";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const CANDIDATES = [
  "Cormorant Garamond",
  "Cormorant Infant",
  "Playfair Display",
  "Prata",
  "Forum",
  "Tenor Sans",
  "Old Standard TT",
  "Alice",
  "Philosopher",
  "EB Garamond",
  "Literata",
  "PT Serif",
  "Noto Serif Display",
  "Golos Text",
  "Onest",
  "Manrope",
  "Jost",
  "Unbounded",
  "Montserrat",
  "Marck Script",
  "Caveat",
  "Bad Script",
  "Comfortaa",
] as const;

const BLOCK_START = 0x0400;
const BLOCK_END = 0x04ff;
const CORE_END = 0x045f; // U+0400–045F: modern Cyrillic used by ru/uz-Cyrillic
const BLOCK_SIZE = BLOCK_END - BLOCK_START + 1;
const CORE_SIZE = CORE_END - BLOCK_START + 1;

interface Face {
  weight: string | null;
  unicodeRanges: string[];
}

interface GeneratedFamily {
  name: string;
  source: string;
  weights: number[];
  weightRange: [number, number] | null;
  support: {
    cyrillic: boolean;
    cyrillicCodepoints: number;
    cyrillicCoverage: string[];
    latinExt: boolean;
    uzbekApostrophe: boolean;
  };
  faceCount: number;
}

interface Generated {
  checkedAt: string;
  notes: string;
  families: GeneratedFamily[];
}

interface Range {
  start: number;
  end: number;
}

// ---------------------------------------------------------------------------
// CSS parsing

function parseFaces(css: string): Face[] {
  const faces: Face[] = [];
  const blockRe = /@font-face\s*\{([^}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(css)) !== null) {
    const body = block[1] ?? "";
    const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim() ?? null;
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1] ?? "";
    const unicodeRanges = range
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
    faces.push({ weight, unicodeRanges });
  }
  return faces;
}

function parseRanges(faces: Face[]): Range[] {
  const ranges: Range[] = [];
  for (const face of faces) {
    for (const token of face.unicodeRanges) {
      const m = /^U\+([0-9A-Fa-f]{1,6})(?:-([0-9A-Fa-f]{1,6}))?$/.exec(token);
      if (!m) continue;
      const start = parseInt(m[1] as string, 16);
      const end = m[2] ? parseInt(m[2], 16) : start;
      ranges.push({ start, end });
    }
  }
  return ranges;
}

function coveredCodepoints(ranges: Range[], from: number, to: number): number {
  let covered = 0;
  for (let cp = from; cp <= to; cp++) {
    if (ranges.some((r) => r.start <= cp && cp <= r.end)) covered++;
  }
  return covered;
}

function coversPoint(ranges: Range[], cp: number): boolean {
  return ranges.some((r) => r.start <= cp && cp <= r.end);
}

function coverageIntervals(ranges: Range[], from: number, to: number): string[] {
  const out: string[] = [];
  let runStart = -1;
  for (let cp = from; cp <= to + 1; cp++) {
    const inside = cp <= to && coveredCodepoints(ranges, cp, cp) === 1;
    if (inside && runStart < 0) runStart = cp;
    if (!inside && runStart >= 0) {
      out.push(
        runStart === cp - 1
          ? `U+${runStart.toString(16).toUpperCase()}`
          : `U+${runStart.toString(16).toUpperCase()}-${(cp - 1).toString(16).toUpperCase()}`,
      );
      runStart = -1;
    }
  }
  return out;
}

function collectWeights(faces: Face[]): {
  weights: number[];
  weightRange: [number, number] | null;
} {
  const weights = new Set<number>();
  let range: [number, number] | null = null;
  for (const face of faces) {
    if (!face.weight) continue;
    const rangeMatch = /^(\d+)\s+(\d+)$/.exec(face.weight);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1] as string, 10);
      const hi = parseInt(rangeMatch[2] as string, 10);
      range = range ? [Math.min(range[0], lo), Math.max(range[1], hi)] : [lo, hi];
      continue;
    }
    const single = parseInt(face.weight, 10);
    if (!Number.isNaN(single)) weights.add(single);
  }
  return { weights: [...weights].sort((a, b) => a - b), weightRange: range };
}

// ---------------------------------------------------------------------------
// Sources

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchGoogleFaces(family: string): Promise<Face[] | null> {
  const name = encodeURIComponent(family);
  // The spec's exact probe, plus a full-subset request: U+02BB / U+02BC and
  // latin-ext only appear in non-cyrillic subsets.
  const [specCss, fullCss] = await Promise.all([
    fetchText(`${GOOGLE_CSS2}?family=${name}&subset=cyrillic`),
    fetchText(`${GOOGLE_CSS2}?family=${name}&display=swap`),
  ]);
  const css = [specCss, fullCss].filter(Boolean).join("\n");
  if (!css.trim()) return null;
  const faces = parseFaces(css);
  return faces.length > 0 ? faces : null;
}

/** Minimal tar walker over a gzipped npm tarball; collects *.css payloads. */
function extractCssFromTarball(tarball: Buffer): string {
  const tar = gunzipSync(tarball);
  const chunks: string[] = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const nameRaw = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const size = parseInt(header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim() || "0", 8);
    const typeflag = String.fromCharCode(header[156] ?? 0);
    const name = prefix ? `${prefix}/${nameRaw}` : nameRaw;
    const dataStart = offset + 512;
    const isFile = typeflag === "0" || typeflag === "\0" || typeflag === "";
    if (isFile && name.endsWith(".css") && !Number.isNaN(size)) {
      chunks.push(tar.subarray(dataStart, dataStart + size).toString("utf8"));
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return chunks.join("\n");
}

async function fetchFontsourceFaces(family: string): Promise<{ faces: Face[]; source: string } | null> {
  const slug = family.toLowerCase().replace(/\s+/g, "-");
  for (const scope of ["@fontsource", "@fontsource-variable"]) {
    const pkg = `${scope}/${slug}`;
    try {
      const metaRes = await fetch(`https://registry.npmjs.org/${pkg.replace("/", "%2F")}/latest`);
      if (!metaRes.ok) continue;
      const meta = (await metaRes.json()) as { dist?: { tarball?: string } };
      const tarballUrl = meta.dist?.tarball;
      if (!tarballUrl) continue;
      const tarRes = await fetch(tarballUrl);
      if (!tarRes.ok) continue;
      const css = extractCssFromTarball(Buffer.from(await tarRes.arrayBuffer()));
      const faces = parseFaces(css);
      if (faces.length > 0) return { faces, source: `npm:${pkg}` };
    } catch {
      // try the next scope
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Measurement

function measure(family: string, faces: Face[], source: string): GeneratedFamily {
  const ranges = parseRanges(faces);
  const { weights, weightRange } = collectWeights(faces);
  const cyrillicCodepoints = coveredCodepoints(ranges, BLOCK_START, BLOCK_END);
  return {
    name: family,
    source,
    weights,
    weightRange,
    support: {
      // Pass criterion: the modern Cyrillic core U+0400–045F must be covered.
      cyrillic: coveredCodepoints(ranges, BLOCK_START, CORE_END) === CORE_SIZE,
      cyrillicCodepoints,
      cyrillicCoverage: coverageIntervals(ranges, BLOCK_START, BLOCK_END),
      latinExt: coveredCodepoints(ranges, 0x0100, 0x024f) > 0,
      uzbekApostrophe: coversPoint(ranges, 0x02bb) && coversPoint(ranges, 0x02bc),
    },
    faceCount: faces.length,
  };
}

// ---------------------------------------------------------------------------
// Reporting

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function weightsLabel(f: GeneratedFamily): string {
  if (f.weightRange && f.weights.length === 0) return `${f.weightRange[0]}-${f.weightRange[1]}`;
  if (f.weightRange) return `${f.weights.join(",")}+var`;
  return f.weights.length > 0 ? f.weights.join(",") : "—";
}

function yesNo(v: boolean): string {
  return v ? "yes" : "no";
}

function printTable(families: GeneratedFamily[], sourcesUsed: Set<string>): void {
  const headers = ["FAMILY", "WEIGHTS", "CYRILLIC", "U+02BB/02BC", "LATIN-EXT", "SOURCE"];
  const widths = [20, 13, 9, 12, 10, 30];
  const line = (cells: string[]) =>
    cells.map((c, i) => pad(c, widths[i] ?? 12)).join("  ").trimEnd();
  console.log(line(headers));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const f of families) {
    console.log(
      line([
        f.name,
        weightsLabel(f),
        f.support.cyrillic ? "yes" : "NO",
        yesNo(f.support.uzbekApostrophe),
        yesNo(f.support.latinExt),
        f.source,
      ]),
    );
  }
  console.log("");
  console.log(
    `Cyrillic = U+0400–045F core of the U+0400–04FF block fully covered (per-family codepoints of ${BLOCK_SIZE} listed in the JSON).`,
  );
  console.log(
    `Sources used: ${[...sourcesUsed].join(", ") || "none"} — recorded per family in registry/fonts.generated.json.`,
  );
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const strict = process.argv.includes("--strict");
  const families: GeneratedFamily[] = [];
  const sourcesUsed = new Set<string>();
  let unmeasured = 0;

  for (const family of CANDIDATES) {
    let result = await fetchGoogleFaces(family);
    let source = "google-css2";
    if (result && result.length > 0) {
      sourcesUsed.add("google-css2");
    } else {
      const fallback = await fetchFontsourceFaces(family);
      if (fallback) {
        result = fallback.faces;
        source = fallback.source;
        sourcesUsed.add("npm-fontsource");
      } else {
        result = null;
      }
    }
    if (result) {
      families.push(measure(family, result, source));
    } else {
      unmeasured++;
      families.push({
        name: family,
        source: "unmeasured",
        weights: [],
        weightRange: null,
        support: {
          cyrillic: false,
          cyrillicCodepoints: 0,
          cyrillicCoverage: [],
          latinExt: false,
          uzbekApostrophe: false,
        },
        faceCount: 0,
      });
    }
  }

  const generated: Generated = {
    checkedAt: new Date().toISOString(),
    notes:
      "Generated by scripts/check-fonts.ts. The font registry is populated from this file. " +
      "cyrillic pass = U+0400–045F core covered; uzbekApostrophe = U+02BB and U+02BC present.",
    families,
  };
  const outPath = fileURLToPath(new URL("../registry/fonts.generated.json", import.meta.url));
  writeFileSync(outPath, JSON.stringify(generated, null, 2) + "\n");

  console.log(`Font support check — ${CANDIDATES.length} candidates`);
  console.log("");
  printTable(families, sourcesUsed);
  console.log("");
  console.log(`Wrote ${outPath}`);

  const passing = families.filter((f) => f.support.cyrillic && f.source !== "unmeasured").length;
  console.log(`${passing} families pass the Cyrillic check and are registry-eligible.`);
  if (unmeasured > 0) {
    console.log(`${unmeasured} families could not be measured from any source.`);
    if (strict) process.exit(1);
  }
  if (passing === 0) process.exit(1);
}

await main();
