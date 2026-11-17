import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItalicAccents, splitItalicAccents } from "./ItalicAccents";

describe("safe editorial italic accents", () => {
  it("matches Cyrillic conjunctions as complete words and preserves typographic spacing", () => {
    const text = "Иван и\u00a0Анна приглашают вас. И вместе — навсегда.";
    const parts = splitItalicAccents(text, ["и", "вместе", "приглашают"]);
    expect(parts.filter((part) => part.accented).map((part) => part.text)).toEqual(["и", "приглашают", "И", "вместе"]);
    expect(parts.map((part) => part.text).join("")).toBe(text);
  });

  it("does not split apostrophes, compound words, numbers or Unicode letters", () => {
    const text = "oʻzbek maʼno и-то да-и и2 иван Иван и";
    const parts = splitItalicAccents(text, ["и", "o", "no", "ma"]);
    expect(parts.filter((part) => part.accented).map((part) => part.text)).toEqual(["и"]);
  });

  it("compares normalized Unicode while retaining the original text", () => {
    const text = "cafe\u0301 и\u0301 &";
    const parts = splitItalicAccents(text, ["café", "и", "&"]);
    expect(parts.filter((part) => part.accented).map((part) => part.text)).toEqual(["cafe\u0301", "&"]);
    expect(parts.map((part) => part.text).join("")).toBe(text);
  });

  it("renders HTML-like input as escaped text without altering field boundaries", () => {
    const html = renderToStaticMarkup(<p data-studio-field="greeting"><ItalicAccents text={'<img src=x onerror="alert(1)"> и друзья'} words={["и"]} /></p>);
    expect(html).toContain('data-studio-field="greeting"');
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain('<em class="editorial-italic-accent">и</em>');
  });

  it("leaves existing invitations identical when no accent words are supplied", () => {
    const text = "Анна и Иван";
    expect(renderToStaticMarkup(<ItalicAccents text={text} />)).toBe(text);
    expect(renderToStaticMarkup(<ItalicAccents text={text} words={[]} />)).toBe(text);
  });
});
