import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Reveal } from "./Reveal";

describe("Reveal without hydration", () => {
  it("renders readable content without enabling the hiding selector", () => {
    const html = renderToStaticMarkup(<Reveal><p>Дорогие друзья</p></Reveal>);
    expect(html).toContain("Дорогие друзья");
    expect(html).not.toContain("data-reveal-ready");
    const css = readFileSync(new URL("../../app/craft.css", import.meta.url), "utf8");
    const hiddenRules = css.match(/[^{}]+\{[^{}]*opacity:\s*0\s*;[^{}]*\}/g) ?? [];
    expect(hiddenRules.length).toBeGreaterThan(0);
    for (const rule of hiddenRules) expect(rule).toContain('[data-reveal-ready="true"]');
  });
});
