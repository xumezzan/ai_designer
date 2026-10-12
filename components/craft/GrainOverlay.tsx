/** Procedural, tiled SVG noise: the registry supplies coarse and fine filters. */
export function GrainOverlay() {
  return <>
    <div className="grain-overlay" aria-hidden="true"><span /><span /></div>
    <div className="physical-grain" aria-hidden="true" />
    <div className="ambient-light" aria-hidden="true" />
    <div className="physical-vignette" aria-hidden="true" />
  </>;
}
