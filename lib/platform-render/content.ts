import {
  toInvitationContent,
  type InvitationDraft,
} from "@/lib/platform/schema";

/** Management titles stay in the dashboard; names identify the public event.
 * Platform story/RSVP are independent authored slots. */
export function platformContent(
  draft: InvitationDraft,
  slug = "platform-preview",
) {
  const dateOnly = !draft.date.time;
  // A calendar day is not a local midnight. Resolve an instant only after the
  // owner supplies a time; some IANA zones change their offset at midnight.
  const content = toInvitationContent(
    dateOnly ? { ...draft, date: { ...draft.date, day: "" } } : draft,
    slug,
  );
  return {
    ...content,
    headline: draft.headline?.trim() || undefined,
    rsvp: undefined,
    date: dateOnly
      ? {
          ...content.date,
          start: "",
          day:
            draft.purpose !== "greeting" && draft.enabledSections.includes("date") && draft.date.day
              ? draft.date.day
              : undefined,
          showCountdown: false,
        }
      : content.date,
  };
}
