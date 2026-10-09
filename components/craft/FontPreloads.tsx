import { displayFontPreloads, type FontLocale } from "@/lib/fonts/resources";
import type { TypeSetId } from "@/registry/keys";

export function FontPreloads({ typeSet, locale }: { typeSet: TypeSetId; locale: FontLocale }) {
  return displayFontPreloads(typeSet, locale).map((path) => (
    <link key={path} rel="preload" href={path} as="font" type="font/woff2" crossOrigin="anonymous" />
  ));
}
