import { z } from "zod";
import { Content, type Content as EventContent } from "@/lib/schema/content";

const fact = <T extends z.ZodTypeAny>(value: T) => z.object({ value, source: z.string().min(1).max(1000) }).strict().nullable();
export const BriefFacts = z.object({
  eventType: fact(Content.innerType().shape.eventType),
  hosts: fact(z.array(z.string().min(1).max(100)).min(1).max(12)),
  headline: fact(z.string().min(1).max(200)),
  day: fact(z.string().date()),
  venue: fact(z.string().min(1).max(200)),
  venueAddress: fact(z.string().min(1).max(1000)).optional(),
  venueNote: fact(z.string().min(1).max(1000)).optional(),
  venueMapUrl: fact(z.string().url().refine((value) => /^https?:\/\//i.test(value))).optional(),
  greeting: fact(z.string().min(1).max(10000)),
  wishes: fact(z.string().min(1).max(10000)).optional(),
  timeline: fact(z.array(z.object({ time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), title: z.string().min(1).max(200), note: z.string().max(1000).optional() }).strict()).min(1).max(40)).optional(),
  closing: fact(z.string().min(1).max(1000)),
  dressCode: fact(z.object({ title: z.string().min(1).max(200), note: z.string().max(1000) }).strict()),
}).strict();
export type BriefFacts = z.infer<typeof BriefFacts>;

// Literal labelled facts and a possessive birthday title are recoverable without
// a second AI request. This deliberately does not guess facts from design words.
export function literalBriefFacts(brief = ""): BriefFacts {
  const result: BriefFacts = { eventType: null, hosts: null, headline: null, day: null, venue: null, greeting: null, closing: null, dressCode: null };
  const title = /\binvitation\s+for\s+([^\n]+)/i.exec(brief);
  if (title) {
    const value = title[1].trim();
    if (value.length <= 200) result.headline = { value, source: title[1] };
    const birthday = /^([A-ZА-ЯЁ][\p{L}\p{M}-]{1,60})['’]s\s+(?:great\s+)?birthday\s+celebration\s*$/u.exec(value);
    if (birthday) { result.hosts = { value: [birthday[1]], source: birthday[0] }; result.eventType = { value: "birthday", source: birthday[0] }; }
  }
  const day = /(?:Дата|Date)\s*:\s*(\d{2})\.(\d{2})\.(\d{4})/i.exec(brief);
  if (day) {
    const value = `${day[3]}-${day[2]}-${day[1]}`;
    if (Content.innerType().shape.date.shape.day.safeParse(value).success) result.day = { value, source: day[0] };
  }
  const venue = /(?:Место|Локация|Venue|Location)\s*:\s*([^\n]+)/i.exec(brief);
  if (venue && venue[1].trim().length <= 200) result.venue = { value: venue[1].trim(), source: venue[0] };
  const closing = /(?:Заключение|Closing)\s*:\s*([^\n]+)/i.exec(brief);
  if (closing && closing[1].trim().length <= 1000) result.closing = { value: closing[1].trim(), source: closing[0] };
  for (const [key, label, max] of [["venueAddress", "Адрес|Address", 1000], ["venueNote", "Как добраться|Примечание к локации", 1000], ["venueMapUrl", "Карта|Ссылка на карту|Map", 2048]] as const) {
    const match = new RegExp(`(?:^|\\n)\\s*(?:${label})\\s*:\\s*([^\\n]+)`, "i").exec(brief);
    if (match && match[1].trim().length <= max && (key !== "venueMapUrl" || /^https?:\/\//i.test(match[1].trim()))) result[key] = { value: match[1].trim(), source: match[0] };
  }
  const labels = "Дата|Место|Локация|Адрес|Карта|Ссылка на карту|Дресс[ -]?код|Цвета|Программа|Пожелания|Описание|Обращение|Заключение|Как добраться|Greeting|Wishes|Closing|Venue|Address|Date|Map";
  for (const [key, label] of [["greeting", "Описание|Обращение|Текст приглашения|Greeting"], ["wishes", "Пожелания|Wishes"]] as const) {
    const match = new RegExp(`(?:^|\\n)\\s*(?:${label})\\s*:[ \\t]*([\\s\\S]*?)(?=\\n\\s*(?:\\d+[.)][ \\t]*)?(?:${labels})\\s*:|$)`, "i").exec(brief);
    if (match && match[1].trim() && match[1].trim().length <= 10000 && !/шрифт|дизайн|в[её]рстк|типограф|макет|анимац|\bhtml\b|\bcss\b/i.test(match[1])) result[key] = { value: match[1].trim(), source: match[0].slice(0, 1000) };
  }
  const dress = /Дресс[\s-]?код\s*:\s*(?:стиль\s+)?([^\n.]+)/i.exec(brief);
  const colors = /Цвета\s*:\s*([^\n.]+)/i.exec(brief);
  if (dress && dress[1].trim().length <= 200) result.dressCode = { value: { title: dress[1].trim(), note: colors ? `Цвета: ${colors[1].trim()}` : "" }, source: dress[0] + (colors && brief.includes(dress[0] + ". " + colors[0]) ? ". " + colors[0] : "") };
  return result;
}

// Only facts explicitly quoted from the brief can fill empty fields. References
// are visual context: names, age and dates printed in them are never imported.
export function applyBriefFacts(content: EventContent, facts?: BriefFacts): EventContent {
  const literal = literalBriefFacts(content.brief);
  facts = { ...literal, ...facts };
  for (const key of Object.keys(literal) as (keyof BriefFacts)[]) {
    if (literal[key]) Object.assign(facts, { [key]: literal[key] });
  }
  const next = structuredClone(content);
  const supplied = <T>(item: { value: T; source: string } | null | undefined) => item && content.brief?.includes(item.source) ? item.value : undefined;
  const hosts = supplied(facts.hosts);
  if (hosts && content.hosts.every((host) => !host.name.trim())) next.hosts = hosts.map((name) => ({ name }));
  const headline = supplied(facts.headline);
  if (headline && !content.headline?.trim()) next.headline = headline;
  const eventType = supplied(facts.eventType);
  if (eventType && content.hosts.every((host) => !host.name.trim()) && !content.date.start) next.eventType = eventType;
  const day = supplied(facts.day);
  if (day && !content.date.start && !content.date.day) next.date.day = day;
  const venue = supplied(facts.venue);
  if (venue && !content.venue.name.trim()) next.venue.name = venue;
  const address = supplied(facts.venueAddress);
  if (address && !content.venue.address.trim()) next.venue.address = address;
  const note = supplied(facts.venueNote);
  if (note && !content.venue.note?.trim()) next.venue.note = note;
  const map = supplied(facts.venueMapUrl);
  if (map && !content.venue.mapUrl) next.venue.mapUrl = map;
  const greeting = supplied(facts.greeting);
  if (greeting && !content.greeting?.trim()) next.greeting = greeting;
  const wishes = supplied(facts.wishes);
  if (wishes && !content.wishes?.trim()) next.wishes = wishes;
  const timeline = supplied(facts.timeline);
  if (timeline && !content.timeline.length) next.timeline = timeline;
  const closing = supplied(facts.closing);
  if (closing && !content.closing?.trim()) next.closing = closing;
  const dress = supplied(facts.dressCode);
  if (dress && !content.dressCode) next.dressCode = { ...dress, swatches: [] };
  if (next.dressCode && !next.dressCode.swatches.length) {
    const colors = /Цвета\s*:\s*([^\n.]+)/i.exec(content.brief ?? "")?.[1].toLowerCase() ?? "";
    next.dressCode.swatches = [[/золот|gold/, "#C8A84B"], [/сереб|silver/, "#B0B8C1"], [/ч[её]рн|black/, "#0A0A0D"]].flatMap(([pattern, color]) => (pattern as RegExp).test(colors) ? [color as string] : []);
  }
  return Content.parse(next);
}
