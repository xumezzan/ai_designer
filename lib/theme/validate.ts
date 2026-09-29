/**
 * Theme validation and auto-repair (SPEC §8.1).
 *
 * `validateTheme` is a pure check: zod parse (unknown registry keys are
 * rejected), preset existence, WCAG contrast thresholds, locale font support.
 * `repairTheme` applies the §8.1 clamps on an untrusted object and logs every
 * adjustment. The generation pipeline (M4) repairs first, then validates.
 */
import { Theme, type Theme as ThemeType } from "../schema/theme";
import { getTypeSet, typeSetSupportsLocale } from "../../registry/typesets";
import { getMaterialSet } from "../../registry/materials";
import {
  LAYOUT_IDS,
  MATERIAL_SET_IDS,
  MOTION_IDS,
  ORNAMENT_PACK_IDS,
  TYPE_SET_IDS,
  type LayoutId,
  type MotionId,
  type OrnamentPackId,
} from "../../registry/keys";

export const MIN_CONTRAST_TEXT = 4.5;
export const MIN_CONTRAST_MUTED = 3;

export type Locale = "ru" | "uz-latn" | "en";

// ---------------------------------------------------------------------------
// Colour maths — WCAG 2.x relative luminance

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const n = parseInt(m[1] as string, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channelLuminance(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// HSL helpers — lightness shifting for auto-repair

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = parseHex(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return `#${((v << 16) | (v << 8) | v).toString(16).padStart(6, "0").toUpperCase()}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase()}`;
}

/**
 * Shift the foreground's lightness away from the background until the pair
 * reaches `min`, never to pure black or white (§6.2).
 */
export function ensureContrast(
  fg: string,
  bg: string,
  min: number,
): { hex: string; ratio: number; changed: boolean } {
  const startRatio = contrastRatio(fg, bg);
  if (startRatio >= min) return { hex: fg, ratio: startRatio, changed: false };
  const fgHsl = hexToHsl(fg);
  const bgL = hexToHsl(bg).l;
  const lighten = fgHsl.l > bgL; // move away from the background
  let best = fg;
  let bestRatio = startRatio;
  for (let step = 1; step <= 50; step++) {
    const target = fgHsl.l + (lighten ? 1 : -1) * step * 0.02;
    const l = Math.min(0.98, Math.max(0.02, target));
    const candidate = hslToHex(fgHsl.h, fgHsl.s, l);
    const ratio = contrastRatio(candidate, bg);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= min) return { hex: candidate, ratio, changed: true };
  }
  return { hex: best, ratio: bestRatio, changed: best !== fg };
}

// ---------------------------------------------------------------------------
// Auto-repair (§8.1) — operates on raw, untrusted input

export interface RepairContext {
  /** False forces hero away from 'full-photo' (§8.1). */
  hasHighQualityAsset?: boolean;
}

export interface RepairResult {
  value: unknown;
  adjustments: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function repairTheme(raw: unknown, context?: RepairContext): RepairResult {
  const adjustments: string[] = [];
  if (!isRecord(raw)) return { value: raw, adjustments };
  const theme = structuredClone(raw);

  const palette = theme["palette"];
  if (isRecord(palette)) {
    const pairs: Array<[keyof typeof palette & string, string, number]> = [
      ["ink", "bg", MIN_CONTRAST_TEXT],
      ["ink", "surface", MIN_CONTRAST_TEXT],
      ["muted", "bg", MIN_CONTRAST_MUTED],
    ];
    for (const [fgKey, bgKey, min] of pairs) {
      const fg = palette[fgKey];
      const bg = palette[bgKey];
      if (typeof fg !== "string" || typeof bg !== "string") continue;
      const fixed = ensureContrast(fg, bg, min);
      if (fixed.changed) {
        palette[fgKey] = fixed.hex;
        adjustments.push(
          `contrast: ${fgKey} ${fg} → ${fixed.hex} on ${bgKey} (${contrastRatio(fg, bg).toFixed(2)}:1 → ${fixed.ratio.toFixed(2)}:1)`,
        );
      }
    }
  }

  const layout = theme["layout"];
  if (isRecord(layout)) {
    if (
      layout["hero"] === "full-photo" &&
      context?.hasHighQualityAsset === false
    ) {
      layout["hero"] = "typographic";
      adjustments.push("hero: 'full-photo' → 'typographic' (no quality:'high' asset in the plan)");
    }
  }

  const ornament = theme["ornament"];
  if (isRecord(ornament) && Array.isArray(ornament["placement"])) {
    const placement = ornament["placement"];
    if (placement.length > 2) {
      ornament["placement"] = placement.slice(0, 2);
      adjustments.push(`ornament.placement truncated to 2 entries (${placement.join(", ")})`);
    }
  }

  // Glass above a light background is unreadable; darken the background.
  if (theme["materialSet"] === "glass" && isRecord(palette)) {
    const bg = palette["bg"];
    if (typeof bg === "string") {
      const hsl = hexToHsl(bg);
      if (hsl.l > 0.6) {
        palette["bg"] = hslToHex(hsl.h, hsl.s, 0.58);
        adjustments.push(`palette.bg ${bg} → ${palette["bg"]} (glass needs bg lightness ≤ 0.6)`);
      }
    }
  }

  return { value: theme, adjustments };
}

// ---------------------------------------------------------------------------
// Validation — pure, no mutation

export interface ValidateOptions {
  locale?: Locale;
}

export type ValidationResult =
  | { ok: true; theme: ThemeType; adjustments: string[]; warnings: string[] }
  | { ok: false; errors: string[]; adjustments: string[] };

function checkKeys(value: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const members: Array<[string, unknown, readonly string[]]> = [
    ["typeSet", value["typeSet"], TYPE_SET_IDS],
    ["materialSet", value["materialSet"], MATERIAL_SET_IDS],
  ];
  for (const [label, key, ids] of members) {
    if (typeof key === "string" && !ids.includes(key)) {
      errors.push(`unknown ${label} key "${key}"`);
    }
  }
  // Layout / motion / ornament keys are schema-validated; preset existence for
  // them is enforced as those registries land (M1+).
  const layout = value["layout"];
  if (isRecord(layout) && typeof layout["preset"] === "string" && !LAYOUT_IDS.includes(layout["preset"] as LayoutId)) {
    errors.push(`unknown layout key "${layout["preset"]}"`);
  }
  const motion = value["motion"];
  if (isRecord(motion) && typeof motion["preset"] === "string" && !MOTION_IDS.includes(motion["preset"] as MotionId)) {
    errors.push(`unknown motion key "${motion["preset"]}"`);
  }
  const ornament = value["ornament"];
  if (isRecord(ornament) && typeof ornament["pack"] === "string" && !ORNAMENT_PACK_IDS.includes(ornament["pack"] as OrnamentPackId)) {
    errors.push(`unknown ornament pack key "${ornament["pack"]}"`);
  }
  return errors;
}

export function validateTheme(raw: unknown, options?: ValidateOptions): ValidationResult {
  // Pure check: no repair. The generation pipeline repairs first (repairAndValidate).
  const adjustments: string[] = [];
  const parsed = Theme.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      adjustments,
    };
  }
  const theme = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  errors.push(...checkKeys(theme as unknown as Record<string, unknown>));

  // Preset existence: a key is only real once its registry module provides it.
  const typeSet = getTypeSet(theme.typeSet);
  if (!typeSet) errors.push(`type set "${theme.typeSet}" has no registered preset`);
  if (!getMaterialSet(theme.materialSet)) {
    errors.push(`material set "${theme.materialSet}" has no registered preset`);
  }

  // Contrast thresholds (§8.1).
  const pairs: Array<[string, string, string, number]> = [
    ["ink", theme.palette.ink, "bg", MIN_CONTRAST_TEXT],
    ["ink", theme.palette.ink, "surface", MIN_CONTRAST_TEXT],
    ["muted", theme.palette.muted, "bg", MIN_CONTRAST_MUTED],
  ];
  for (const [fgKey, fg, bgKey, min] of pairs) {
    const ratio = contrastRatio(fg, bgKey === "bg" ? theme.palette.bg : theme.palette.surface);
    if (ratio < min) {
      errors.push(`contrast: ${fgKey} on ${bgKey} is ${ratio.toFixed(2)}:1, minimum ${min}:1`);
    }
  }

  if (options?.locale && typeSet) {
    if (!typeSetSupportsLocale(typeSet, options.locale)) {
      errors.push(`type set "${typeSet.id}" does not support locale "${options.locale}"`);
    }
  }

  if (errors.length > 0) return { ok: false, errors, adjustments };
  return { ok: true, theme, adjustments, warnings };
}

/** Generation pipeline helper (M4): §8.1 clamps first, then a pure check. */
export function repairAndValidate(
  raw: unknown,
  context?: RepairContext,
  options?: ValidateOptions,
): ValidationResult {
  const { value, adjustments } = repairTheme(raw, context);
  const result = validateTheme(value, options);
  return { ...result, adjustments: [...adjustments, ...result.adjustments] };
}
