import Image from "next/image";
import type { Palette } from "@/lib/schema/theme";
import { relativeLuminance } from "@/lib/theme/validate";
export type VisualSource = { src: string; width: number; height: number };
export function GeneratedVisual({ source, palette, isolated = false }: { source: VisualSource; palette: Palette; isolated?: boolean }) {
  const blend = isolated ? relativeLuminance(palette.bg) < .35 ? "screen" : "multiply" : undefined;
  return <div className="generated-visual" data-blend={blend} aria-hidden="true"><Image src={source.src} width={source.width} height={source.height} alt="" unoptimized priority /></div>;
}
