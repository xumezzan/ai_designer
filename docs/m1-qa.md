# M1 verification — 2026-10-09

M1 implements one scroll-narrative layout, paper with foil, two type sets,
eight reusable sections and five hand-authored JSON themes. Each direction
changes composition, palette, typography, decoration, ordering and/or entrance
without a concept-specific component. The required three build → screenshot →
critique → rebuild loops are in [critique.md](./critique.md).

## Automated checks

- `npm test`: 112 tests passed across eight files.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- Production preview adds 3.37 kB route code; first-load JavaScript is 109 kB
  according to Next's build output. This is not a Lighthouse measurement.
- Tests cover all eight sections in each theme's JSON order, absent optional
  sections, the next-section anchor, one foil grant at most, server-readable
  text, all three locales, date/timezone boundaries, countdown end, native form
  fields, destination protocols, unavailable presets and route traversal.
- All five stored themes pass validation unchanged. Ink and muted text have
  contrast ≥4.5 against both backgrounds; enabled foil base colours have ≥3
  against the main background. Gradient pixels were not audited individually.

## Browser checks

The production build was served on localhost:3147 and checked in the Codex
in-app browser. Actual `innerWidth`/`innerHeight` are used because origin zoom
scales viewport overrides. Raw records: [m1/qa.json](./m1/qa.json).

| Run | Actual viewport | Themes | Result |
| --- | --- | --- | --- |
| Production mobile | 390×844 | All five | Pass |
| Production intermediate | 853×640 | All five | Pass |
| Production desktop | 1440×900 | All five | Pass |
| Development tablet | 1024×768 | All five | Pass |
| Development desktop | 1440×900 | All five | Pass |

For every row: eight sections, correct 0/1 foil count, no document horizontal
overflow, no text box outside viewport width, no intersecting hero meaning
blocks and no invitation link/button smaller than 44px. Hero collision checks
compare opening, names, date, address and arrow bounding boxes; they are not
a general visual quality scoring system.

Production screenshots are `m1/final-{letter,poster,folio,arch,botanical}-mobile.jpg`
and the corresponding `-desktop.jpg`. Browser raster captures include an outer
blank margin under origin zoom; it is not a CSS blank section.

The botanical hero arrow reached `#greeting` with its heading at the viewport
top; the footer anchor returned to `#hero`. Countdown seconds changed between
observations. Keyboard navigation reached RSVP with an ink-coloured visible
outline. No warning/error console messages were returned for the final
production run. External phone, map and Telegram links were not activated;
no RSVP form was submitted.

## Scope limits

These are fictional wedding demos without client photography. Photo treatment
and DirectedImage belong to M3; the studio and its preview grid belong to M2.
The form requires an external receiver and does not persist replies here.
No-JavaScript readability and reduced-motion behavior have source/SSR test
coverage, not a browser session with those settings emulated. This milestone
does not claim M6's full automated visual pipeline, publication or Lighthouse
scores. The five visual directions remain subject to the user's design review.
