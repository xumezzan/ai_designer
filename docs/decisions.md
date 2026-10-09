# Decision log

Architecture decisions that constrain future work. Newest first.

## 2026-10-09 — M1: named compositions within one renderer

The specification was amended before adding `layout.composition` with five
ids: `letter`, `poster`, `folio`, `arch`, `botanical`; omitted values default
to `letter`. Palette and typography alone could not express the required
structural diversity. These are hand-built composition presets rather than
free positioning controls. Sections do not read theme fields; the layout owns
hierarchy, order, decoration and the single foil grant. CSS never selects a
concept id. A single divider marks one pause, not every section boundary.

Paper, two type sets, two static SVG ornament packs, `still`/`unfold` and
`scroll-narrative` are implemented. Layout/motion/ornament registry existence
is now enforced. `full-photo` requires M3's DirectedImage; ambient motion,
other choreography and `card-stack` remain unavailable rather than silently
rendering another preset. Suzani and Islamic geometry are authored in code;
hero frames have architectural paths with a small signature motif.

The filesystem preview is strictly read-only and validates stored JSON without
automatic repair. Repair remains the separate M4 generation function. Safe
route ids prevent directory traversal; missing files produce 404. Demo version
1 files are the initial immutable snapshots; versioning UI is still M5.

All sections render on the server except the running countdown. Its client
props contain only date, locale and server time. It uses absolute timestamps,
pauses while the document is hidden and clamps at zero. Unfold grants one
entrance to the hero title; it does not animate every section. Server text
remains readable before the observer installs, and reduced motion uses the
existing craft rule. Optional sections are removed before wrappers/ornaments
are placed; the hero anchor follows the next visible section in JSON order.

Event date offsets, IANA timezone, coordinate bounds and RSVP destinations are
validated. Telegram/phone are native links; form mode posts labelled fields to
an explicitly configured receiver, with no invented internal endpoint or
reply store. No external RSVP action was sent during QA. Demo facts and
contacts are fictional and marked visibly. No dependency was added in M1.

## 2026-10-09 — Foundation audit: contrast repair and dependency updates

Raw palette fields are checked with the existing `Hex` schema before colour
maths. Malformed values remain unchanged and become field-specific validation
errors rather than exceptions. Repair still precedes full schema validation so
repairable inputs such as excessive ornament placements can be clamped.

Contrast repair searches both lightness directions, preserving hue and
saturation and the 0.02–0.98 lightness bounds. Ink is scored against `bg` and
`surface` together; glass background changes happen before contrast repair.
When no sampled foreground satisfies both backgrounds, validation rejects the
theme. Repair does not change background colours to disguise that failure.

Next.js and its ESLint config remain on the specification's version 15 line
(15.5.27). Vitest moves to 4.1.11 to remove the vulnerable test-worker chain;
this is a tooling upgrade and adds no direct dependency. Next.js pins an old
PostCSS internally, so a scoped override selects compatible PostCSS 8.5.29.
The lockfile also resolves source-map-js 1.2.2.

The `braces` advisory GHSA-vfj7-8cjw-p6xm remains in the ESLint dependency
chain: the registry's current release, 3.0.3, is still affected. This is tracked
until an upstream fix or a reviewed tooling replacement exists; downgrading
Next.js tooling is not an acceptable automatic audit fix.

## 2026-09-29 — Legacy stack replaced (user-approved)

The repository previously held "Invito AI" (apps/web + apps/api: FastAPI,
SQLAlchemy, Celery, JWT auth, drag-and-drop editor). That stack contradicts the
spec's non-goals (§2). Removed wholesale at the user's explicit choice; the
studio is built at the repository root per §4. Old code is recoverable from git
history.

## 2026-09-29 — `registry/keys.ts` is the source of truth for registry ids

The theme schema references registry keys via `z.enum(...)` over the id lists in
`registry/keys.ts`. The lists are declared **in full ahead of the presets**
(`card-stack`, `glass` arrive at M8) so shipping a preset never touches the
theme schema — this is what makes M8's acceptance ("adding the layout required
no change to the theme schema") true by construction. `validateTheme` enforces
both key membership and preset existence where the registry module exists.

