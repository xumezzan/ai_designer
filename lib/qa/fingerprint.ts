import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { QA_ENGINE } from "@/lib/schema/qa";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function rendererRevision() {
  let build = "development";
  try { build = await readFile(path.join(process.cwd(), ".next/BUILD_ID"), "utf8"); } catch { /* source hashes remain authoritative locally */ }
  const files = ["app/invitation.css", "app/photos.css", "app/artwork.css", "app/craft.css", "app/fonts.generated.css", "components/layouts/ScrollNarrative.tsx", "components/primitives/DirectedImage.tsx", "qa/snapshot.mjs"];
  const sources = await Promise.all(files.map(async (file) => {
    try { return await readFile(path.join(process.cwd(), file), "utf8"); } catch { return file; }
  }));
  return digest([QA_ENGINE, build, ...sources].join("\n"));
}
