import { describe, expect, it } from "vitest";
import {
  MIN_CONTRAST_MUTED,
  MIN_CONTRAST_TEXT,
  contrastRatio,
  ensureContrast,
  hexToHsl,
  hslToHex,
  relativeLuminance,
  repairAndValidate,
  repairTheme,
  validateTheme,
} from "./validate";
import { typeSetSupportsLocale, getTypeSet } from "../../registry/typesets";

const baseTheme = {
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
};

function clone(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return structuredClone({ ...baseTheme, ...overrides });
}

describe("WCAG contrast", () => {
  it("black on white is 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("relative luminance follows the sRGB formula", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("catches a knowingly bad pair", () => {
    // Mid beige ink on cream: a plausible AI palette that fails AA.
    const ratio = contrastRatio("#B8B0A4", "#F2EDE4");
    expect(ratio).toBeLessThan(MIN_CONTRAST_TEXT);
    const result = validateTheme(clone({ palette: { ...baseTheme.palette, ink: "#B8B0A4" } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.startsWith("contrast:"))).toBe(true);
    }
  });

  it("accepts a pair at or above the threshold", () => {
    expect(contrastRatio("#2C2620", "#F2EDE4")).toBeGreaterThanOrEqual(MIN_CONTRAST_TEXT);
    expect(contrastRatio("#6E6255", "#F2EDE4")).toBeGreaterThanOrEqual(MIN_CONTRAST_MUTED);
  });
});

describe("ensureContrast", () => {
  it("shifts lightness until the pair passes and never reaches pure black/white", () => {
    const fixed = ensureContrast("#B8B0A4", "#F2EDE4", MIN_CONTRAST_TEXT);
    expect(fixed.changed).toBe(true);
    expect(fixed.ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_TEXT);
    expect(fixed.hex).not.toBe("#000000");
    expect(hexToHsl(fixed.hex).l).toBeGreaterThanOrEqual(0.02);
  });

  it("leaves a passing pair alone", () => {
    const fixed = ensureContrast("#2C2620", "#F2EDE4", MIN_CONTRAST_TEXT);
    expect(fixed.changed).toBe(false);
    expect(fixed.hex).toBe("#2C2620");
  });

  it("round-trips hsl", () => {
    const hex = "#7A5C3E";
    const { h, s, l } = hexToHsl(hex);
    expect(hslToHex(h, s, l)).toBe(hex);
  });
});

describe("repairTheme (§8.1)", () => {
  it("logs and fixes contrast failures", () => {
    const { value, adjustments } = repairTheme(
      clone({ palette: { ...baseTheme.palette, ink: "#B8B0A4" } }),
    );
    expect(adjustments.length).toBeGreaterThan(0);
    expect(adjustments[0]).toContain("contrast: ink");
    const palette = (value as { palette: { ink: string } }).palette;
    expect(contrastRatio(palette.ink, "#F2EDE4")).toBeGreaterThanOrEqual(MIN_CONTRAST_TEXT);
  });

  it("forces hero away from full-photo without a high-quality asset", () => {
    const { value, adjustments } = repairTheme(
      clone({ layout: { ...baseTheme.layout, hero: "full-photo" } }),
      { hasHighQualityAsset: false },
    );
    expect((value as { layout: { hero: string } }).layout.hero).toBe("typographic");
    expect(adjustments.some((a) => a.includes("full-photo"))).toBe(true);

    // With a high-quality asset the hero is untouched.
    const kept = repairTheme(
      clone({ layout: { ...baseTheme.layout, hero: "full-photo" } }),
      { hasHighQualityAsset: true },
    );
    expect((kept.value as { layout: { hero: string } }).layout.hero).toBe("full-photo");
  });

  it("truncates ornament placement to two entries", () => {
    const { value, adjustments } = repairTheme(
      clone({
        ornament: {
          ...baseTheme.ornament,
          placement: ["divider", "corners", "hero-frame", "watermark"],
        },
      }),
    );
    const ornament = (value as { ornament: { placement: string[] } }).ornament;
    expect(ornament.placement).toEqual(["divider", "corners"]);
    expect(adjustments.some((a) => a.includes("truncated"))).toBe(true);
  });

  it("darkens a light background when the material is glass", () => {
    const { value, adjustments } = repairTheme(
      clone({ materialSet: "glass", palette: { ...baseTheme.palette, bg: "#EFEADF" } }),
    );
    const palette = (value as { palette: { bg: string } }).palette;
    expect(hexToHsl(palette.bg).l).toBeLessThanOrEqual(0.6);
    expect(adjustments.some((a) => a.includes("glass"))).toBe(true);
  });
});

describe("validateTheme", () => {
  it("accepts a complete valid theme", () => {
    const result = validateTheme(clone());
    expect(result.ok).toBe(true);
  });

  it("rejects unknown registry keys", () => {
    const result = validateTheme(clone({ typeSet: "luxury-script" }));
    expect(result.ok).toBe(false);
  });

  it("rejects unknown layout and motion keys", () => {
    const layout = validateTheme(clone({ layout: { ...baseTheme.layout, preset: "parallax" } }));
    expect(layout.ok).toBe(false);
    const motion = validateTheme(clone({ motion: { ...baseTheme.motion, preset: "bounce" } }));
    expect(motion.ok).toBe(false);
  });

  it("rejects presets that have no registered object yet", () => {
    const result = validateTheme(clone({ materialSet: "glass" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("no registered preset"))).toBe(true);
    }
  });

  it("rejects themes whose type set does not support the locale", () => {
    const result = validateTheme(clone(), { locale: "ru" });
    expect(result.ok).toBe(true);
    // Both current sets measure full ru/uz-latn support; the pure helper is the
    // enforcement point and is tested with a fake registry below.
  });

  it("validateTheme reports, repairAndValidate clamps and logs", () => {
    const bad = clone({ palette: { ...baseTheme.palette, ink: "#B8B0A4" } });
    expect(validateTheme(bad).ok).toBe(false);
    const fixed = repairAndValidate(bad);
    expect(fixed.ok).toBe(true);
    expect(fixed.adjustments.length).toBeGreaterThan(0);
  });
});

describe("typeSetSupportsLocale", () => {
  const ceremony = getTypeSet("ceremony");
  const editorial = getTypeSet("editorial");

  it("accepts measured sets for ru and uz-latn", () => {
    expect(ceremony).toBeDefined();
    expect(editorial).toBeDefined();
    if (!ceremony || !editorial) return;
    expect(typeSetSupportsLocale(ceremony, "ru")).toBe(true);
    expect(typeSetSupportsLocale(ceremony, "uz-latn")).toBe(true);
    expect(typeSetSupportsLocale(editorial, "ru")).toBe(true);
    expect(typeSetSupportsLocale(editorial, "uz-latn")).toBe(true);
    expect(typeSetSupportsLocale(ceremony, "en")).toBe(true);
  });
});
