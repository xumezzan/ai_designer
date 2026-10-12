import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Theme, AmbientGlow } from "./theme";
import { ThemePatch } from "./versions";
import { toCssVars } from "@/lib/theme/toCssVars";
import { composeSeries, sharedStyleSignature } from "@/lib/generation/series";
import { fixtureSeries } from "@/lib/generation/fixture";
import { GeneratedVisual } from "@/components/primitives/GeneratedVisual";
import { TextReveal } from "@/components/craft/TextReveal";
import { seriesTool } from "@/lib/ai/generateSeries";
import { refinementTool } from "@/lib/ai/refineTheme";

const legacy = JSON.parse(readFileSync("projects/demo/concepts/letter/v1.json", "utf8"));

describe("physicality token contract", () => {
  it.each(["letter", "poster", "folio", "arch", "botanical"])("keeps the legacy %s theme valid and inherits its type set", (concept) => {
    const theme = Theme.parse(JSON.parse(readFileSync(`projects/demo/concepts/${concept}/v1.json`, "utf8")));
    expect(theme.atmosphere).toEqual({ grainIntensity: 0, vignetteStrength: 0 });
    expect(theme.surface).toEqual({ texture: "smooth", borderStyle: "none" });
    expect(theme.finishing).toEqual({ type: "none", sheenAngle: 135 });
    const vars = toCssVars(theme);
    expect(vars["--inv-display-scale"]).toBe("1");
    expect(vars["--inv-tracking-headline"]).toBe(vars["--tr-display"]);
  });

  it("validates and publishes explicit physicality, typography and light tokens", () => {
    const theme = Theme.parse({ ...legacy,
      atmosphere: { grainIntensity: .15, vignetteStrength: .8, ambientGlow: "radial-gradient(ellipse at 25% 10%, hsla(210, 30%, 70%, 0.08), transparent 65%)" },
      surface: { texture: "deep-velvet", borderStyle: "double-hairline" },
      finishing: { type: "silver-chrome", sheenAngle: 210 },
      typographyScale: { displayScale: "monumental", headlineTracking: "-0.03em", metaTracking: "0.2em" },
    });
    expect(toCssVars(theme)).toMatchObject({ "--inv-grain-opacity": "0.15", "--inv-vignette-strength": "0.8", "--inv-sheen-angle": "210deg", "--inv-tracking-headline": "-0.03em", "--inv-tracking-meta": "0.2em", "--inv-display-scale": "1.2" });
    expect(toCssVars(theme)["--inv-ambient-glow"]).toBe(theme.atmosphere.ambientGlow);
    expect(toCssVars(Theme.parse({ ...legacy, atmosphere: { ambientGlow: "hsl(210, 30%, 70%)" } }))["--inv-ambient-glow"]).toBe("linear-gradient(hsl(210, 30%, 70%), hsl(210, 30%, 70%))");
  });

  it.each([
    { atmosphere: { grainIntensity: -.01 } }, { atmosphere: { grainIntensity: .151 } },
    { atmosphere: { vignetteStrength: .81 } }, { atmosphere: { grainIntensity: Infinity } },
    { surface: { texture: "plastic" } }, { surface: { borderStyle: "ornate" } },
    { finishing: { type: "chrome" } }, { finishing: { sheenAngle: 361 } },
    { typographyScale: { headlineTracking: "2em" } }, { typographyScale: { metaTracking: "var(--unknown)" } },
    { typographyScale: { displayScale: "gigantic" } },
  ])("rejects out-of-contract tokens %j", (patch) => expect(Theme.safeParse({ ...legacy, ...patch }).success).toBe(false));

  it.each(["url(https://example.com/image)", "radial-gradient(url(x), transparent)", "rgba(0,0,0,.1); color:red", "linear-gradient(var(--x), #000000)", "hsl(20, 10%, 20%))", "radial-gradient(/*css*/#000000, transparent)"])("rejects CSS payload %s", (glow) => expect(AmbientGlow.safeParse(glow).success).toBe(false));

  it.each(["linear-gradient(135deg, hsla(210, 30%, 70%, .08), transparent)", "radial-gradient(ellipse at 20% 10%, hsl(210 30% 70% / .08), transparent 65%)"])("accepts CSS angle units and modern color syntax: %s", (glow) => expect(AmbientGlow.safeParse(glow).success).toBe(true));

  it("partial refinement never inserts physicality defaults", () => {
    expect(ThemePatch.parse({ finishing: { type: "silver-chrome" } })).toEqual({ finishing: { type: "silver-chrome" } });
    expect(ThemePatch.parse({ atmosphere: { grainIntensity: .04 }, typographyScale: { metaTracking: ".2em" } })).toEqual({ atmosphere: { grainIntensity: .04 }, typographyScale: { metaTracking: ".2em" } });
  });

  it("propagates one shared physicality style to every composition and its identity", () => {
    const raw = structuredClone(fixtureSeries);
    raw.style.surface = { texture: "raw-silk", borderStyle: "frame-inset" };
    raw.style.finishing = { type: "bronze-patina", sheenAngle: 135 };
    raw.style.atmosphere = { grainIntensity: .05, vignetteStrength: .2 };
    raw.style.typographyScale = { displayScale: "understated", metaTracking: ".2em" };
    const series = composeSeries(raw, "uz-latn", []);
    for (const theme of series.themes) {
      expect(theme.surface).toEqual(raw.style.surface);
      expect(theme.finishing).toEqual(raw.style.finishing);
      expect(theme.atmosphere).toEqual(raw.style.atmosphere);
      expect(theme.typographyScale).toEqual(raw.style.typographyScale);
    }
    const theme = series.themes[0];
    expect(sharedStyleSignature({ ...theme, surface: { ...theme.surface, texture: "smooth" } })).not.toBe(sharedStyleSignature(theme));
  });

  it("advertises tokens for generation and partial refinement without an image identity", () => {
    const generation = JSON.stringify(seriesTool([]).input_schema);
    const refinement = JSON.stringify(refinementTool().input_schema);
    for (const key of ["atmosphere", "surface", "finishing", "typographyScale", "grainIntensity", "headlineTracking"]) {
      expect(generation).toContain(`"${key}"`); expect(refinement).toContain(`"${key}"`);
    }
    expect(generation).not.toContain('"isolated"');
    expect(refinement).not.toContain('"generatedVisual"');
  });
});

describe("physicality rendering", () => {
  it("blends isolated accents by theme lightness while preserving old plates", () => {
    const theme = Theme.parse(legacy);
    const source = { src: "/art/test/decoration", width: 512, height: 512 };
    const dark = { ...theme.palette, bg: "#10131B" };
    const light = { ...theme.palette, bg: "#F3F1EC" };
    expect(renderToStaticMarkup(<GeneratedVisual source={source} palette={dark} isolated />)).toContain('data-blend="screen"');
    expect(renderToStaticMarkup(<GeneratedVisual source={source} palette={light} isolated />)).toContain('data-blend="multiply"');
    expect(renderToStaticMarkup(<GeneratedVisual source={source} palette={dark} />)).not.toContain("data-blend");
  });
  it("keeps Cyrillic and both Uzbek apostrophes readable before hydration", () => {
    const html = renderToStaticMarkup(<TextReveal><h1>Рустам · Gʻulom &amp; Maʼmura</h1></TextReveal>);
    expect(html).toContain("Рустам · Gʻulom &amp; Maʼmura");
    expect(html).not.toContain("transform:");
    expect(html).not.toContain("opacity:0");
  });
});
