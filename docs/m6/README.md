# M6 — Visual QA

Implemented and verified against the production server on 2026-10-10.
`qa.json` records a fictional event, a controlled five-theme baseline and the
existing NASA Apollo 11 photograph from M3. These are acceptance fixtures,
never substituted for generated output by a production endpoint.

The acceptance used real Anthropic screenshot vision, then a real partial
refinement that disabled initially enabled foil. The refinement automatically
received its own browser/vision report before the API returned. Original theme
bytes and the independently selected v1 remained unchanged. A subsequent copy
edit made v1 QA stale and the API rejected selection even with an override.
The editor fits 390, 1024 and 1440px without horizontal overflow or page errors.
The light-background foil baseline itself exposes sub-AA highlights: its
selection exercised the explicit override button. The disabled-foil v2 received
an independent fresh report. This checks both a genuine rendered foil defect
and the deliberately injected defect cases.

- `report.json`: live baseline report, including lab timing and fingerprints.
- `refined-report.json`: automatically produced live report for v2.
- `viewport-*.png`: full-page evidence for the baseline.
- `studio-desktop.png`, `studio-mobile.png`: badge/findings UI.
- `broken/report.json` and its images: actual browser measurements with
  deliberate test-only CSS defects. Overflow, sub-AA foil contrast and loss of
  the protected photo area all fail. CSS injection is only a direct harness
  argument; no HTTP endpoint accepts CSS, an external URL or a client report.

Browser checks examine the embedded invitation only. Text ranges reveal
overflow, independent-node collision and clipping ancestors. Collision boxes
use canvas glyph ascender/descender metrics instead of unused em-box space,
so closely stacked names and connecting words are not false collisions.
Font loading is checked alongside canvas widths using the actual visible
characters; a synthetic Cyrillic probe on a digits-only face would trigger a
previously unused font subset and incorrectly report fallback. A second paint
marks opaque glyph cores independently of their real colour; this catches pale
foil highlights without treating antialiasing edges as foreground. The 5th
percentile of real core contrast tolerates isolated registration pixels.
Contrast samples rendered glyph cores and neighbouring background pixels, then also compares the declared
foreground against that measured background. This is a bounded defect check,
not a WCAG certification: images, unusual gradients, very thin glyphs and
text over complex backgrounds still require inspection. Large text uses the
AA large-text threshold; small muted text must meet 4.5, even where older JSON
validation admitted a 3.0 muted token. QA never rewrites an immutable theme.
QA on the existing series exposed small countdown labels below AA. The shared
renderer now uses its already validated primary ink for these labels; stored
theme palettes and immutable version files remain unchanged.

Protected-area checks project the stored safe rectangle through the actual
rendered image scale, fit and focal position. Density is measured at DPR 1;
below 1× is an error, below 2× is a warning. Long-copy measures and single-word
heading endings are warnings; deliberate name breaks can be legitimate.
Motion is examined with reduced motion enabled after scrolling through the
whole page. Screenshots and font/image decoding are bounded to 18,000px page
height, 30 million raster pixels and 2,000 text fragments. Exceeding bounds,
failed media, missing runtime or unavailable vision produces incomplete QA.

The performance run uses a fresh context, disabled browser cache, 150ms network
latency, 1.6Mbps down, 750kbps up and 4× CPU throttling. Observers are installed
before navigation. LCP and accumulated CLS cover initial loading through font
readiness plus 2.5 seconds, before interaction; they are lab observations, not
field Core Web Vitals or lifetime CLS. Slow loading and shifts are warnings.
The implementation follows the official [Playwright CDP API](https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session)
and [initialization script API](https://playwright.dev/docs/api/class-page#page-add-init-script).
Contrast thresholds follow [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Vision sees two first screens and at most two rendered photo frames. It answers
only cropped faces, unreadable text on a busy photo and clearly broken
alignment; it does not rank aesthetics. Uncertainty becomes a warning for
manual review. The live fixture establishes real transport/inference;
the positive cropped-area acceptance is geometric. The real mixed-camera
photo-analysis acceptance from M3 remains separate.

Reports live under `projects/<slug>/concepts/<id>/qa/vN.json`, pointing to a
unique evidence directory. They bind content, photo plan, immutable theme,
renderer/build and QA engine. Every approval checks freshness server-side;
hard findings require a literal explicit override, whose run id is recorded
in `approved.json`. Existing approvals survive edits with a stale/missing
notice. No report is trusted from a client. PNG access is allowlisted against
the saved report and has private/no-store headers. Event reports, media and
screenshots remain ignored client data; committed evidence here is fictional.

Two workers run concurrently with a bounded queue and per-request deduplication.
Report commits are serialized per project and recheck all revisions under the
existing store lock. Runtime failure tests exercise five real child processes
with an intentionally absent Playwright module: all five persist incomplete
reports, with no fake screenshots or successful selection.

Validation: 180 tests across 20 files, lint, typecheck and production build.
Run the live acceptance with an already configured runtime:

```sh
STUDIO_QA_LIVE=1 \
QA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
QA_CHROME_EXECUTABLE=/absolute/path/to/chromium \
node scripts/qa-quality.mjs
```

The server separately needs the same paths and `QA_BASE_URL` in `.env.local`,
plus its existing Anthropic credentials. The script makes one real refinement
and two screenshot-vision requests; it cleans up its own test project. Paths
with spaces must be shell-quoted. No installation is performed.
