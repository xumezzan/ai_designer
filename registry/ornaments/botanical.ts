/**
 * An authored herbarium plate, rather than a repeated flower or clip-art frame.
 * Coordinates share the ornament registry's 100 × 100 canvas. The fine curved
 * hatching follows each leaf's midrib; broader outlines remain legible when the
 * plate is reduced. All pigment inherits the theme's currentColor.
 */
const leaf = `
  <path class="engraving-leaf" d="M0 0C-3-5-9-11-7-18C-5-23-1-25 0-29C2-24 8-21 8-15C8-9 3-3 0 0Z" fill="currentColor" fill-opacity=".045" stroke-width=".42"/>
  <path d="M0-.7C-1.8-9.5-1.2-19 0-28" stroke-width=".32"/>
  <g class="engraving-hatch" stroke-width=".15" opacity=".8">
    <path d="M-.5-3Q-2-5-3.2-6.7M-.8-5Q-3-7-4.6-9M-1-7Q-4-9-5.8-11.3M-1.1-9Q-4.8-11.2-6.7-13.4M-1.2-11Q-5-13-7.2-15.5M-1.2-13Q-5.1-15.2-7-17.4M-1.1-15Q-4.4-17-6.5-19.1M-1-17Q-4-19-5.5-21M-.8-19Q-3-21-4.1-22.8M-.6-21Q-2-23-2.7-24.4"/>
    <path d="M-.4-3Q1.3-5 2.6-6M-.7-5Q2-7 4-8.2M-.9-7Q2.8-9 5.4-10.4M-1-9Q3.2-11 6.5-12.4M-1.1-11Q3.7-13 7.3-14.5M-1.1-13Q3.8-15.2 7.6-16.6M-1-15Q3.3-17.3 7-18.6M-.9-17Q2.7-19.2 5.9-20.8M-.7-19Q2.1-21.2 4.4-22.6M-.5-21Q1.4-23 2.9-24.6"/>
  </g>`;

function leafAt(x: number, y: number, angle: number, scale: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">${leaf}</g>`;
}

const seeds = `
  <g class="engraving-seeds" stroke-width=".3">
    <path d="M54 31C63 30 68 23 73 18M67 24C71 24 77 26 81 25M69 21C70 17 69 14 71 11"/>
    <path d="M73 18C71 15 72 11 75 10C78 13 77 17 73 18ZM81 25C79 22 80 19 83 19C86 21 85 24 81 25ZM71 11C69 9 69 6 72 5C75 7 74 10 71 11Z" fill="currentColor" fill-opacity=".08"/>
    <path d="M74 16L75 12M82 23L83 20M71.5 9L72 6.5" stroke-width=".14"/>
  </g>`;

export const botanicalEngraving = `<g transform="translate(6 3) scale(.94)" stroke-linecap="round" stroke-linejoin="round">
  <g class="engraving-stem">
    <path d="M21 96C29 82 32 70 40 56C46 46 51 40 56 27C60 18 65 11 69 5" stroke-width=".58"/>
    <path d="M21.7 95.5C29.6 81 32.8 69 40.8 55.4C47 45 51.8 39.5 56.7 26.8" stroke-width=".16" opacity=".65"/>
    <path d="M27 83L24 80M34 67L38 64M42 53L39 50M51 39L54 37M58 22L56 20M64 12L66 10" stroke-width=".34"/>
  </g>
  ${leafAt(24, 80, -56, 1.1)}
  ${leafAt(38, 64, 62, 1.2)}
  ${leafAt(39, 50, -57, 1.02)}
  ${leafAt(54, 37, 62, .94)}
  ${leafAt(56, 20, -43, .66)}
  ${leafAt(66, 10, 39, .42)}
  ${seeds}
</g>`;
