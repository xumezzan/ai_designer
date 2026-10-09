import assets from "../../registry/font-assets.generated.json";
import { getTypeSet } from "../../registry/typesets";
import type { TypeSetId } from "../../registry/keys";
import { getFont } from "../../registry/fonts";

export type FontLocale = "ru" | "uz-latn" | "en";

/** Preload the selected display only. Body faces remain demand-loaded by CSS. */
export function displayFontPreloads(typeSetId: TypeSetId, locale: FontLocale): string[] {
  const typeSet = getTypeSet(typeSetId);
  if (!typeSet) throw new Error(`Type set "${typeSetId}" is not registered`);
  const font = getFont(typeSet.display);
  if (font?.source === "local") {
    const path = font.files?.[String(typeSet.levels.display.weight)];
    if (!path) throw new Error(`No local display file for "${font.id}"`);
    return [path];
  }
  const entry = assets.families[typeSet.display as keyof typeof assets.families];
  if (!entry) throw new Error(`Prepare font assets for "${typeSet.display}" first`);
  const subsets = locale === "ru" ? ["latin", "cyrillic"] :
    locale === "uz-latn" ? ["latin", "latin-ext"] : ["latin"];
  return entry.faces.filter((face) =>
    face.weight === typeSet.levels.display.weight && subsets.includes(face.subset)).map((face) => face.path);
}
