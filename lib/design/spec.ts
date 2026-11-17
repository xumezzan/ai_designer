import type { Theme } from "@/lib/schema/theme";
import { DesignSpec, DESIGN_ARCHETYPE_COMPONENTS, DESIGN_HEADING_FONTS, DESIGN_BODY_FONTS, DESIGN_MASK_TYPES, DESIGN_PAPER_TEXTURES, DESIGN_HERO_ALIGNMENTS, DESIGN_CARD_FRAMINGS, DESIGN_OVERLAY_BLENDS, DESIGN_SEAL_SYMBOLS, DESIGN_SEAL_POSITIONS, DESIGN_FOIL_LINE_STYLES, DESIGN_TIMELINE_STYLES, DESIGN_DRESSCODE_STYLES, DESIGN_RSVP_STYLES, DESIGN_GRAPHICS_PLACEMENTS, trackingTokenAmount } from "@/lib/schema/designSpec";
import { ensureContrast, hexToHsl, parseHex } from "@/lib/theme/validate";

const headingTracking = {
  "tracking-tighter": "-0.05em", "tracking-tight": "-0.025em", "tracking-normal": "0em",
  "tracking-wide": "0.025em", "tracking-wider": "0.05em", "tracking-widest": "0.1em",
} as const;
const metaTracking = {
  "tracking-tighter": "0.15em", "tracking-tight": "0.15em", "tracking-normal": "0.15em",
  "tracking-wide": "0.18em", "tracking-wider": "0.2em", "tracking-widest": "0.2em",
} as const;
function resolveTracking(token: string, role: "heading" | "meta") {
  const numeric = trackingTokenAmount(token);
  if (numeric !== undefined) return `${numeric}em`;
  const labels = role === "heading" ? headingTracking : metaTracking;
  return labels[token as keyof typeof labels];
}

export type PaperToneFamily = "linen" | "limestone" | "sage" | "terracotta" | "rose" | "slate" | "espresso" | "graphite";

/** Broad natural-tone buckets prevent imperceptible hex edits passing anti-repeat. */
export function paperToneFamily(hex: string): PaperToneFamily {
  const { h, s, l } = hexToHsl(hex);
  const degrees = h * 360;
  const { r, g, b } = parseHex(hex);
  if (l < .25) return s > .12 && (degrees < 75 || degrees > 340) ? "espresso" : "graphite";
  if (s < .12 || Math.max(r, g, b) - Math.min(r, g, b) < 16) {
    return r >= b + 5 && g >= b ? "linen" : "limestone";
  }
  if (degrees >= 65 && degrees < 165) return "sage";
  if (degrees >= 165 && degrees < 285) return "slate";
  if (degrees >= 285 || degrees < 12) return "rose";
  return l >= .75 ? "linen" : "terracotta";
}

/** This inventory is generated from supported IDs rather than a free-form promise. */
export function availableDesignComponents() {
  return {
    hero_components: Object.entries(DESIGN_ARCHETYPE_COMPONENTS).map(([archetype, id]) => ({ id, archetype })),
    heading_fonts: [...DESIGN_HEADING_FONTS], body_fonts: [...DESIGN_BODY_FONTS],
    media_masks: [...DESIGN_MASK_TYPES], paper_textures: [...DESIGN_PAPER_TEXTURES],
    hero_alignments: [...DESIGN_HERO_ALIGNMENTS], card_framings: [...DESIGN_CARD_FRAMINGS],
    overlay_blends: [...DESIGN_OVERLAY_BLENDS], wax_seal_symbols: [...DESIGN_SEAL_SYMBOLS],
    wax_seal_positions: [...DESIGN_SEAL_POSITIONS], foil_line_styles: [...DESIGN_FOIL_LINE_STYLES],
    timeline_styles: [...DESIGN_TIMELINE_STYLES], dresscode_styles: [...DESIGN_DRESSCODE_STYLES],
    rsvp_styles: [...DESIGN_RSVP_STYLES], graphics_placements: [...DESIGN_GRAPHICS_PLACEMENTS],
  };
}

/** Only visual decisions enter cross-project memory; names and image prompts do not. */
export function designSpecContext(spec: DesignSpec) {
  return {
    archetype: spec.archetype,
    mask_type: spec.composition_rules.photo_treatment.mask_type,
    paper_tone: paperToneFamily(spec.canvas.background_color),
    heading_font: spec.typography.heading_font,
    body_font: spec.typography.body_font,
    paper_texture: spec.canvas.paper_texture,
    hero_alignment: spec.composition_rules.hero_alignment,
    card_framing: spec.composition_rules.card_framing,
    graphics_placement: spec.graphics_generation.needed ? spec.graphics_generation.placement : null,
  };
}

