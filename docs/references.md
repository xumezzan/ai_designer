# Measured design references — M0.5

Measured on 2026-10-09 in Chromium through the Codex browser. The user supplied
four sites; these four constitute the reference set for this milestone. No
additional benchmark sites have been substituted for the user's choices.

## Method and limits

Sizes, tracking, leading, margins and durations below are **computed CSS**, not
estimates from screenshots. Desktop samples use 1440×900 unless noted; mobile
samples use the actual `window.innerWidth/innerHeight` of 390×844. The Gatsby
origin had browser zoom applied, so its viewport override was compensated until
the reported CSS viewport matched these dimensions. Raw family names describe
the declared stack, not independent proof that every face was successfully used.

"Empty" is a repeatable geometric proxy: union the bounding boxes of visible
text blocks and content `<img>` elements in the first viewport, then sample on
a 2 CSS-pixel grid. Exclude CSS backgrounds, SVG ornaments and hidden ancestors.
It measures area outside **element boxes**, not blank pixels or quiet parts of
a photograph. Text blocks include line-leading and their full element widths;
image-heavy heroes consequently have low empty-area values. This cannot be
used as a visual quality score or compared directly with the studio's 66svh
typographic hero reserve. Rounding is to 0.1 percentage point.

CSS durations are declared values, not stopwatch measurements of the complete
interaction. No RSVP forms were submitted. Photos, envelope artwork, logos and
other client media from the references are not copied into the implementation.

## 1. Gatsby / Latifa

