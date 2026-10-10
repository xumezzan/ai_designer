# Prepared invitation fonts

The 21 WOFF2 files are committed assets. Normal `npm ci`, tests and builds do
not download fonts or need Python. Only the three families used by Ceremony and
Editorial are prepared; unused registry candidates are not bundled.

Sources are full variable TTFs from the pinned Google Fonts commit in
`registry/font-assets.config.json`. Source Git blob hashes are verified before
subsetting. Each family's SIL OFL license is alongside the assets. The
FontTools pipeline pins axes and retains all layout features before generating
Latin, Cyrillic and Latin Extended subsets. Packaged Fontsource subsets omitted
the real small caps, so they are not used here.

To regenerate (Node dependencies already installed):

```sh
python3 -m venv /tmp/invitation-font-tools
/tmp/invitation-font-tools/bin/pip install fonttools==4.66.1 brotli==1.2.0
npm run prepare-fonts -- --python /tmp/invitation-font-tools/bin/python
```

Regeneration downloads public source files. `--sources /path/to/cache` reuses
verified TTFs and OFL files for offline regeneration. By default the fallback
measurements use macOS Times New Roman and Arial. On another OS supply their
actual files with `--serif /path/to/Times.ttf --sans /path/to/Arial.ttf`; these
system fonts are only measured, never copied into the repository.

Generated CSS uses `font-display: swap`, measured `size-adjust` and vertical
metric overrides. The adjustment derives from shared Russian/Uzbek/Latin
sample glyph widths; source/fallback hashes and measurements are recorded in
`registry/font-assets.generated.json`. Other OS font versions may have different
widths, and line wrapping is not guaranteed identical for every string.

`FontPreloads` selects the display weight and locale subsets only. Body fonts
load on demand. Both sets use Cormorant's real Cyrillic/Latin small caps; EB
Garamond and Noto Serif Display only shape Latin small caps, and Golos Text has
no `smcp`. The Latin subset carries oldstyle numerals for all scripts.

The pinned Golos source lacks U+02BB despite its advertised CSS range. Editorial's
body stack therefore explicitly falls back to its paired Cormorant for that
glyph. U+02BC stays in Golos. U+02BB is excluded from both Golos CSS faces and
its measured fallback, so the regular body keeps its adjusted Arial fallback
during loading and only the missing glyph uses Cormorant. Source glyph coverage is tested separately from
advertised Unicode ranges; no apostrophe is silently rewritten.
