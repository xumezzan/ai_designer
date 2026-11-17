import { typograph, type Locale } from "@/lib/typography/ru";

/**
 * Match editorial accents against complete Unicode words, preserving the
 * displayed copy byte for byte. This is deliberately plain React text: studio
 * field boundaries stay on their original elements and no markup is parsed.
 */
export function splitItalicAccents(text: string, words: readonly string[] = []): { text: string; accented: boolean }[] {
  const accents = new Set(words.map((word) => word.trim().normalize("NFC").toLowerCase()).filter(Boolean));
  if (!accents.size) return [{ text, accented: false }];

  // Apostrophes and compound hyphens belong to their word. In particular, an
  // Uzbek modifier apostrophe must never introduce a false word boundary.
  const tokens = /[\p{L}\p{M}\p{N}_]+(?:['’ʻʼ\-‐‑][\p{L}\p{M}\p{N}_]+)*|&/gu;
  const parts: { text: string; accented: boolean }[] = [];
  let offset = 0;
  for (const match of text.matchAll(tokens)) {
    if (!accents.has(match[0].normalize("NFC").toLowerCase())) continue;
    const start = match.index;
    if (start > offset) parts.push({ text: text.slice(offset, start), accented: false });
    parts.push({ text: match[0], accented: true });
    offset = start + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), accented: false });
  return parts.length ? parts : [{ text, accented: false }];
}

export function ItalicAccents({ text, words, locale }: { text: string; words?: readonly string[]; locale?: Locale }) {
  const matchingWords = locale ? words?.map((word) => typograph(word, locale)) : words;
  return <>{splitItalicAccents(text, matchingWords).map((part, index) => part.accented
    ? <em className="editorial-italic-accent" key={index}>{part.text}</em>
    : part.text)}</>;
}