Source: [Gatsby invitation](https://gatsby-invitation-production.up.railway.app/).
The measured main view follows the opening button.

| Property | Mobile | Desktop |
|---|---:|---:|
| Large day numeral, Italiana | 179.4 px / 161.46 px leading | 256 px / 230.4 px |
| Venue, Italiana | 42.9 px | 54.4 px |
| Venue tracking | 16.302 px (0.38em) | 20.672 px (0.38em) |
| Supporting paragraph, Jost | 14.4 px | 16.8 px |
| Supporting paragraph tracking | 1.728 px (0.12em) | 2.016 px (0.12em) |
| Hero side padding | 14 px | 36 px |
| Desktop text column | — | 720 px |

Palette measured in computed styles: background `#0A0A0C`, primary text
`#ECE5D3`, pale gold `#F4E3AE`, metal `#D4AF37`, muted `#9B937F`, silver
`#CDD2DA`. Gold text itself has transparent foreground because its colour comes
from a clipped gradient; transparent CSS text is not black text.

The initial 325px-wide cover sample had a 40.625px name, 11.7px subtitle with
4.446px tracking, and a 52px gap before the opening button. Do not relabel that
sample as the later 390px viewport. Main-view empty area: **40.8%**.

Reveal transitions are **1100ms**; the main foil treatment reports **2200ms**.
The opening button pulses over **2800ms**, and the scroll hint over **2600ms**.
The date is the structural anchor; the extreme date/body ratio is deliberate.
For our presets: preserve hierarchy and a single orchestrated moment, but do
not copy broad uppercase tracking into Russian prose or foil onto every line.

## 2. Wedding Postamt / Sarvar and Yora

Source: [Wedding Postamt](https://weddingpostamt-production.up.railway.app/).
Measure the photographic page after opening the envelope separately from the
envelope artwork.

| Property | Measured value |
|---|---:|
| Names on mobile photo, Cormorant Garamond | 48 px, weight 300, leading 46.08 px |
| Section heading | 38 px, leading 40.28 px, neutral tracking |
| Venue heading | 31 px, leading 49.6 px, tracking 1.24 px |
| Base body | 17 px, leading 27.2 px |
| Supporting prose | 14 px, leading 22.4 px |
| Mobile section column | 342 px with 24px side margins |
| Envelope at initial 1280×720 desktop sample | 396×702 px; surrounding column 520 px |
| Envelope names at that desktop sample | 74 px, weight 300, leading 65.12 px |

Palette: outside paper `#F4F7EF`, ink `#27241E`, wine `#6E2330`, foliage
`#5F6F49`, muted `#746F64`, light photo lettering `#FFFDF8`.
First photographic viewport empty area: **8.8%** because the image occupies
almost the whole surface. This does not mean its typography is crowded.

Content reveals are **850ms**, the invitation transition **1000ms**, and the
music label transition **650ms**. Envelope opening as a complete interaction
was not timed. Reusable decisions: thin serif display, generous body leading,
paper with a slight botanical tint and understated edges. The raster envelope,
seal and grapes are reference assets, not our material implementation.

## 3. Jafar–Sitora

Source: [Jafar–Sitora invitation](https://jafar-sitora.up.railway.app/).

| Property | Mobile | Desktop |
|---|---:|---:|
| Intro heading, Playfair Display | 36 px / 40 px leading | 48 px / 48 px |
| Intro prose, Playfair Display | 16 px / 32 px | 18 px / 36 px |
| Supporting prose, Inter | 14 px / 22.75–23.8 px | — |
| Body column | 342 px | 576 px |
| Intro heading-to-prose margin | 16 px | 16 px |
| Date day numeral | 48 px | 60 px |

The hero heading container's computed font size is only 16px, but the rendered
names live in `.hero-name` spans: **32.8px**, weight 600, leading 32.8px in the
1440px sample. The ampersand is **14.4px / 19.2px**. Reading the `h1` style
alone would report the wrong display size. Tracking on these names is neutral.

Palette: paper `#EDECEA`, ink `#1F2833`, body `#3F4750`, navigation `#243447`,
photo lettering `#FFFFFF`. Mobile first-viewport empty area: **13.0%**, dominated
by the content photograph. Reveal transitions are **700ms**. Desktop prose has
2.0 leading, distinct from the specification's narrower 1.5–1.65 body range.

Reusable decisions: serif/sans role separation, cool paper, bounded text
measure, clear itinerary rhythm. Our editorial preset uses a strong Cormorant
display over Golos Text and takes the role contrast, not the exact typefaces
or global Tailwind visual tokens. The font shaping decision is explained below.

## 4. ChungDoi — service landing page

Source: [ChungDoi Russian landing page](https://chungdoi.com/ru).
Tracking parameters were removed. This URL is a service homepage, not an
individual invitation. Its observed theme was dark; no theme setting was changed.

| Property | Mobile | Desktop |
|---|---:|---:|
| Main heading, Gotham/Montserrat stack | 30 px, weight 700, leading 36 px | 48 px / 48 px |
| Supporting body | 16 px / 24 px, weight 300 | 16 px / 24 px |
| Main CTA | 16 px; 165.1×48 px | 18 px; 218.9×60 px |
| Main heading width | 358 px | 600 px |
| Secondary heading | 24 px / 32 px | — |

Tracking is neutral. CTA transition is **150ms**, header buttons **200ms**, and
catalogue controls **300ms**. First mobile viewport empty area: **5.2%** under
the same geometric definition, including the phone mockups.

Colours arrive as modern CSS: background `oklch(0.21 0.006 56.043)`, text
`oklch(0.84955 0 0)`, primary `oklch(0.64 0.26 1.68)`. Conversion through the
OKLab→sRGB matrix yields approximately `#1B1816`, `#CDCDCD`, and gamut-clipped
`#FC0081`; these are converted values, not measured raster pixels.

Reusable decision for M2: explicit design selection and distinct preview cards.
The dense marketing hero, floating chat, billing and account controls do not
define the invitation renderer or add features to our single-user specification.

## Decisions applied to the current craft presets

- **Ceremony:** Cormorant Garamond 300 / EB Garamond 400–500; display rises
  from 52 to 96px, body remains 17px / 1.6, measure contracts to 58ch.
  The light display follows Postamt; the large desktop hierarchy follows Gatsby.
- **Editorial:** Cormorant Garamond 600 / Golos Text 400–600; display 48–84px,
  body 16px / 1.55, measure 62ch. The serif/sans contrast follows Jafar–Sitora.
- **Paper:** retain two procedural grain layers, but reduce their opacity;
  reduce the forced weathered edge and the vignette. Postamt's paper is
  a quiet stage for type and image, not a distressed texture on every block.
- **Reveal:** 850ms once on entry; reduced motion eliminates both movement and
  delay. A block becomes hidden only after its own hydrated observer is ready,
  so an inline script cannot hide text when the application bundle fails.
- **Fonts:** ship WOFF2 subsets and OFL licenses locally. Fallback `size-adjust`
  and vertical overrides derive from decoded font files and measured system
  fallback widths, including Russian and Uzbek sample letters. Only the
  selected display subset is preloaded for the project locale.
  Full source fonts are pinned and subset with their OpenType features intact.
  Actual shaping checks show that EB Garamond and Noto Serif Display have
  Latin-only small caps; both sets use Cormorant for real Russian small caps.
  Golos lacks U+02BB in the actual source, so its body stack explicitly uses
  the paired Cormorant for that Uzbek glyph; the text retains the right codepoint.

This completes the reference/craft work; it does **not** claim M1's eight
sections, five invitations or screenshot critique loops are implemented.
