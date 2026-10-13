import { Content, type Content as EventContent } from "@/lib/schema/content";

// The canvas can only edit user-facing copy, never project ids, media or settings.
export function editCanvasText(content: EventContent, field: string, text: string): EventContent | null {
  if (text.length > 10000) return null;
  let next: EventContent;
  const host = /^hosts\.(\d+)\.name$/.exec(field);
  const venue = /^venue\.(name|address|note)$/.exec(field);
  const dress = /^dressCode\.(title|note)$/.exec(field);
  if (host && content.hosts[Number(host[1])] && text.length <= 100) {
    next = { ...content, hosts: content.hosts.map((item, index) => index === Number(host[1]) ? { ...item, name: text } : item) };
  } else if (venue) {
    next = { ...content, venue: { ...content.venue, [venue[1]]: text } };
  } else if (dress && content.dressCode && text.length <= (dress[1] === "title" ? 200 : 1000)) {
    next = { ...content, dressCode: { ...content.dressCode, [dress[1]]: text } };
  } else if (field === "headline" || field === "greeting" || field === "wishes" || field === "closing") {
    next = { ...content, [field]: text || undefined };
  } else return null;
  const parsed = Content.safeParse(next);
  return parsed.success ? parsed.data : null;
}

export function canvasContent(content: EventContent): EventContent {
  return { ...content, hosts: content.hosts.map((host, index) => ({ ...host, name: host.name.trim() || `Имя ${index + 1}` })) };
}
