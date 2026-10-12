# Invitation art direction · 2026-10-10

The renderer now has an authored botanical engraving alongside its existing
ornament languages. Generation chooses a visible motif when the brief requests
one and a new image is disabled. Descriptive metadata cannot create artwork by
itself. Curated briefs specify a focal composition, material, controlled light
and a deliberate graphic language; `understated` is reserved for a customer's
explicit request for smaller, quieter typography. Saved projects still
recognise the previous curated briefs.

`scripts/qa-atelier.mjs` creates five temporary fixtures using demonstration
content: cotton-paper botanical, raw-silk folio, botanical arch, wine velvet
poster and a nocturnal stone folio. Their accents cover botanical watermark,
corners and hero-frame, plus Art Deco. One 480×640 usable image exercises the
real photo pipeline in the greeting section, with its entire frame protected.
It is resized from existing demonstration artwork and is not a client photo.

The script never generates designs, calls a paid provider or edits a client
project. It removes its temporary project in `finally`, including on failure.
Its [report](./report.json) and screenshots are generated when the check runs.

The browser check covers 320, 390, 1024 and 1440px, repeated with long Cyrillic
names. It measures overflow, text clipping, collisions, registered font loading
and the protected image area. It verifies that each opening screen contains a
visible procedural accent and that the three light compositions have different
name/date/place geometry despite sharing one palette. Screenshot hashes also
detect identical output. Additional samples cover no JavaScript, reduced
motion, envelope dismissal and both Uzbek apostrophes.

Screenshots record the actual rendered opening composition at 390 and 1440px.
They should be visually inspected alongside the measured checks:

- [Cotton paper, mobile](./herbarium-390.jpg), [desktop](./herbarium-1440.jpg)
- [Raw silk folio, mobile](./silk-folio-390.jpg), [desktop](./silk-folio-1440.jpg)
- [Botanical arch, mobile](./botanical-arch-390.jpg), [desktop](./botanical-arch-1440.jpg)
- [Wine velvet poster, mobile](./velvet-poster-390.jpg), [desktop](./velvet-poster-1440.jpg)
- [Night folio, mobile](./night-folio-390.jpg), [desktop](./night-folio-1440.jpg)

Run against a local server from the repository root. Use an existing Playwright
and Chrome installation when they are not project dependencies:

```sh
QA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
QA_CHROME_EXECUTABLE=/absolute/path/to/chrome \
STUDIO_QA_URL=http://127.0.0.1:3152 \
node scripts/qa-atelier.mjs
```

## Verification

The production server passed all 46 atelier samples with no layout failures or
browser errors: 20 standard, 20 with long Cyrillic names, five without
JavaScript, and one with Uzbek apostrophes. Envelope dismissal and dynamic
reduced motion also passed. The existing physicality regression passed all
[33 samples](../physicality/report.json), including the five legacy compositions
and the existing Suzani version.

The font check explicitly confirms the registered Golos/Cormorant fallback for
U+02BB/U+02BC: both faces must load, the width difference must disappear when
only those glyphs are removed, and the full text must measure identically using
the registered stack. Other unexpected fallbacks still fail the check. The
evidence is included in `approvedFontFallbacks` in the report.

The ten screenshots were visually reviewed. The cotton-paper botanical motif
reads as a branch, folio uses a visible fold and shifted name composition, arch
uses a pressed arched sheet, and the two dark designs have distinct geometric
and material treatments. Mobile address lines remain readable, and the silk
texture stays subtle without a moiré grid. These are deterministic renderer
fixtures; this verification does not measure a new paid AI generation.

Three existing invitations also received authored V2 revisions through the normal version store. Their event data, protected photo plan, media, approval and V1 files were preserved byte for byte. Snapshot-based checks pass for contrast, fonts, clipping, crop, targets, LCP and CLS across 390/1024/1440px; muted print was deepened to retain contrast after texture. The [measurement summary](./client-verification.json) records two typography warnings and the existing usable-photo resolution warnings. No paid generation or vision QA was called; the product versions retain their normal requirement for fresh QA before approval.
