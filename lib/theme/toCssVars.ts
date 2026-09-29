/**
 * Theme → CSS custom properties (SPEC §7). Components read these variables and
 * nothing else. Font stacks resolve through registry/fonts.ts `stackFor`;
 * type-set craft values and material vars come from their registries.
 */
import type { Theme } from "../schema/theme";
import { getTypeSet, type TypeSetLevel } from "../../registry/typesets";
import { getMaterialSet } from "../../registry/materials";
import { stackFor } from "../../registry/fonts";

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
  vars["--font-body"] = stackFor(typeSet.body);
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

  const material = getMaterialSet(theme.materialSet);
  if (!material) {
    throw new Error(`Material set "${theme.materialSet}" is not registered`);
  }
  Object.assign(vars, material.vars);

  vars["--foil-color"] = theme.foil.color;
  // The renderer honours foil on one element per page; disabling it here
  // removes the sheen for every consumer at once.
  if (!theme.foil.enabled) vars["--foil-sheen"] = "none";

  vars["--ornament-color"] = `var(${ORNAMENT_COLOR_VAR[theme.ornament.color]})`;
  vars["--ornament-density"] = theme.ornament.density;

  return vars;
}
