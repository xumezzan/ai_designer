/**
 * Theme → CSS custom properties (SPEC §7). Components read these variables and
 * nothing else. Font stacks resolve through registry/fonts.ts `stackFor`;
 * type-set craft values and material vars come from their registries.
 */
import type { Theme } from "../schema/theme";
import { getTypeSet, typeSetStackFor, type TypeSetLevel } from "../../registry/typesets";
import { getMaterialSet } from "../../registry/materials";
import { getArtwork } from "../../registry/artwork";
import { stackFor } from "../../registry/fonts";
import { spaceScale, spaceVars } from "../layout/space";

const ORNAMENT_COLOR_VAR = {
  accent: "--accent",
  accentAlt: "--accent-alt",
  muted: "--muted",
} as const;

function levelVar(level: TypeSetLevel): string {
  return level === "displaySm" ? "display-sm" : level;
}

export function toCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {
    "--bg": theme.palette.bg,
    "--surface": theme.palette.surface,
    "--ink": theme.palette.ink,
    "--muted": theme.palette.muted,
    "--accent": theme.palette.accent,
    "--accent-alt": theme.palette.accentAlt,
  };

  const typeSet = getTypeSet(theme.typeSet);
  if (!typeSet) {
    throw new Error(`Type set "${theme.typeSet}" is not registered`);
  }
  vars["--font-display"] = stackFor(typeSet.display);
  vars["--font-body"] = typeSetStackFor(typeSet, "body");
  vars["--font-caps"] = stackFor(typeSet.levels.caps.role === "display" ? typeSet.display : typeSet.body);
  for (const level of Object.keys(typeSet.levels) as TypeSetLevel[]) {
    const spec = typeSet.levels[level];
    const name = levelVar(level);
    vars[`--fs-${name}`] = spec.size;
    vars[`--lh-${name}`] = String(spec.leading);
    vars[`--tr-${name}`] = spec.tracking;
    vars[`--fw-${name}`] = String(spec.weight);
    if (spec.features) vars[`--features-${name}`] = spec.features;
  }
  vars["--measure"] = `${typeSet.measure}ch`;
  Object.assign(vars, spaceVars(spaceScale(typeSet)));

  const material = getMaterialSet(theme.materialSet);
  if (!material) {
    throw new Error(`Material set "${theme.materialSet}" is not registered`);
  }
  Object.assign(vars, material.vars);
  Object.assign(vars, getArtwork(theme.artwork)?.vars);

  vars["--foil-color"] = theme.foil.color;
  vars["--inv-grain-opacity"] = String(theme.atmosphere.grainIntensity);
  vars["--inv-ambient-glow"] = theme.atmosphere.ambientGlow
    ? /^(?:radial|linear)-gradient\(/i.test(theme.atmosphere.ambientGlow)
      ? theme.atmosphere.ambientGlow
      : `linear-gradient(${theme.atmosphere.ambientGlow}, ${theme.atmosphere.ambientGlow})`
    : "linear-gradient(transparent, transparent)";
  vars["--inv-vignette-strength"] = String(theme.atmosphere.vignetteStrength);
  vars["--inv-sheen-angle"] = `${theme.finishing.sheenAngle}deg`;
  vars["--inv-tracking-headline"] = theme.typographyScale.headlineTracking ?? typeSet.levels.display.tracking;
  vars["--inv-tracking-meta"] = theme.typographyScale.metaTracking ?? ".12em";
  vars["--inv-display-scale"] = { monumental: "1.2", editorial: "1", understated: ".82" }[theme.typographyScale.displayScale];
  if (theme.typographyScale.headlineTracking) {
    vars["--tr-display"] = theme.typographyScale.headlineTracking;
    vars["--tr-display-sm"] = theme.typographyScale.headlineTracking;
  }
  if (theme.typographyScale.metaTracking) {
    vars["--tr-small"] = theme.typographyScale.metaTracking;
    vars["--tr-caps"] = theme.typographyScale.metaTracking;
  }
  // The renderer honours foil on one element per page; disabling it here
  // removes the sheen for every consumer at once.
  if (!theme.foil.enabled) vars["--foil-sheen"] = "none";

  vars["--ornament-color"] = `var(${ORNAMENT_COLOR_VAR[theme.ornament.color]})`;
  vars["--ornament-density"] = theme.ornament.density;

  return vars;
}
