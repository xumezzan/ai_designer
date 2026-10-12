# Editorial physicality · 2026-10-10

Theme JSON now carries bounded atmosphere, surface, finishing and typography
tokens. They are validated by Zod, exposed through inferred TypeScript types,
kept in the shared series style and retained during partial refinements.
Responsive type sizes, fonts, section markup, spacing and motion curves remain
authored in the renderer. No event text is passed to image generation.

## Token behavior

- `atmosphere`: optional light gradient, additional procedural grain (0..0.15)
  and background vignette (0..0.8). Colors and light gradients accept a small
  safe grammar; resource URLs, variables and CSS declarations are rejected.
- `surface`: smooth, cotton paper, raw silk, deep velvet or matte stone, plus
  none, hairline, double hairline, blind deboss or inset frame. Decorative rails
  have no hit targets and do not change the available content width. Double
  rails are 1px wide, 8px apart.
- `finishing`: the single hero title can use aged gold, chrome silver, bronze
  patina or blind emboss. Metallic treatments keep the existing `foil.enabled`
  switch and readable `foil.color`; their reflection angle is configurable.
- `typographyScale`: monumental (1.2), editorial (1) or understated (.82), with
  optional bounded tracking. Responsive base sizes and Cyrillic/Uzbek-capable
  font stacks remain in their registry. The mobile poster retains its compact
  composition-specific size before applying the selected scale.

All new objects and their fields have defaults or are optional. Old `v1.json`
files retain their original paper/foil behavior and registered tracking. New
grain is additive to that legacy material. Existing themes are not rewritten.

```json
{
  "atmosphere": {
    "grainIntensity": 0.045,
    "ambientGlow": "radial-gradient(ellipse at 20% 10%, hsla(210, 30%, 70%, 0.07), transparent 65%)",
    "vignetteStrength": 0.15
  },
  "surface": { "texture": "deep-velvet", "borderStyle": "double-hairline" },
  "finishing": { "type": "gold-foil", "sheenAngle": 135 },
  "typographyScale": {
    "displayScale": "monumental",
    "headlineTracking": "-0.03em",
    "metaTracking": "0.2em"
  }
}
```

## Generation and motion

Anthropic's structured generation tool includes all new fields. Its prompt
chooses one coherent direction: Imperial Heritage, Desert Stone & Raw Silk,
Nocturne Gala or Botanical Atelier, and excludes flat beige/default yellow-gold
styling. The partial refinement tool supports the same tokens without inserting
defaults into a patch.

OpenAI Images receives an isolated ornament/accent prompt with a strictly black
matte for dark palettes or white matte for light palettes. Frames, text, mockups
and textured backgrounds are excluded. Sharp removes the neutral matte and
un-mattes partial pixels, then stores lossless WebP with transparency. Newly
isolated assets carry a server-issued flag: their renderer uses `screen` for
dark backgrounds and `multiply` for light ones. Legacy opaque plates keep their
original rendering. Reference integrity checks include the isolation flag.

The hero's motion component moves from 100% below its clipping window to zero
using `[0.16, 1, 0.3, 1]`. It waits for envelope dismissal when necessary. Static
presets, reduced motion and unhydrated/no-JS content stay readable. Grain and
frames never intercept pointers. Forced colors use plain readable title ink.

## Verification

`check-fonts`, `typecheck`, `lint` and `test` pass. The font check confirms all
23 registered candidates cover Cyrillic and U+02BB/U+02BC. Unit tests cover
legacy defaults, invalid tokens, CSS payloads, shared-style propagation, partial
patches, matte removal, image prompts and SSR text readability. External image
and theme API behavior is tested with mocked transports; no paid generation is
performed by this verification.

The production build succeeds. The browser [report](./report.json) has 33
successful samples: all five legacy `v1` compositions, existing Suzani `arch/v2`,
and five new deterministic physicality fixtures at 390, 1024 and 1440px. It
checks overflow, clipping, collisions, font loading and inactive reduced-motion
animations. Additional checks cover reveal after opening the envelope, changing
the reduced-motion preference, no-JS headlines and both Uzbek apostrophes.
The temporary fixture project is removed after the check.

Screenshots: [Nocturne desktop](./folio-1440.jpg), [Nocturne mobile](./folio-390.jpg),
[Imperial mobile](./poster-390.jpg), [silk desktop](./letter-1440.jpg),
[stone desktop](./arch-1440.jpg), [botanical desktop](./botanical-1440.jpg).

For an isolated build beside an existing studio server:

```sh
INVITATION_BUILD_DIR=.next-physicality-build npm run build
INVITATION_BUILD_DIR=.next-physicality-build npm run start -- --hostname 127.0.0.1 --port 3151
```

Run the browser check in a second terminal with an existing Playwright/Chrome
installation (omit `QA_PLAYWRIGHT_MODULE` when Playwright is locally installed):

```sh
QA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
QA_CHROME_EXECUTABLE=/absolute/path/to/chrome \
STUDIO_QA_URL=http://127.0.0.1:3151 \
node scripts/qa-physicality.mjs
```
