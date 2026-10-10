// Controlled configuration fixture for tests and browser QA only; never a generation fallback.
import type { DesignSeries } from "@/lib/schema/generation";
import { COMPOSITION_IDS, SECTION_IDS } from "@/registry/keys";
export const fixtureSeries: DesignSeries = {
  style: { name: "Тестовая серия ар-деко", mood: ["ар-деко", "вечер"], rationale: "Чёрный фон и золото объединяют геометрические композиции.",
    palette: { bg: "#161B20", surface: "#20262C", ink: "#F4E8CF", muted: "#A7A99D", accent: "#D9B967", accentAlt: "#7CAAA8" },
    typeSet: "editorial", materialSet: "paper", artwork: "none", foil: { enabled: true, color: "#D9B967" }, ornament: { pack: "art-deco", density: "light", color: "accent" }, motion: { preset: "still", ambient: "none" } },
  variants: COMPOSITION_IDS.map((composition, index) => ({ name: `Тестовая композиция ${index + 1}`, rationale: `Геометрическая композиция ${composition}, общий стиль серии.`, layout: { preset: "scroll-narrative", composition, hero: "ornament-frame", photoArrangement: index % 2 ? "offset" : "stack", sectionOrder: [...SECTION_IDS] }, ornamentPlacement: index % 2 ? ["corners", "divider"] : ["hero-frame", "watermark"], photos: [] })),
};
