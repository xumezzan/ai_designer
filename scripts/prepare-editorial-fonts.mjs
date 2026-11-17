import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync } from "node:zlib";

// Read only the untransformed cmap table; outline reconstruction is unnecessary
// for glyph coverage. Directory decoding follows https://www.w3.org/TR/WOFF2/.
function cmapFromWoff2(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "wOF2" || buffer.toString("ascii", 4, 8) === "ttcf") {
    throw new Error("Expected a single WOFF2 font, not a collection.");
  }
  const knownTags = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];
  let cursor = 48;
  const readBase128 = () => {
    let value = 0;
    for (let index = 0; index < 5; index++) {
      const byte = buffer[cursor++];
      if (byte === undefined || (index === 0 && byte === 0x80)) throw new Error("Invalid WOFF2 Base128.");
      value = value * 128 + (byte & 0x7f);
      if (value > 0xffffffff) throw new Error("WOFF2 Base128 overflow.");
      if (!(byte & 0x80)) return value;
    }
    throw new Error("WOFF2 Base128 exceeds five bytes.");
  };
  let tableOffset = 0;
  let cmap;
  for (let index = 0; index < buffer.readUInt16BE(12); index++) {
    const flags = buffer[cursor++];
    const tagIndex = flags & 0x3f;
    const tag = tagIndex === 63 ? buffer.toString("ascii", cursor, cursor += 4) : knownTags[tagIndex];
    const version = flags >> 6;
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0;
    const length = readBase128();
    const streamLength = transformed ? readBase128() : length;
    if (tag === "cmap") {
      if (transformed) throw new Error("Unsupported transformed cmap.");
      cmap = { offset: tableOffset, length };
    }
    tableOffset += streamLength;
  }
  if (!cmap) throw new Error("WOFF2 has no cmap.");
  const stream = brotliDecompressSync(buffer.subarray(cursor, cursor + buffer.readUInt32BE(20)));
  if (stream.length !== tableOffset) throw new Error("WOFF2 table stream length mismatch.");
  return stream.subarray(cmap.offset, cmap.offset + cmap.length);
}

function hasGlyph(cmap, point) {
  for (let index = 0; index < cmap.readUInt16BE(2); index++) {
    const record = 4 + index * 8;
    const platform = cmap.readUInt16BE(record);
    if (platform !== 0 && platform !== 3) continue;
    const base = cmap.readUInt32BE(record + 4);
    const format = cmap.readUInt16BE(base);
    if (format === 4 && point <= 0xffff) {
      const segments = cmap.readUInt16BE(base + 6) / 2;
      for (let segment = 0; segment < segments; segment++) {
        const end = cmap.readUInt16BE(base + 14 + segment * 2);
        const start = cmap.readUInt16BE(base + 16 + segments * 2 + segment * 2);
        if (point < start || point > end) continue;
        const delta = cmap.readInt16BE(base + 16 + segments * 4 + segment * 2);
        const address = base + 16 + segments * 6 + segment * 2;
        const rangeOffset = cmap.readUInt16BE(address);
        const glyph = rangeOffset ? cmap.readUInt16BE(address + rangeOffset + (point - start) * 2) : point;
        if (glyph && ((glyph + delta) & 0xffff)) return true;
      }
    } else if (format === 12 || format === 13) {
      for (let group = 0; group < cmap.readUInt32BE(base + 12); group++) {
        const entry = base + 16 + group * 12;
        const start = cmap.readUInt32BE(entry);
        const end = cmap.readUInt32BE(entry + 4);
        const firstGlyph = cmap.readUInt32BE(entry + 8);
        if (point >= start && point <= end && (format === 13 ? firstGlyph : firstGlyph + point - start)) return true;
      }
    }
  }
  return false;
}

