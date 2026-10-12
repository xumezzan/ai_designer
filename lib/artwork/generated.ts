import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { VisualRef, VisualRecord, type VisualRef as Ref } from "@/lib/schema/visual";
import { safeId } from "@/lib/schema/ids";

export async function readGeneratedVisual(slug: string, id: string, expected?: Ref, root = path.join(process.cwd(), "projects")) {
  if (!safeId(slug) || !VisualRef.shape.id.safeParse(id).success) return null;
  try {
    const directory = path.join(root, slug, "art", id);
    const record = VisualRecord.parse(JSON.parse(await readFile(path.join(directory, "meta.json"), "utf8")));
    const data = await readFile(path.join(directory, "image.webp"));
    if (record.id !== id || createHash("sha256").update(data).digest("hex") !== record.sha256 || (expected && (expected.sha256 !== record.sha256 || expected.width !== record.width || expected.height !== record.height || Boolean(expected.isolated) !== Boolean(record.isolated)))) throw new Error("Generated artwork integrity mismatch");
    return { data, record, src: `/art/${slug}/${id}` };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
