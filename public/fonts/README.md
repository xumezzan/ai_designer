# Licensed font files

Web licence files (`.woff2`) for purchased faces go here and are **never
committed** (see the repository root `.gitignore`).

## Where to obtain faces

Foundries that take Cyrillic seriously:

- https://type.today
- https://brownfox.org
- https://cstmfonts.com
- https://paratype.ru
- https://cyreal.org

Roughly $50–300 per style, one-off, web licence. One display face with good
Cyrillic is enough; a free body face is fine.

## Registering a face

1. Convert the web licence to `woff2`, subsets `cyrillic` + `latin` +
   `latin-ext` (Uzbek Latin needs `latin-ext`).
2. File names: `<font-id>-<weight>.woff2`, e.g. `acme-display-400.woff2`.
3. Declare `@font-face` with `font-display: swap` (the render layer handles
   preloading the display face only).
4. Add an entry to `LOCAL_FONTS` in `registry/fonts.ts` with the support flags
   you verified (`cyrillic`, `latinExt`, `uzbekApostrophe`) and the licence note.
5. Confirm the family name in the entry matches the `@font-face` family exactly —
   `stackFor()` quotes it into the CSS stack.
