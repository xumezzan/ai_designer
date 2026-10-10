import type { Theme } from "@/lib/schema/theme";

/** The light, stock edge and backing sheet belong to the authored composition. */
export function HeroStock({ surface, monogram, signature }: { surface: Theme["surface"]; monogram: string; signature: boolean }) {
  return <div className="hero-stock" data-texture={surface.texture} data-border-style={surface.borderStyle} aria-hidden="true">
    <div className="hero-stock-backing" />
    <div className="hero-stock-sheet"><div className="hero-stock-fibre" /><div className="hero-stock-edge" /></div>
    {signature && <div className="hero-stock-signature"><span>{monogram}</span></div>}
  </div>;
}
