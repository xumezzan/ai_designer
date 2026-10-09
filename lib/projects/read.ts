import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Content } from "../schema/content";
import { AssetPlan } from "../schema/assetPlan";
import { validateTheme } from "../theme/validate";
import { COMPOSITION_IDS } from "../../registry/keys";
import { readDirectedPhotos } from "../assets/read";

const root = path.join(process.cwd(), "projects");
export const safeId = (id: string) => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
async function readJson(file: string) { return JSON.parse(await readFile(file, "utf8")); }

export async function readInvitation(slug: string, concept: string, version: string) {
  if (!safeId(slug) || !safeId(concept) || !/^[1-9]\d{0,4}$/.test(version)) return null;
  try {
    const [rawContent, rawPlan, rawTheme] = await Promise.all([
      readJson(path.join(root, slug, "content.json")), readJson(path.join(root, slug, "asset-plan.json")),
      readJson(path.join(root, slug, "concepts", concept, `v${version}.json`)),
    ]);
    const content = Content.parse(rawContent);
    if (content.slug !== slug) throw new Error("Project slug does not match its directory");
    const assetPlan = AssetPlan.parse(rawPlan);
    const photos = await readDirectedPhotos(content, assetPlan);
    const result = validateTheme(rawTheme, { locale: content.locale, hasHighQualityAsset: photos.some((photo) => photo.asset.quality === "high" && photo.asset.placement?.section === "hero") });
    if (!result.ok) throw new Error(result.errors.join("; "));
    return { content, assetPlan, photos, theme: result.theme, adjustments: result.adjustments };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function demoConcepts() {
  const entries = await readdir(path.join(root, "demo", "concepts"), { withFileTypes: true });
  const concepts = await Promise.all(entries.filter((entry) => entry.isDirectory() && safeId(entry.name)).map(async (entry) => {
    const versions = (await readdir(path.join(root, "demo", "concepts", entry.name)))
      .map((file) => /^v([1-9]\d{0,4})\.json$/.exec(file)?.[1]).filter((value): value is string => Boolean(value));
    const version = versions.sort((a, b) => Number(b) - Number(a))[0];
    if (!version) throw new Error(`Missing demo concept ${entry.name}`);
    const invitation = await readInvitation("demo", entry.name, version);
    if (!invitation) throw new Error(`Missing demo concept ${entry.name}`);
    return { id: entry.name, version, theme: invitation.theme };
  }));
  return concepts.sort((a, b) => COMPOSITION_IDS.indexOf(a.theme.layout.composition) - COMPOSITION_IDS.indexOf(b.theme.layout.composition));
}
