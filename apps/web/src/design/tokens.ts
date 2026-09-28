/**
 * Design tokens used by the site renderer.
 * Everything the AI can tune maps onto one of these scales;
 * the renderer never uses ad‑hoc values.
 */
import type {
  PaddingY,
  RadiusScale,
  SizeToken,
  SpacingScale,
  Theme,
  TypeScale,
} from "./schema";

export const FONT_LIBRARY = {
  serif: [
    "Cormorant Garamond",
    "Playfair Display",
    "Fraunces",
    "Libre Caslon Text",
    "Newsreader",
    "Instrument Serif",
    "Bodoni Moda",
    "DM Serif Display",
    "EB Garamond",
  ],
  sans: [
    "Inter",
    "DM Sans",
    "Manrope",
    "Work Sans",
    "Space Grotesk",
    "Karla",
    "Jost",
    "Figtree",
    "Outfit",
  ],
} as const;

export const ALL_FONTS = [...FONT_LIBRARY.serif, ...FONT_LIBRARY.sans];

export function googleFontsHref(fonts: string[]) {
  const unique = Array.from(new Set(fonts.filter(Boolean)));
  const families = unique
    .map(
      (f) =>
        `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500`
    )
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Vertical rhythm per spacing scale (rem). */
export const SPACING: Record<SpacingScale, Record<PaddingY, number>> = {
  compact: { sm: 2.5, md: 4, lg: 5.5, xl: 7 },
  comfortable: { sm: 3.5, md: 5.5, lg: 7.5, xl: 10 },
  airy: { sm: 4.5, md: 7, lg: 10, xl: 13 },
};

export const RADIUS: Record<RadiusScale, string> = {
  none: "0px",
  sm: "4px",
  md: "10px",
  lg: "20px",
};

/** Heading clamp() sizes per type scale and heading size token. */
export const HEADING_SIZE: Record<TypeScale, Record<SizeToken, string>> = {
  compact: {
    sm: "clamp(1.25rem, 2vw, 1.5rem)",
    md: "clamp(1.6rem, 3vw, 2.25rem)",
    lg: "clamp(2.2rem, 4.5vw, 3.5rem)",
    xl: "clamp(2.8rem, 6.5vw, 5rem)",
  },
  regular: {
    sm: "clamp(1.35rem, 2.2vw, 1.75rem)",
    md: "clamp(1.8rem, 3.4vw, 2.75rem)",
    lg: "clamp(2.5rem, 5.5vw, 4.5rem)",
    xl: "clamp(3rem, 8vw, 6.5rem)",
  },
  display: {
    sm: "clamp(1.5rem, 2.5vw, 2rem)",
    md: "clamp(2rem, 4vw, 3.25rem)",
    lg: "clamp(2.8rem, 6.5vw, 5.5rem)",
    xl: "clamp(3.4rem, 10vw, 8.5rem)",
  },
};

export const BODY_SIZE: Record<TypeScale, string> = {
  compact: "0.95rem",
  regular: "1.0625rem",
  display: "1.125rem",
};

export const TRACKING = {
  tight: "-0.02em",
  normal: "0em",
  wide: "0.06em",
} as const;

/** Filters applied to photographs to keep imagery consistent. */
export const IMAGE_FILTER: Record<Theme["imageTreatment"], string> = {
  natural: "none",
  film: "contrast(0.94) saturate(0.85) sepia(0.08)",
  muted: "saturate(0.7) contrast(0.96)",
  mono: "grayscale(1) contrast(1.02)",
  warm: "sepia(0.18) saturate(0.95)",
};

export const SIZE_ORDER: SizeToken[] = ["sm", "md", "lg", "xl"];
export const PADDING_ORDER: PaddingY[] = ["sm", "md", "lg", "xl"];
export const SPACING_ORDER: SpacingScale[] = ["compact", "comfortable", "airy"];

export function step<T>(order: readonly T[], current: T, delta: number): T {
  const i = Math.max(0, order.indexOf(current));
  return order[Math.min(order.length - 1, Math.max(0, i + delta))];
}

/* ------------------------------------------------------------------ */
/* Colour helpers                                                       */
/* ------------------------------------------------------------------ */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]) {
  return (
    "#" +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDark(hex: string) {
  return luminance(hex) < 0.35;
}

export function mix(a: string, b: string, t: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

export function shiftWarmth(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + amount * 6, g + amount * 2, b - amount * 6]);
}
