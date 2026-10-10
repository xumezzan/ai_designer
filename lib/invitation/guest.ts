/** URL personalization stays display-only and never changes saved event facts. */
export function guestName(value?: string | string[]): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim();
  return name ? Array.from(name).slice(0, 80).join("") : undefined;
}
