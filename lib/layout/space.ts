/**
 * The spacing scale (SPEC §7.1, "Space").
 *
 * Space is generous and asymmetric, and it derives from the type scale — a
 * body line box is the atom, the display/body ratio sets the multipliers. It is
 * deliberately not an 8/16/24/32 ladder: an even ladder is what makes a page
 * read as a form.
 *
 * Two rules the numbers must hold:
 *  - space between meaning-blocks is at least `MIN_BLOCK_TO_INSIDE`× the space
 *    inside a block; equal spacing flattens the hierarchy;
 *  - the hero is two-thirds empty by default.
 *
 * Theme-independent: a theme picks a type set, and the scale follows from it.
 * `theme.json` has no spacing field and must never gain one.
 */
import type { TypeSet } from "../../registry/typesets";

/** Space between meaning-blocks, in multiples of the space inside a block. */
export const MIN_BLOCK_TO_INSIDE = 2;
/** Share of the first screen the hero leaves empty. */
export const HERO_EMPTY = 66;

export interface SpaceScale {
  /** One body line box in rem — the atom of the scale. */
  unit: number;
  /** Space inside a meaning block (a heading to its paragraph). */
  inside: number;
  /** Space between meaning blocks. */
  block: number;
  /** Space between sections. */
  section: number;
  /** Empty share of the hero, in svh. The content gets the rest. */
  heroEmpty: number;
}

/**
 * The largest rem value of a CSS length: the third argument of `clamp()` when
 * there is one, otherwise the length itself. `px` is converted at 16px = 1rem.
 */
export function maxRem(length: string): number {
  const clampMatch = /^clamp\(([^()]*),([^()]*),([^()]*)\)$/.exec(length.trim());
  const candidate = (clampMatch ? (clampMatch[3] as string) : length).trim();

  const rem = /^(-?[\d.]+)rem$/.exec(candidate);
  if (rem) return Number(rem[1]);
  const px = /^(-?[\d.]+)px$/.exec(candidate);
  if (px) return Number(px[1]) / 16;
  const unitless = /^(-?[\d.]+)$/.exec(candidate);
  if (unitless) return Number(unitless[1]);

  throw new Error(`Cannot read a rem value out of "${length}"`);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Derive the spacing scale from a type set. The larger the display/body gap,
 * the wider the block and section steps — a set that shouts gets more air.
 */
export function spaceScale(typeSet: TypeSet): SpaceScale {
  const body = maxRem(typeSet.levels.body.size);
  const display = maxRem(typeSet.levels.display.size);
  const unit = body * typeSet.levels.body.leading;
  const ratio = display / body;

  const inside = round(unit * 0.5);
  const block = round(unit * clamp(ratio / 3, 1.2, 1.6));
  const section = round(block * clamp(ratio / 3, 1.6, 2.2));

  return { unit: round(unit), inside, block, section, heroEmpty: HERO_EMPTY };
}

/** The scale as CSS custom properties for the invitation root. */
export function spaceVars(scale: SpaceScale): Record<string, string> {
  return {
    "--space-unit": `${scale.unit}rem`,
    "--space-inside": `${scale.inside}rem`,
    "--space-block": `${scale.block}rem`,
    "--space-section": `${scale.section}rem`,
    "--space-hero-empty": `${scale.heroEmpty}svh`,
    "--space-hero-content": `${100 - scale.heroEmpty}svh`,
  };
}