## 2026-09-29 — `validateTheme` is pure; repair is separate

`validateTheme` reports failures and never mutates. `repairTheme` applies the
§8.1 clamps on untrusted input and logs every adjustment ("shift lightness until
it passes and log the adjustment on the branch"). `repairAndValidate` is the
generation pipeline (M4): repair first, then a pure check. Contrast repair
moves the **foreground** lightness away from the background (clamped to
0.02–0.98 so repair never emits pure black/white); the glass + light-bg rule
darkens `bg` as specified.

## 2026-09-29 — check-fonts interpretation and sources

- Pass criterion for `cyrillic` is coverage of the **U+0400–045F core** of the
  U+0400–04FF block; the full-block codepoint count and covered intervals are
  reported in `registry/fonts.generated.json`. Rationale: Google's own cyrillic
  subset never covers the whole block (e.g. Playfair covers 100/256), so a
  literal full-block requirement would fail every face.
- `uzbekApostrophe` requires **both** U+02BB and U+02BC.
- Registry admission requires the cyrillic pass; U+02BB support is recorded as
  a flag because type-set ↔ locale validation (`uz-latn`) needs it. The §16
  wording "a face that fails the check does not enter the registry" is read as
  the Cyrillic check.
- The spec's probe URL (`…&subset=cyrillic`) is requested verbatim, **plus** a
  full-subset css2 request — U+02BB lives in the latin subset and would never
  appear in a cyrillic-restricted response, making the spec's own second check
  impossible with one request.
- When fonts.googleapis.com is unreachable (this sandbox blocks it), the
  script falls back to parsing real `unicode-range` data from the `@fontsource`
  npm mirror of the same Google Fonts metadata. Provenance is recorded per
  family. The registry is still populated only from script output.

## 2026-09-29 — Type sets and material shipped first-pass in M0

`toCssVars` (an M0 deliverable) cannot resolve `--font-display` / `--grain`
without registry objects, so `registry/typesets` (`ceremony`, `editorial`) and
`registry/materials` (`paper`) ship complete first-pass presets inside the §6
craft ranges. They are provisional: M0.5 rebuilds them as deliberate answers to
the measured teardowns, and they pass the M1 screenshot critique loop before
treated as finished. Ids are frozen now to avoid later schema churn. Judgement
call — reported as a scope note in the M0 report.

## 2026-09-29 — Type-set locale support is derived, not declared

`typeSetSupportsLocale` computes support from the measured font flags
(`registry/fonts.ts`), so §16's "validation rejects any theme whose type set
does not support `content.locale`" cannot drift from reality.

## 2026-09-29 — Zero extra dependencies in tooling

`scripts/check-fonts.ts` walks npm tarballs with a ~40-line in-memory tar
reader (`node:zlib` + buffer indexing) instead of adding a tar dependency. The
dependency list is constrained by §3; only vitest + ESLint were added, with the
user's approval.

## 2026-09-29 — Client media is not repository data

`projects/*/media/` is gitignored: uploads are client assets and large
artifacts. Everything else in `projects/` (content, plans, concept versions) is
committed — M1's hand-written themes are deliverables.

## 2026-09-29 — Registry preset existence for layouts / motion / ornaments

`validateTheme` enforces preset existence for typesets and materials today;
layout, motion and ornament packs are schema-key-checked only until their
registry modules land (M1 / M8). Enforcement switches on as each registry
lands — the check code is already the single place that happens.

## 2026-09-29 — Craft layer §7.1: rule set and per-locale scope

`lib/typography/ru.ts` is the craft layer's typography half, one unit test per
rule. Scope by locale: `ru` gets the full §7.1 set (quotes, em dash, non-breaking
spaces after short words, inside initials, between number and unit, in dates);
`uz-latn` gets apostrophes, dashes, numbers and units — Russian short words and
month names do not apply; `en` gets nothing. Half-applying Russian conventions
to English reads worse than applying none.

Judgement calls inside the rules:

- A straight mark between two letters is an apostrophe, never a quote
  (`O'zbekiston` survives `quotes()` untouched).
- Only spaced hyphens become em dashes, so compounds (из-за) and phone numbers
  (+998 90 123-45-67) are safe. Four-digit year ranges are the one unspaced
  case that converts: `1920—1990`.
- Uzbek: U+02BB after O/o and G/g, U+02BC everywhere else. The typewriter `'` is
  always wrong in both positions.
- Every rule is idempotent, so a string typed twice through the pipeline does
  not grow spaces.

## 2026-09-29 — The space scale is derived, not hand-tuned

`lib/layout/space.ts` computes the scale from a type set: one body line box is
the atom, and the display/body ratio sets the multipliers. Two invariants are
tests, not prose: the gap between meaning-blocks is at least twice the gap
inside one, and the section step is at least 1.5× the block step — an even
ladder is what makes a page read as a form. The hero keeps 66svh empty.
Nothing here is a theme field; a theme picks a type set and the space follows.

## 2026-09-29 — The reveal is gated on html[data-craft="js"]

Load choreography must not cost readability. An inline script in the root
layout sets `data-craft="js"` before first paint, and the craft CSS hides a
pending block only under that attribute: with JS off, broken, or slow the
content is simply there. `Reveal` plays once — the observer disconnects on
first intersection and the state never returns to pending — and
`prefers-reduced-motion: reduce` skips the motion entirely rather than
shortening it.

## 2026-09-29 — Open: size-adjust in @font-face is not implemented yet

§7.1 asks for no first-screen shift via `size-adjust` in `@font-face`. That
needs measured per-family metrics (x-height, ascent, descent) for both the web
font and its fallback, and measuring them — decompressing woff2 from the
fontsource tarballs — is a piece of work of its own, in the same family as
`scripts/check-fonts.ts`. It is not in this milestone: stored metrics are never
invented from memory, so the rule stays unimplemented rather than guessed.
Tracked here so it is not mistaken for done.

## 2026-10-09 — M0.5 complete against four supplied references

The user supplied four reference URLs after the readiness audit and requested
milestones in order. `docs/references.md` records measured mobile/desktop type,
tracking, palette, motion and a documented geometric whitespace proxy for all
four. This supersedes the specification's suggested count of 5–8 references.
Chungdoi is a service homepage, so its product UI informs M2 rather than an
invitation layout.

Ceremony uses Cormorant Garamond 300 / EB Garamond 400–500; Editorial uses
Cormorant Garamond 600 / Golos Text 400–600. Both caps roles use the display
face because actual glyph shaping, not the presence of an `smcp` tag, proves
Cyrillic small caps. EB Garamond and Noto Serif Display only shape Latin small
caps. The shared display family has a deliberate weight contrast; the body
families distinguish the voices. Paper's two grain layers, vignette and deckle
distortion are reduced. Derived space is now published by `toCssVars`.

The earlier open font-metric task is closed. Full pinned Google Fonts TTFs
are instantiated/subset with FontTools, preserving OpenType layout features;
21 WOFF2 assets and three OFL licenses are committed. Source/assets/fallback
hashes and decoded metrics are recorded. Next's bundled fontkit measures sample
widths and vertical metrics; no runtime dependency was added. FontTools is an
optional regeneration tool, not required by builds. Size adjustment reduces
fallback shift for the measured system-font versions; arbitrary OS versions
and strings cannot be promised identical wrapping.

Golos's actual source lacks U+02BB despite its advertised CSS range. The
registry now reports that limitation, and Editorial explicitly falls back to
its paired Cormorant for that codepoint. No Uzbek apostrophe is rewritten.
The shaping and coverage tests exercise actual WOFF2 glyphs.

The earlier root-script reveal gate is superseded. A block can hide only after
its own observer is installed; a blocked application bundle leaves all server
text readable. Threshold zero lets blocks taller than a screen enter. Reduced
motion skips transitions/delays and animations; focus remains visible. The
850ms reveal follows Postamt's timing. `/craft` is a standalone craft specimen,
with Russian root language and a marked Uzbek passage, not M1's template.
