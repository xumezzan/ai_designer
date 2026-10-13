import type { Content } from "@/lib/schema/content";
import { SECTION_IDS, type SectionId } from "@/registry/keys";
export function populatedSections(content: Content) {
  return SECTION_IDS.filter((id) => id === "hero" || id === "footer" || (id === "venue" && Boolean(content.venue.name || content.venue.address || content.venue.note || content.venue.mapUrl || content.venue.coords)) || (id === "greeting" && content.greeting?.trim()) || (id === "countdown" && content.date.start && content.date.showCountdown) || (id === "timeline" && content.timeline.length) || (id === "dressCode" && content.dressCode) || (id === "wishes" && content.wishes?.trim()) || (id === "rsvp" && content.rsvp?.enabled));
}
/** Semantic places stay stable as a short invitation grows. A location cannot
 * drift behind dress code just because it was filled in later. */
export function canonicalSectionOrder(sections: readonly SectionId[]): SectionId[] {
  const present = new Set(sections);
  return SECTION_IDS.filter((id) => present.has(id));
}
export function invitationSectionOrder(content: Content, order: SectionId[], photoSections: SectionId[] = []) {
  return canonicalSectionOrder([...order, ...populatedSections(content), ...photoSections]);
}