/** Compile visual choices only; event facts, photo IDs and section order survive. */
export function compileDesignSpec(input: DesignSpec, baseTheme: Theme): Theme {
  const spec = DesignSpec.parse(input);
  // The exact saved specification must carry the same safe colours as the theme.
  const paper = spec.canvas.background_color;
  spec.canvas.text_color_primary = ensureContrast(spec.canvas.text_color_primary, paper, 4.5).hex;
  spec.canvas.text_color_muted = ensureContrast(spec.canvas.text_color_muted, paper, 4.5).hex;
  const seal = spec.composition_rules.decorations.wax_seal;
  const foil = spec.composition_rules.decorations.foil_lines;
  const framing = spec.composition_rules.card_framing;
  const borderStyle = ({ double_fine_border: "double-hairline", arch_portal: "frame-inset", raw_deckle_shadow: "none", floating_minimal: "none" } as const)[framing];
  const visualPlacement = ({ hero_background: "band", framed_illustration: "inset", floating_botanical: "side-right" } as const)[spec.graphics_generation.placement];
  return {
    ...baseTheme,
    designSpec: spec,
    meta: { ...baseTheme.meta, name: spec.design_title, rationale: spec.similarity_defense.slice(0, 400) },
    palette: { bg: paper, surface: paper, ink: spec.canvas.text_color_primary, muted: spec.canvas.text_color_muted, accent: spec.canvas.accent_color, accentAlt: seal.enabled ? seal.color : spec.canvas.accent_color },
    typeSet: "editorial", materialSet: "paper", artwork: "none",
    generatedVisual: spec.graphics_generation.needed ? baseTheme.generatedVisual : undefined,
    atmosphere: { grainIntensity: spec.canvas.noise_opacity, vignetteStrength: 0 },
    surface: { texture: spec.canvas.paper_texture === "smooth_vellum" ? "smooth" : "cotton-paper", borderStyle },
    // Foil belongs to the ruled decoration, never all the heading text.
    foil: { enabled: foil.enabled, color: spec.canvas.accent_color },
    finishing: { type: foil.enabled ? "gold-foil" : spec.component_manifest.rsvp_style === "letterpress_form" ? "blind-emboss" : "none", sheenAngle: 135 },
    typographyScale: { displayScale: "editorial", headlineTracking: resolveTracking(spec.typography.heading_tracking, "heading"), metaTracking: resolveTracking(spec.typography.meta_tracking, "meta") },
    ornament: { pack: "none", density: "light", placement: [], color: "accent" },
    layout: { ...baseTheme.layout, preset: "scroll-narrative", composition: spec.component_manifest.hero_layout_component, hero: "typographic", visualPlacement },
    motion: { ...baseTheme.motion, ambient: "none" },
  };
}

/** Exact faces/colour values for the editorial renderer, with bounded CSS tokens. */
export function designSpecToCssVars(input: DesignSpec): Record<string, string> {
  const spec = DesignSpec.parse(input);
  const headingFallback = spec.typography.heading_font === "Playfair Display" ? "Cormorant Garamond" : "Playfair Display";
  const bodyFallback = spec.typography.body_font === "Jost" ? "Montserrat" : "Jost";
  const heading = `"${spec.typography.heading_font}", "${headingFallback}", Georgia, serif`;
  const body = `"${spec.typography.body_font}", "${bodyFallback}", system-ui, sans-serif`;
  const tracking = resolveTracking(spec.typography.heading_tracking, "heading");
  const meta = resolveTracking(spec.typography.meta_tracking, "meta");
  return {
    "--bg": spec.canvas.background_color, "--surface": spec.canvas.background_color,
    "--ink": spec.canvas.text_color_primary, "--muted": spec.canvas.text_color_muted,
    "--accent": spec.canvas.accent_color, "--foil-color": spec.canvas.accent_color,
    "--font-display": heading, "--font-body": body, "--font-caps": body,
    "--editorial-font-display": heading,
    "--inv-tracking-headline": tracking, "--inv-tracking-meta": meta,
    "--tr-display": tracking, "--tr-display-sm": tracking, "--tr-small": meta, "--tr-caps": meta,
    "--inv-grain-opacity": String(spec.canvas.noise_opacity),
    // Editorial has one declared grain layer, not additive legacy material noise.
    "--grain-opacity": "0", "--grain-fine-opacity": "0",
    "--editorial-noise-opacity": String(spec.canvas.noise_opacity),
    "--editorial-seal-color": spec.composition_rules.decorations.wax_seal.color,
    "--editorial-overlay-tint": spec.composition_rules.photo_treatment.overlay_tint ?? "transparent",
    "--editorial-overlay-blend": spec.composition_rules.photo_treatment.overlay_blend === "soft_light" ? "soft-light" : spec.composition_rules.photo_treatment.overlay_blend === "multiply" ? "multiply" : "normal",
  };
}
