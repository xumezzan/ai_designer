import Image from "next/image";
export type VisualSource = { src: string; width: number; height: number };
export function GeneratedVisual({ source }: { source: VisualSource }) {
  return <div className="generated-visual" aria-hidden="true"><Image src={source.src} width={source.width} height={source.height} alt="" unoptimized priority /></div>;
}
