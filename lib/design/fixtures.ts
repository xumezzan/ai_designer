import { DesignSpec, DESIGN_HERO_COMPONENTS } from "@/lib/schema/designSpec";
import examples from "./fixtures.json";

/** Authored review samples, never a substitute for a generated specification. */
export const editorialExamples = Object.fromEntries(DESIGN_HERO_COMPONENTS.map((id) => [id, DesignSpec.parse(examples[id])])) as Record<(typeof DESIGN_HERO_COMPONENTS)[number], DesignSpec>;
