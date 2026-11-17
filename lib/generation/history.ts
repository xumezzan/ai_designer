import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Theme } from "@/lib/schema/theme";
import { VisualRecord } from "@/lib/schema/visual";
import { safeId } from "@/lib/schema/ids";
import { designIdentity, MAX_RECENT_DESIGNS, type DesignIdentity } from "./diversity";

/** Bounded, read-only memory, including older batches that are no longer active.
 * Only enum-based design decisions leave this function; event content does not. */
export async function readRecentDesigns(root: string, currentSlug: string): Promise<DesignIdentity[]> {
  let projects;
  try { projects = await readdir(root, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const selected = projects.filter((entry) => entry.isDirectory() && safeId(entry.name));
  const candidates = (await Promise.all(selected.map(async ({ name: slug }) => {
    const conceptsRoot = path.join(root, slug, "concepts");
    let entries;
    try { entries = await readdir(conceptsRoot, { withFileTypes: true }); }
    catch { return []; }
    return Promise.all(entries.filter((entry) => entry.isDirectory() && safeId(entry.name)).map(async (entry) => {
      try {
        const directory = path.join(conceptsRoot, entry.name);
        const version = (await readdir(directory)).filter((file) => /^v[1-9]\d{0,4}\.json$/.test(file))
          .sort((a, b) => Number(b.slice(1, -5)) - Number(a.slice(1, -5)))[0];
        if (!version) return null;
        const file = path.join(directory, version);
        return { file, project: path.join(root, slug), modified: (await stat(file)).mtimeMs, current: slug === currentSlug };
      } catch { return null; }
    }));
  }))).flat().filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.modified - a.modified || Number(b.current) - Number(a.current)).slice(0, 64);
  const identities = await Promise.all(candidates.map(async ({ file, project }) => {
    try {
      const theme = Theme.safeParse(JSON.parse(await readFile(file, "utf8")));
      if (!theme.success) return null;
      let artworkDescription: string | undefined;
      if (theme.data.generatedVisual) {
        try {
          const record = VisualRecord.parse(JSON.parse(await readFile(path.join(project, "art", theme.data.generatedVisual.id, "meta.json"), "utf8")));
          if (record.sha256 === theme.data.generatedVisual.sha256) artworkDescription = record.prompt.split("\nDirection: ")[1]?.split("\n")[0];
        } catch { /* Legacy artwork without metadata still contributes layout identity. */ }
      }
      return designIdentity(theme.data, false, artworkDescription);
    } catch { return null; }
  }));
  const unique = new Map<string, DesignIdentity>();
  for (const identity of identities) {
    if (identity) unique.set(JSON.stringify(identity), identity);
    if (unique.size === MAX_RECENT_DESIGNS) break;
  }
  return [...unique.values()];
}
