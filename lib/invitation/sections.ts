import type { Content } from "@/lib/schema/content";
import { SECTION_IDS } from "@/registry/keys";
export function populatedSections(content: Content) {
  return SECTION_IDS.filter((id) => id === "hero" || id === "footer" || id === "venue" || (id === "greeting" && content.greeting) || (id === "countdown" && content.date.showCountdown) || (id === "timeline" && content.timeline.length) || (id === "dressCode" && content.dressCode) || (id === "rsvp" && content.rsvp?.enabled));
}
