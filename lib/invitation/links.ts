/** Only deliberate protocols may reach an invitation's interactive links. */
export function httpTarget(target: string) {
  const url = new URL(target);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error("Use an HTTP(S) destination without credentials");
  return url.href;
}
export function rsvpTarget(mode: "telegram" | "phone" | "form", target: string) {
  if (mode === "form") return httpTarget(target);
  if (mode === "phone") {
    const number = target.replace(/[\s()-]/g, "");
    if (!/^\+\d{8,15}$/.test(number)) throw new Error("Use an international phone number");
    return `tel:${number}`;
  }
  const username = target.replace(/^@/, "");
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) throw new Error("Use a Telegram username");
  return `https://t.me/${username}`;
}
