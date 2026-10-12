# Dimensional material scenes

The user requested wedding websites with effects and tangible material weight,
using [ChungDoi's catalog](https://chungdoi.com/ru/templates) as the reference.
The live lace, silk-ribbon and glass-garden demos were opened and inspected on
2026-10-12. This work changes the renderer and generator, beyond reference notes.

## Observed reference mechanisms

- [Lace on silk](https://chungdoi.com/ru/templates/applique-lace-white/demo):
  raster cloth and embroidered edges sit behind separate HTML content; paper
  and photographs overlap rather than forming one flat image.
- [Silk ribbon](https://chungdoi.com/ru/templates/silk-ribbon-pink/demo):
  the ribbon connects alternating sections. Its gallery uses real CSS 3D
  transforms in a **1000px perspective** container.
- [Glass garden](https://chungdoi.com/ru/templates/glass-garden-green/demo):
  botanical imagery passes behind a glass plate. Computed glass uses
  **blur(7px) saturate(1.08)**, inset highlights and layered cast shadows.

No reference assets, template code, event photographs or customer facts were
copied. The useful relationship is substrate → material edge → separate
graphic/photo layer → live text → controlled movement.

## Implemented scenes

`card-stack` is registered and renders through the normal preview path. Its
three named compositions are deliberately different:

| Composition | Material and structure | Movement |
|---|---|---|
| `silk-suite` | Original satin photograph, thick stacked paper, an envelope pocket/insert and an embossed seal; alternating offset panels | Weighted rise/rotation, opening cover, subtle pointer tilt and light |
| `pressed-flower` | Arched cotton cover, debossed initials, botanical engraving and a two-column stationery suite | Gentle sheet lift; a few slow petals when selected |
| `glass-garden` | Original foliage backdrop, frosted text plates, bright optical edges and dark readable surfaces | Glass entrance, reflected light and optional fine dust |

The stage background is decorative. Names, dates, address, programme, dress
code, calendar and RSVP remain HTML and use the original facts. Empty optional
sections stay absent. All supplied enabled photos are placed once; their source
resolution, safe rectangle, treatment and whole-image fallback are unchanged.
Frames use external shadows/outline, preserving the image's actual crop ratio.

Photo decks use bounded CSS perspective/rotation, previous/next buttons,
directional touch swiping and an announced active index. Inactive interactive
cards are inert. Without JavaScript, with still motion or reduced motion, all
photos form a static vertical sequence. Motion preference changes cancel active
panel animations and remove the carousel transforms. Ambient objects pause in
hidden documents. Paper remains opaque during its entrance so it retains weight.

## Generation and persistence

Exploration directions can independently select material, texture, finishing,
foil, atmosphere, type scale, ornament and motion, alongside palette/typeface.
Old palette/typeface-only records still parse and inherit missing fields.
Canonical save validation reconstructs the same bounded identity, rather than
silently flattening every variant to the shared material. Server-issued artwork
and photograph safety remain outside direction overrides.

Exploration rejects duplicates of the composition/material/ornament/finish
signature: recolouring the same scene is insufficient. Identity signatures also
remain distinct. Cohesive mode continues to share its style explicitly.

The default new-project direction is **Объёмные материалы**; existing saved
briefs are preserved. The generator and refinement tool know the supported scene
and material/texture pairings. A studio link opens `/materials`, where three
authored examples can be compared and opened as complete invitations. These
examples are labelled as examples and are never a generation fallback.

## Original material assets

Created with the **built-in image_gen tool**, inspected, copied into the project
and optimized locally with Sharp:

- [Silk photograph](../../public/artwork/material-scenes/silk-v1.webp), about 296KB.
- [Garden photograph](../../public/artwork/material-scenes/garden-v1.webp), about 160KB.
- [Exact prompt set and generation method](./image-prompts.json).

The grayscale silk can receive the scene's colour treatment. The garden remains
a deliberately botanical scene; arbitrary bespoke imagery still uses the
existing optional artwork service. All asset URLs are local and fixed by the
renderer. No external resource URL or executable code is accepted as a theme.

## Verification

`scripts/qa-material-scenes.mjs` creates/removes its own fictional project and
tests the real preview renderer. Its photographic fixture is the original
botanical asset at different resolutions, explicitly a geometry fixture rather
than a customer portrait or a substitute for M3's mixed-camera acceptance.

The acceptance covers 320/390/1024/1440px, long Cyrillic names, no JavaScript,
protected crops, opening cover, album controls/perspective, dynamic reduced
motion and hidden-document ambient behaviour. Optional pixel QA invokes the
existing contrast/font/crop/tap/performance checks. The [report](./report.json)
records the actual result and limits. Unit tests also prove canonical persistence
of three independent material identities and rejection of colour-only variety.

On 2026-10-12 the production build, typecheck, lint and all **307 unit tests**
passed. The final browser run completed **27 geometry/readability scenarios**
and all seven interaction checks, with zero failures and browser errors. Each
scene also passed the existing LCP/CLS, protected-crop, tap-target and reduced
motion gates. Pixel QA retains warnings: thin serif strokes need manual review,
some headings end with a single word, a couple of short columns fall outside the
long-body-text measure, and the deliberately low-resolution photo fixture is
soft on a 2× screen. These warnings are preserved in the report; this is not a
claim that arbitrary customer content or newly generated themes always pass.

The [comparison board](./preview-board.jpg) shows the actual rendered mobile
examples. No live provider theme generation was required for these authored
fixtures; the generation contract and persistence were verified by tests.

Run with the existing Playwright module and browser configured:

```sh
QA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
QA_CHROME_EXECUTABLE=/absolute/path/to/chrome \
STUDIO_QA_URL=http://127.0.0.1:3156 \
MATERIAL_QA_PIXELS=1 node scripts/qa-material-scenes.mjs
```

This work does not publish a public invitation, collect new RSVP responses or
complete the outstanding mixed-camera photo-analysis acceptance.
