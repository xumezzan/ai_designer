/** Local wall time is resolved against IANA rules, including DST gaps/overlaps. */
export function wallTime(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function resolveWallTime(local: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("Укажите дату и время события.");
  const nominal = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(nominal)) throw new Error("Проверьте дату события.");
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }); }
  catch { throw new Error("Укажите часовой пояс в формате Asia/Tashkent."); }
  const matches: string[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = new Date(nominal - offset * 60000).toISOString();
    if (wallTime(instant, timezone) === local) {
      const sign = offset >= 0 ? "+" : "-";
      const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
      const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
      matches.push(`${local}:00${sign}${hours}:${minutes}`);
    }
  }
  if (!matches.length) throw new Error("Такого времени нет в выбранном часовом поясе. Измените дату или время.");
  if (matches.length > 1) throw new Error("Это время повторяется при переводе часов. Выберите время вне перехода.");
  return matches[0];
}
