import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Self-host Google Fonts so invitation loading and builds need no third party.
const root = fileURLToPath(new URL("../", import.meta.url));
const destination = `${root}public/font-assets/organic`;
const endpoint = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300&family=Montserrat:wght@400;500&display=swap";
const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const fetchFile = async (url, headers) => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Font fetch failed: ${response.status} ${url}`);
  return response;
};
const sourceCss = await (await fetchFile(endpoint, { "User-Agent": userAgent })).text();
const faces = [...sourceCss.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face\s*\{[^}]+\})/g)]
  .filter(([, subset]) => ["latin", "latin-ext", "cyrillic"].includes(subset));
if (faces.length !== 9) throw new Error("Unexpected Google Fonts response; inspect before regenerating.");
await mkdir(destination, { recursive: true });
const manifest = { endpoint, files: [] };
const sources = new Map();
const declarations = [];
for (const [, subset, face] of faces) {
  const family = face.match(/font-family:\s*'([^']+)'/)[1];
  const source = face.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)[1];
  const id = family.toLowerCase().replaceAll(" ", "-");
  const style = face.match(/font-style:\s*(\w+)/)[1];
  let file = sources.get(source);
  if (!file) {
    file = `${id}-${subset}-${style}.woff2`;
    const buffer = Buffer.from(await (await fetchFile(source)).arrayBuffer());
    await writeFile(`${destination}/${file}`, buffer);
    manifest.files.push({ file, source, bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") });
    sources.set(source, file);
  }
  declarations.push(`/* ${subset} */\n${face.replace(source, `/font-assets/organic/${file}`)}`);
}
for (const [id, directory] of [["cormorant-garamond", "cormorantgaramond"], ["montserrat", "montserrat"]]) {
  const license = await (await fetchFile(`https://raw.githubusercontent.com/google/fonts/main/ofl/${directory}/OFL.txt`)).text();
  await writeFile(`${destination}/${id}-LICENSE.txt`, license);
}
await writeFile(`${destination}/sources.json`, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(`${root}app/organic-fonts.css`, `/* Google Fonts, self-hosted under SIL OFL. Regenerate: node scripts/prepare-organic-fonts.mjs */\n${declarations.join("\n")}\n`);
console.log(`Prepared ${sources.size} WOFF2 files (${manifest.files.reduce((sum, file) => sum + file.bytes, 0)} bytes).`);
