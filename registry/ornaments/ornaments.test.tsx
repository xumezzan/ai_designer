import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ORNAMENT_PACK_IDS } from "../keys";
import { getOrnament } from "./index";
import { Theme } from "@/lib/schema/theme";
import { ThemePatch } from "@/lib/schema/versions";
import { Ornament } from "@/components/primitives/Ornament";
import { seriesTool } from "@/lib/ai/generateSeries";
import { refinementTool } from "@/lib/ai/refineTheme";

const legacy = JSON.parse(readFileSync("projects/demo/concepts/letter/v1.json", "utf8"));
const placements = ["divider", "corners", "hero-frame", "watermark"] as const;

describe("botanical engraving registry", () => {
  it("exposes the authored pack to theme validation and both AI contracts", () => {
    expect(ORNAMENT_PACK_IDS).toContain("botanical-engraving");
    const theme = Theme.parse({ ...legacy, ornament: { pack: "botanical-engraving", density: "light", placement: ["hero-frame"], color: "accent" } });
    expect(theme.ornament.pack).toBe("botanical-engraving");
    expect(ThemePatch.parse({ ornament: { pack: "botanical-engraving" } })).toEqual({ ornament: { pack: "botanical-engraving" } });
    expect(JSON.stringify(seriesTool([]).input_schema)).toContain('"botanical-engraving"');
    expect(JSON.stringify(refinementTool().input_schema)).toContain('"botanical-engraving"');
  });

  it.each(placements)("renders a decorative theme-colored %s plate with leaf veins and seeds", (placement) => {
    const theme = Theme.parse({ ...legacy, ornament: { pack: "botanical-engraving", density: "light", placement: [placement], color: "accent" } });
    const html = renderToStaticMarkup(<Ornament theme={theme} placement={placement} />);
    expect(html).toContain(`class="ornament ornament-${placement}"`);
    expect(html).toContain('data-pack="botanical-engraving"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain('class="engraving-hatch"');
    expect(html).toContain('class="engraving-seeds"');
    expect(html).not.toMatch(/<(?:image|script|text|foreignObject)\b|(?:href|onclick)=/i);
  });

  it("does not add a motif when its placement or pack is disabled", () => {
    const theme = Theme.parse({ ...legacy, ornament: { pack: "botanical-engraving", density: "light", placement: [], color: "accent" } });
    expect(renderToStaticMarkup(<Ornament theme={theme} placement="hero-frame" />)).toBe("");
    expect(renderToStaticMarkup(<Ornament theme={{ ...theme, ornament: { ...theme.ornament, pack: "none", placement: ["hero-frame"] } }} placement="hero-frame" />)).toBe("");
  });

  it("keeps every registered pack complete for every renderer placement", () => {
    for (const pack of ORNAMENT_PACK_IDS) expect(Object.keys(getOrnament(pack).elements).sort()).toEqual([...placements].sort());
  });
});
