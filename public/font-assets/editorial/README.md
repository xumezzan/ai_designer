# Editorial typography assets

These WOFF2 assets are self-hosted Google Fonts under the SIL Open Font License.
The invitation and production build make no Google Fonts requests. Regenerate
only as a maintenance operation with `node scripts/prepare-editorial-fonts.mjs`.

- Cormorant Garamond: normal 400 and genuine italic 400.
- Playfair Display: normal 400 and genuine italic 400.
- Jost: normal 400 and 500.
- Montserrat: the existing normal 400/500 assets in `../organic` are the sans
  fallback; no duplicate font binaries are shipped here.

Each face has Latin, Latin Extended and Cyrillic subsets. `sources.json` records
the exact CSS endpoint, original binary URLs, byte lengths, SHA-256 hashes and
license sources. `glyph-coverage.json` records binary Unicode cmap measurement,
rather than assuming that CSS unicode ranges guarantee glyph presence.

Use `"Playfair Display", "Cormorant Garamond", Georgia, serif` for Playfair and
`"Jost", "Montserrat", Arial, sans-serif` for Jost. The latter provides measured
fallback coverage for uncommon Cyrillic characters and Uzbek modifier apostrophes
missing in Jost. Cormorant
and Montserrat cover the full U+0400–045F core; both also cover Uzbek Latin
modifier apostrophes U+02BB and U+02BC. The real italic fonts support these
apostrophes, and `.editorial-italic-accent` disables synthetic italic rendering.