// Explicit maintenance command only. Checked-in WOFF2s keep production builds
// and guest invitations independent of external font servers.
const root = fileURLToPath(new URL("../", import.meta.url));
const destination = `${root}public/font-assets/editorial`;
const endpoint = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Jost:wght@400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=swap";
const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const fetchFile = async (url, headers) => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Font fetch failed: ${response.status} ${url}`);
  return response;
};
const sourceCss = await (await fetchFile(endpoint, { "User-Agent": userAgent })).text();
const faces = [...sourceCss.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face\s*\{[^}]+\})/g)]
  .filter(([, subset]) => ["latin", "latin-ext", "cyrillic"].includes(subset))
  .map(([, subset, face]) => ({
    subset,
    face,
    family: face.match(/font-family:\s*'([^']+)'/)[1],
    style: face.match(/font-style:\s*(\w+)/)[1],
    weight: Number(face.match(/font-weight:\s*(\d+)/)[1]),
    source: face.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)[1],
    unicodeRange: face.match(/unicode-range:\s*([^;]+);/)[1],
  }));
const expectedFaces = [
  ["Cormorant Garamond", "normal", 400], ["Cormorant Garamond", "italic", 400],
  ["Playfair Display", "normal", 400], ["Playfair Display", "italic", 400],
  ["Jost", "normal", 400], ["Jost", "normal", 500],
];
if (faces.length !== expectedFaces.length * 3 || expectedFaces.some(([family, style, weight]) =>
  faces.filter((face) => face.family === family && face.style === style && face.weight === weight).length !== 3)) {
  throw new Error("Unexpected Google Fonts response; inspect every face before regenerating.");
}
const covers = (ranges, point) => ranges.split(",").some((range) => {
  const [, from, to = from] = range.trim().match(/^U\+([\da-f]+)(?:-([\da-f]+))?$/i) ?? [];
  return from && parseInt(from, 16) <= point && point <= parseInt(to, 16);
});
const coverage = expectedFaces.map(([family, style, weight]) => {
  const ranges = faces.filter((face) => face.family === family && face.style === style && face.weight === weight)
    .map((face) => face.unicodeRange).join(",");
  const cyrillicCore = Array.from({ length: 0x0460 - 0x0400 }, (_, index) => 0x0400 + index).every((point) => covers(ranges, point));
  const uzbekApostrophes = covers(ranges, 0x02bb) && covers(ranges, 0x02bc);
  if (!cyrillicCore || !uzbekApostrophes) throw new Error(`Missing Cyrillic or Uzbek CSS coverage: ${family} ${style} ${weight}`);
  return { family, style, weight, cyrillicCore, uzbekApostrophes };
});
await mkdir(destination, { recursive: true });
const manifest = { endpoint, cssSha256: sha256(sourceCss), coverageBasis: "Google Fonts unicode-range; binary glyph verification recorded in glyph-coverage.json", coverage, files: [], licenses: [] };
const sources = new Map();
const cmaps = new Map();
const declarations = [];
for (const { subset, face, family, style, weight, source } of faces) {
  const id = family.toLowerCase().replaceAll(" ", "-");
  let file = sources.get(source);
  if (!file) {
    file = `${id}-${subset}-${style}-${weight}.woff2`;
    const buffer = Buffer.from(await (await fetchFile(source)).arrayBuffer());
    cmaps.set(source, cmapFromWoff2(buffer));
    await writeFile(`${destination}/${file}`, buffer);
    manifest.files.push({ file, source, bytes: buffer.length, sha256: sha256(buffer) });
    sources.set(source, file);
  }
  declarations.push(`/* ${subset} */\n${face.replace(source, `/font-assets/editorial/${file}`)}`);
}
const binaryCoverage = expectedFaces.map(([family, style, weight]) => {
  const selected = faces.filter((face) => face.family === family && face.style === style && face.weight === weight);
  const has = (point) => selected.some((face) => hasGlyph(cmaps.get(face.source), point));
  const missingCyrillicCore = Array.from({ length: 0x0460 - 0x0400 }, (_, index) => 0x0400 + index)
    .filter((point) => !has(point)).map((point) => `U+${point.toString(16).toUpperCase().padStart(4, "0")}`);
  const cyrillicCore = !missingCyrillicCore.length;
  const uzbekApostrophes = has(0x02bb) && has(0x02bc);
  if (!cyrillicCore && family === "Cormorant Garamond") throw new Error(`Missing binary Cyrillic core: ${family} ${style} ${weight}: ${missingCyrillicCore.join(", ")}`);
  if (family === "Cormorant Garamond" && !uzbekApostrophes) throw new Error("Cormorant fallback must contain both Uzbek modifier apostrophes.");
  return { family, style, weight, cyrillicCore, missingCyrillicCore, uzbekApostrophes,
    fallbackForCyrillic: cyrillicCore ? null : family === "Jost" ? "Montserrat" : "Cormorant Garamond",
    fallbackForUzbek: uzbekApostrophes ? null : family === "Jost" ? "Montserrat" : "Cormorant Garamond" };
});
const fallbackFiles = await Promise.all(["cyrillic", "latin-ext", "latin"].map(async (subset) => {
  const file = `../organic/montserrat-${subset}-normal.woff2`;
  const buffer = await readFile(`${destination}/${file}`);
  return { file, sha256: sha256(buffer), cmap: cmapFromWoff2(buffer) };
}));
const fallbackHas = (point) => fallbackFiles.some(({ cmap }) => hasGlyph(cmap, point));
const fallbackCyrillic = Array.from({ length: 0x0460 - 0x0400 }, (_, index) => 0x0400 + index).every(fallbackHas);
const fallbackUzbek = fallbackHas(0x02bb) && fallbackHas(0x02bc);
if (!fallbackCyrillic || !fallbackUzbek) throw new Error("Existing Montserrat fallback lacks required Cyrillic or Uzbek glyphs.");
await writeFile(`${destination}/glyph-coverage.json`, `${JSON.stringify({
  method: "Decompress WOFF2 Brotli table stream; inspect Unicode cmap formats 4/12/13 for nonzero glyph IDs.",
  cyrillicCore: "U+0400–045F", uzbekApostrophes: ["U+02BB", "U+02BC"], faces: binaryCoverage,
  fallbacks: [{ family: "Montserrat", style: "normal", weights: [400, 500], cyrillicCore: fallbackCyrillic,
    uzbekApostrophes: fallbackUzbek, files: fallbackFiles.map(({ file, sha256: hash }) => ({ file, sha256: hash })) }],
}, null, 2)}\n`);
for (const [id, directory] of [["cormorant-garamond", "cormorantgaramond"], ["playfair-display", "playfairdisplay"], ["jost", "jost"]]) {
  const source = `https://raw.githubusercontent.com/google/fonts/main/ofl/${directory}/OFL.txt`;
  const license = await (await fetchFile(source)).text();
  const file = `${id}-LICENSE.txt`;
  await writeFile(`${destination}/${file}`, license);
  manifest.licenses.push({ file, source, sha256: sha256(license) });
}
await writeFile(`${destination}/sources.json`, `${JSON.stringify(manifest, null, 2)}\n`);
const accentRule = `.editorial-italic-accent {\n  font-family: var(--editorial-font-display, var(--font-display, "Cormorant Garamond", Georgia, serif));\n  font-style: italic;\n  font-weight: 400;\n  font-synthesis: none;\n}`;
await writeFile(`${root}app/editorial-fonts.css`, `/* Google Fonts, self-hosted under SIL OFL. Regenerate: node scripts/prepare-editorial-fonts.mjs */\n${declarations.join("\n")}\n\n${accentRule}\n`);
console.log(`Prepared ${sources.size} WOFF2 files (${manifest.files.reduce((sum, file) => sum + file.bytes, 0)} bytes); binary Cyrillic and Uzbek glyph coverage recorded for all six styles.`);
