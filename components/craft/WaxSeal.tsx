import type { CSSProperties } from "react";
import type { DesignSpec } from "@/lib/schema/designSpec";

type Seal = DesignSpec["composition_rules"]["decorations"]["wax_seal"];

/** An original, bounded SVG stamp. It never intercepts a guest action. */
export function WaxSeal({ seal, monogram, className = "" }: { seal: Seal; monogram: string; className?: string }) {
  if (!seal.enabled) return null;
  return <span className={`editorial-wax-seal ${className}`} data-seal-symbol={seal.symbol} data-seal-position={seal.position} style={{ "--seal-color": seal.color } as CSSProperties} aria-hidden="true">
    <svg viewBox="0 0 100 100" fill="none" focusable="false">
      <path className="seal-wax" d="M50 5 61 7 70 9 77 16 86 22 90 33 94 43 93 54 90 65 86 76 76 82 69 90 57 91 46 95 36 90 24 87 18 78 10 70 8 59 5 48 9 38 11 27 20 21 28 12 40 10Z" />
      <path className="seal-edge" d="M50 10C71 8 87 29 88 48C90 71 72 87 51 89C31 89 13 73 12 51C11 29 28 12 50 10Z" />
      <circle className="seal-ring" cx="50" cy="50" r="30" />
      {seal.symbol === "monogram" ? <text className="seal-monogram" x="50" y="59" textAnchor="middle">{monogram.replace(/[·&\s]/g, "").slice(0, 3)}</text> : <g className="seal-emboss" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        {seal.symbol === "botanical_branch" && <><path d="M37 70C44 54 52 39 65 27M46 53C33 52 30 44 32 38C41 39 47 45 46 53ZM52 44C60 50 67 46 71 39C62 36 55 38 52 44ZM58 35C49 31 48 25 52 20C59 24 61 29 58 35ZM41 62C48 68 58 65 61 57C52 54 46 57 41 62Z" /></>}
        {seal.symbol === "olive_wreath" && <><path d="M44 74C18 59 25 30 39 22M56 74C81 59 74 30 61 22M36 29l-9-4m5 14-10-3m10 14-10 1m15 11-8 5m7-27 5-9m-3 19 6-8m-1 20 5-8M64 29l9-4m-5 14 10-3m-10 14 10 1m-15 11 8 5m-7-27-5-9m3 19-6-8m1 20-5-8" /><path d="m41 70 9 6 9-6" /></>}
        {seal.symbol === "minimal_crest" && <><path d="M50 24 68 31v21c0 10-9 18-18 24-9-6-18-14-18-24V31L50 24Z" /><path d="M40 48h20M50 37v23m-9-9 9 9 9-9" /></>}
      </g>}
    </svg>
  </span>;
}
