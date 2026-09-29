import { describe, expect, it } from "vitest";
import { toCssVars } from "./toCssVars";
import type { Theme } from "../schema/theme";
import { Theme as ThemeSchema } from "../schema/theme";

const theme = ThemeSchema.parse({
  meta: { name: "Test", mood: ["warm"], rationale: "Fixture." },
  palette: {
    bg: "#F2EDE4",
    surface: "#E9E1D3",
    ink: "#2C2620",
    muted: "#6E6255",
    accent: "#7A5C3E",
    accentAlt: "#4F6156",
  },
  typeSet: "ceremony",
  materialSet: "paper",
  foil: { enabled: true, color: "#B08A4A" },
  ornament: { pack: "none", density: "light", placement: ["divider"], color: "accent" },
  layout: {
    preset: "scroll-narrative",
    hero: "typographic",
    sectionOrder: ["hero", "greeting", "venue", "rsvp", "footer"],
  },
  motion: { preset: "still", ambient: "none" },
});

describe("toCssVars", () => {
  it("emits the palette as custom properties", () => {
    const vars = toCssVars(theme);
    expect(vars["--bg"]).toBe("#F2EDE4");
    expect(vars["--ink"]).toBe("#2C2620");
    expect(vars["--accent-alt"]).toBe("#4F6156");
  });

  it("resolves font stacks through the font registry", () => {
    const vars = toCssVars(theme);
    expect(vars["--font-display"]).toContain("Prata");
    expect(vars["--font-body"]).toContain("EB Garamond");
    expect(vars["--font-display"]).toContain("serif");
  });

  it("carries the whole type set — sizes, tracking, leading, measure", () => {
    const vars = toCssVars(theme);
    expect(vars["--fs-display"]).toContain("clamp(");
    expect(vars["--tr-display"]).toBe("-0.03em");
    expect(vars["--lh-body"]).toBe("1.6");
    expect(vars["--measure"]).toBe("62ch");
    expect(vars["--features-caps"]).toContain("smcp");
  });

  it("carries material vars and foil", () => {
    const vars = toCssVars(theme);
    expect(vars["--grain"]).toContain("data:image/svg+xml");
    expect(vars["--grain-fine"]).toContain("data:image/svg+xml");
    expect(vars["--grain-opacity"]).not.toBe(vars["--grain-fine-opacity"]);
    expect(vars["--foil-color"]).toBe("#B08A4A");
    expect(vars["--foil-sheen"]).not.toBe("none");
    expect(vars["--shadow-soft"]).toContain("color-mix");
  });

  it("kills the foil sheen when foil is disabled", () => {
    const noFoil: Theme = { ...theme, foil: { enabled: false, color: "#B08A4A" } };
    expect(toCssVars(noFoil)["--foil-sheen"]).toBe("none");
  });

  it("maps ornament colour onto palette tokens", () => {
    expect(toCssVars(theme)["--ornament-color"]).toBe("var(--accent)");
    const muted: Theme = { ...theme, ornament: { ...theme.ornament, color: "muted" } };
    expect(toCssVars(muted)["--ornament-color"]).toBe("var(--muted)");
  });

  it("emits only --custom-property keys", () => {
    for (const key of Object.keys(toCssVars(theme))) {
      expect(key.startsWith("--")).toBe(true);
    }
  });
});
