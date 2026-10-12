import { Theme, type Theme as ThemeType } from "@/lib/schema/theme";
import type { Content } from "@/lib/schema/content";
import { populatedSections } from "@/lib/invitation/sections";
import { SECTION_IDS } from "@/registry/keys";

/** Authored examples, never used as AI output or a provider fallback. */
export const materialExamples = [
  { id: "silk-suite", name: "Письмо на шёлке", note: "Складки ткани, плотные листы и сургуч", palette: { bg: "#F0E8D9", surface: "#F7F0E4", ink: "#512C35", muted: "#5A4247", accent: "#743D4C", accentAlt: "#73495E" }, typeSet: "ceremony", materialSet: "paper", texture: "raw-silk", finish: "none", motion: "unfold", ambient: "none", pack: "none" },
  { id: "pressed-flower", name: "Хлопковый гербарий", note: "Арочная бумага, тиснение и ботаническая гравюра", palette: { bg: "#F2EDE2", surface: "#EAE3D6", ink: "#293B2D", muted: "#3F5746", accent: "#536B4F", accentAlt: "#806F58" }, typeSet: "poetic", materialSet: "paper", texture: "cotton-paper", finish: "blind-emboss", motion: "drift", ambient: "petals", pack: "botanical-engraving" },
  { id: "glass-garden", name: "Стеклянный сад", note: "Матовые слои, оптические края и глубина листвы", palette: { bg: "#1D322C", surface: "#253F35", ink: "#F4F2E6", muted: "#BCCABA", accent: "#D7DCBE", accentAlt: "#8FA993" }, typeSet: "gallery", materialSet: "glass", texture: "smooth", finish: "none", motion: "drift", ambient: "dust", pack: "none" },
] as const;

export function exampleTheme(id: string, content: Content): ThemeType | null {
  const example = materialExamples.find((item) => item.id === id);
  if (!example) return null;
  const populated = populatedSections(content);
  return Theme.parse({ meta: { name: example.name, mood: ["материал", "свадьба"], rationale: example.note }, palette: example.palette, typeSet: example.typeSet, materialSet: example.materialSet,
    artwork: "none", foil: { enabled: false, color: example.palette.accent },
    surface: { texture: example.texture, borderStyle: example.id === "glass-garden" ? "hairline" : "blind-deboss" },
    atmosphere: { grainIntensity: .025, vignetteStrength: 0 }, finishing: { type: example.finish, sheenAngle: 135 }, typographyScale: { displayScale: "editorial", headlineTracking: "-0.025em", metaTracking: ".12em" },
    ornament: { pack: example.pack, density: "light", color: "accent", placement: example.pack === "none" ? [] : ["watermark"] },
    layout: { preset: "card-stack", composition: example.id, hero: "typographic", sectionOrder: SECTION_IDS.filter((section) => populated.includes(section)), photoArrangement: "stack", visualPlacement: "band", nameFlow: "stacked" },
    motion: { preset: example.motion, ambient: example.ambient },
  });
}
