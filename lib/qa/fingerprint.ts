import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { QA_ENGINE } from "@/lib/schema/qa";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function rendererRevision() {
  let build = "development";
  try { build = await readFile(path.join(process.cwd(), ".next/BUILD_ID"), "utf8"); } catch { /* source hashes remain authoritative locally */ }
  const files = ["app/invitation.css", "app/atelier.css", "app/photos.css", "app/artwork.css", "app/craft.css", "app/physicality.css", "lib/theme/toCssVars.ts", "components/craft/GrainOverlay.tsx", "components/craft/SurfaceFrame.tsx", "components/craft/TextReveal.tsx", "components/primitives/Surface.tsx", "components/primitives/FoilText.tsx", "app/fonts.generated.css", "components/layouts/ScrollNarrative.tsx", "components/primitives/DirectedImage.tsx", "components/primitives/GeneratedVisual.tsx", "components/craft/Reveal.tsx", "components/craft/InvitationExperience.tsx", "components/sections/Hero.tsx", "components/sections/Greeting.tsx", "components/sections/Timeline.tsx", "components/sections/Venue.tsx", "components/sections/DressCode.tsx", "components/sections/DressPalette.tsx", "components/sections/Rsvp.tsx", "components/sections/RsvpForm.tsx", "components/sections/Calendar.tsx", "registry/typesets/index.ts", "registry/motion/index.ts", "lib/invitation/locale.ts", "lib/invitation/calendar.ts", "lib/invitation/guest.ts", "qa/snapshot.mjs", "qa/run.mjs"];
  const sources = await Promise.all(files.map(async (file) => {
    try { return await readFile(path.join(process.cwd(), file), "utf8"); } catch { return file; }
  }));
  const authoredArt = await Promise.all(["app/story.css", "components/layouts/WeddingStory.tsx", "components/sections/StoryDate.tsx", "lib/invitation/month.ts", "components/craft/SignatureArt.tsx", "components/craft/HeroStock.tsx", "components/primitives/Ornament.tsx", "registry/ornaments/index.ts", "registry/ornaments/botanical.ts"].map(async (file) => {
    try { return await readFile(path.join(process.cwd(), file), "utf8"); } catch { return file; }
  }));
  return digest([QA_ENGINE, build, ...sources, ...authoredArt].join("\n"));
}
