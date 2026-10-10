# M3 — Photo direction

Status: implementation and manual browser workflow verified. Live vision
inference and the real mixed-camera acceptance batch are pending, because this
workspace has no `ANTHROPIC_API_KEY` and no supplied acceptance photos.

## Use

1. Create a project at `/studio/new`, fill the questionnaire and save.
2. Upload event photos under Materials; design references remain separate.
3. Open Photo settings. Choose a role and invitation section for every photo.
4. Click to set the focal point or drag a protected box around all faces and
   important details. All coordinates also have labelled keyboard sliders.
5. Select allowed crop ratios, adjust their preference order, and inspect the
   resulting crop. Full-image fallback preserves protected details.
6. Choose shared or individual treatment and save photo settings. All five
   invitation previews refresh. Unsaved settings survive tab switches.

Autoanalysis is implemented at `POST /api/plan-assets`. Configure
`ANTHROPIC_API_KEY` in `.env.local`, optionally `ANTHROPIC_MODEL`, and restart
the server to enable its button. Analysis proposes a draft; review it and save
explicitly. Manual use needs no key. Do not commit `.env.local`.

## Verification

139 tests pass, together with ESLint, strict TypeScript and a production build.
Crop tests exercise 200 varied geometry cases, exact CSS object-position edge
semantics, ordered ratios, whole-photo fallback, source resolution, low-quality
limits and shared treatments. Store tests cover independent revisions, unknown
ids, hero restrictions, source-enforced viewport caps and preserving a photo
plan while event facts change. SDK transport tests cover forced tool input,
JPEG payloads, one correction retry, explicit failures and multi-batch merging.
These controlled responses are not evidence of live vision accuracy.

`scripts/qa-photos.mjs` creates an isolated temporary project, uploads three
variants through the real UI, sets a manual face-protection rectangle, clicks
the focus point, uses keyboard sliders, saves and reloads settings, and checks
three photos appear in each of the five live iframe previews. It adds a new
fixture theme version to exercise a full-photo hero without rewriting an
existing snapshot. Temporary projects and variant files are removed afterward.

The browser decodes every image before measuring the protected rectangle in
actual CSS pixels. At 320, 390, 768 and 1440px widths the protected area remains
inside every frame, all treatments resolve to grayscale, the low-resolution
image uses full-image fallback and never exceeds 320px or 35% of either viewport
dimension. Editor and invitation have no horizontal overflow or page errors.
The missing-key API returns 503 and the analysis button explains configuration.
Measured output: [qa.json](./qa.json).

The earlier M2 browser workflow also passed after the new photo tab was added;
its archived screenshots remain the original M2 evidence.

Run against a running server:

```sh
STUDIO_QA_MODE=production node scripts/qa-photos.mjs
```

Playwright must be available. With the app's bundled runtime, set
`STUDIO_PLAYWRIGHT_MODULE` to its `playwright/index.mjs` and `STUDIO_CHROME` to
local Chrome. `STUDIO_QA_URL` overrides `http://127.0.0.1:3147`.

## Fixture and visual review

The committed 1600 × 1257px fixture is a resized NASA Apollo 11 crew portrait:
[NASA source](https://www.nasa.gov/image-article/apollo-11-official-crew-portrait/),
[public-domain source and metadata](https://commons.wikimedia.org/wiki/File:Apollo_11_Crew.jpg).
Credit: NASA. No private client photographs are used. Brightness/saturation and
320px blur/compression variants simulate inconsistent source quality; they are
not three real camera captures, and protected face coordinates were selected
manually. The fixture was not submitted to an external vision service.

Visual inspection of [desktop editor](./editor-desktop.jpg) and
[mobile editor](./editor-mobile.jpg) confirms the focus/box overlays and
controls remain readable. [Desktop invitation](./invitation-desktop.jpg) and
[mobile invitation](./invitation-mobile.jpg) show coordinated monochrome crops
and the deliberately small low-resolution image. Tonal differences remain;
shared filters do not recover blown highlights. Full-photo heroes keep event
text on the theme's surface before the photograph, preserving contrast.

M3 acceptance is not claimed complete: a configured live run must still be
reviewed using real studio, flash-phone and low-resolution group photographs.
M4 generation has not started.
