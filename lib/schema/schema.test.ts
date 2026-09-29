import { describe, expect, it } from "vitest";
import { Content } from "./content";
import { AssetPlan } from "./assetPlan";
import { Theme } from "./theme";

describe("Content schema", () => {
  const minimal = {
    slug: "demo",
    locale: "ru",
    eventType: "wedding",
    hosts: [{ name: "Зелихан" }],
    date: { start: "2026-06-20T16:00:00+05:00" },
    venue: { name: "Venue", address: "Address" },
  };

  it("applies the documented defaults", () => {
    const parsed = Content.parse(minimal);
    expect(parsed.date.timezone).toBe("Asia/Tashkent");
    expect(parsed.date.showCountdown).toBe(true);
    expect(parsed.timeline).toEqual([]);
    expect(parsed.media).toEqual([]);
    expect(parsed.refs).toEqual([]);
  });

  it("requires at least one host", () => {
    expect(Content.safeParse({ ...minimal, hosts: [] }).success).toBe(false);
  });

  it("accepts a fully populated record", () => {
    const parsed = Content.parse({
      ...minimal,
      headline: "Свадьба",
      greeting: "Дорогие друзья!",
      dressCode: { title: "Formal", swatches: ["#2C2620", "#7A5C3E"] },
      rsvp: { enabled: true, mode: "telegram", target: "@host" },
      timeline: [{ time: "16:00", title: "Сбор гостей" }],
    });
    expect(parsed.dressCode?.swatches).toHaveLength(2);
    expect(parsed.rsvp?.askGuestCount).toBe(true);
  });

  it("rejects non-hex dress code swatches", () => {
    const result = Content.safeParse({
      ...minimal,
      dressCode: { title: "Formal", swatches: ["red"] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid venue map url", () => {
    const result = Content.safeParse({
      ...minimal,
      venue: { name: "V", address: "A", mapUrl: "not-a-url" },
    });
    expect(result.success).toBe(false);
  });
});

describe("AssetPlan schema", () => {
  const asset = {
    id: "a1",
    role: "hero",
    subject: "couple",
    focal: [0.5, 0.35],
    safeArea: { x: 0.3, y: 0.2, w: 0.4, h: 0.4 },
    allowedRatios: ["3:4", "1:1"],
    treatment: "warm-film",
    quality: "high",
    maxViewportShare: 0.8,
    placement: { section: "hero", index: 0 },
  };

  it("accepts a well-formed plan and applies issue defaults", () => {
    const parsed = AssetPlan.parse({ assets: [asset], unifiedTreatment: "warm-film" });
    expect(parsed.assets[0]?.issues).toEqual([]);
  });

  it("accepts null placement", () => {
    const parsed = AssetPlan.parse({
      assets: [{ ...asset, placement: null }],
      unifiedTreatment: "none",
    });
    expect(parsed.assets[0]?.placement).toBeNull();
  });

  it("rejects an unknown section id in placement", () => {
    const result = AssetPlan.safeParse({
      assets: [{ ...asset, placement: { section: "sidebar", index: 0 } }],
      unifiedTreatment: "none",
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxViewportShare outside the clamp", () => {
    const result = AssetPlan.safeParse({
      assets: [{ ...asset, maxViewportShare: 0.05 }],
      unifiedTreatment: "none",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty allowedRatios list", () => {
    const result = AssetPlan.safeParse({
      assets: [{ ...asset, allowedRatios: [] }],
      unifiedTreatment: "none",
    });
    expect(result.success).toBe(false);
  });
});

describe("Theme schema", () => {
  const theme = {
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
      sectionOrder: ["hero", "footer"],
    },
    motion: { preset: "still", ambient: "none" },
  };

  it("accepts a valid theme", () => {
    expect(Theme.safeParse(theme).success).toBe(true);
  });

  it("rejects unknown registry keys (z.enum)", () => {
    expect(Theme.safeParse({ ...theme, typeSet: "swiss" }).success).toBe(false);
    expect(Theme.safeParse({ ...theme, materialSet: "chrome" }).success).toBe(false);
    expect(
      Theme.safeParse({ ...theme, ornament: { ...theme.ornament, pack: "baroque" } }).success,
    ).toBe(false);
  });

  it("caps mood at four entries and rationale at 400 characters", () => {
    expect(Theme.safeParse({ ...theme, meta: { ...theme.meta, mood: ["a", "b", "c", "d", "e"] } }).success).toBe(false);
    expect(Theme.safeParse({ ...theme, meta: { ...theme.meta, rationale: "x".repeat(401) } }).success).toBe(false);
  });

  it("caps ornament placement at two entries at the schema level", () => {
    expect(
      Theme.safeParse({
        ...theme,
        ornament: { ...theme.ornament, placement: ["divider", "corners", "hero-frame"] },
      }).success,
    ).toBe(false);
  });

  it("rejects malformed palette colours", () => {
    expect(
      Theme.safeParse({ ...theme, palette: { ...theme.palette, accent: "gold" } }).success,
    ).toBe(false);
  });
});
