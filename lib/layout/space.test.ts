/**
 * The spacing scale is derived, not hand-tuned per variant, so the invariants
 * are what the tests check: it follows the type set, it stays asymmetric, and
 * the hero stays two-thirds empty.
 */
import { describe, expect, it } from "vitest";
import { getTypeSet } from "../../registry/typesets";
import {
  HERO_EMPTY,
  MIN_BLOCK_TO_INSIDE,
  maxRem,
  spaceScale,
  spaceVars,
} from "./space";
import type { TypeSet } from "../../registry/typesets";

function typeSet(id: "ceremony" | "editorial"): TypeSet {
  const set = getTypeSet(id);
  if (!set) throw new Error(`Type set ${id} is not registered`);
  return set;
}

describe("maxRem", () => {
  it("reads the upper bound of a clamp()", () => {
    expect(maxRem("clamp(3.25rem, 1.5rem + 7vw, 5.5rem)")).toBe(5.5);
  });

  it("reads a plain rem length", () => {
    expect(maxRem("1.0625rem")).toBe(1.0625);
  });

  it("converts px at 16px per rem", () => {
    expect(maxRem("24px")).toBe(1.5);
  });

  it("refuses a length it cannot read rather than guessing", () => {
    expect(() => maxRem("min(2rem, 5vw)")).toThrow(/Cannot read a rem value/);
  });
});

describe("spaceScale", () => {
  it("takes the body line box as the atom", () => {
    const set = typeSet("ceremony");
    const scale = spaceScale(set);
    expect(scale.unit).toBeCloseTo(1.0625 * 1.6, 5);
  });

  it("keeps at least twice as much space between blocks as inside one", () => {
    for (const id of ["ceremony", "editorial"] as const) {
      const scale = spaceScale(typeSet(id));
      expect(scale.block).toBeGreaterThanOrEqual(scale.inside * MIN_BLOCK_TO_INSIDE);
    }
  });

  it("is not an even ladder — a section step is clearly larger than a block step", () => {
    for (const id of ["ceremony", "editorial"] as const) {
      const scale = spaceScale(typeSet(id));
      expect(scale.section).toBeGreaterThanOrEqual(scale.block * 1.5);
    }
  });

  it("follows the type set: a wider display/body ratio gets a wider block step", () => {
    const ceremony = spaceScale(typeSet("ceremony"));
    const editorial = spaceScale(typeSet("editorial"));
    expect(ceremony.block).not.toBe(editorial.block);
    expect(ceremony.block).toBeGreaterThan(editorial.block);
  });

  it("leaves the hero two-thirds empty, with the remainder for content", () => {
    const scale = spaceScale(typeSet("ceremony"));
    expect(scale.heroEmpty).toBe(HERO_EMPTY);
    expect(scale.heroEmpty).toBeGreaterThanOrEqual(60);
    expect(scale.heroEmpty + (100 - scale.heroEmpty)).toBe(100);
  });

  it("is stable — the same type set always yields the same numbers", () => {
    expect(spaceScale(typeSet("ceremony"))).toEqual(spaceScale(typeSet("ceremony")));
  });
});

describe("spaceVars", () => {
  const vars = spaceVars(spaceScale(typeSet("ceremony")));

  it("publishes every step as a custom property", () => {
    expect(Object.keys(vars).sort()).toEqual(
      [
        "--space-block",
        "--space-hero-content",
        "--space-hero-empty",
        "--space-inside",
        "--space-section",
        "--space-unit",
      ].sort(),
    );
  });

  it("writes steps in rem and the hero in svh", () => {
    expect(vars["--space-inside"]).toMatch(/^\d+(\.\d+)?rem$/);
    expect(vars["--space-hero-empty"]).toBe("66svh");
    expect(vars["--space-hero-content"]).toBe("34svh");
  });
});
