# Invitation Studio

Internal, single-user tool for generating web invitations for events (weddings,
anniversaries, corporate evenings) for the Uzbekistan and CIS market. The design description, mood and optional references become one finished design with original artwork and a complete mobile composition; it is
approved, refined in plain language, and published at a link.

**Guests primarily view invitations on mobile phones.** Design the complete
vertical invitation at 390×844 with touch first, robust at 320–430px; desktop is
an enhancement. Mobile materials, composition and guest actions are recorded in
[the complete ChungDoi preview study](./docs/chungdoi-mobile/README.md) and the
project's [design instructions](./AGENTS.md).

**The architectural rule that must never be broken:** the AI does not write the
invitation's HTML or CSS — it produces `theme.json` and separate decorative art
on top of a hand-built component library. All event copy remains live HTML.

Full specification: [SPEC.md](./SPEC.md). Milestones M0 → M8, worked one at a
time with a stop after each.

## Stack

Next.js 15 (App Router, TypeScript strict), Tailwind for layout utilities only,
`motion` for animation, `zod` for validation, `@anthropic-ai/sdk` for AI calls,
`sharp` via `next/image`, Playwright for visual QA (dev only). The filesystem is
the store (`projects/`). No backend service, no database, no auth.

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in for M3 photo analysis and M4 generation

npm run dev                     # http://localhost:3000
npm test                        # unit tests
npm run typecheck
npm run lint
npm run build
npm run check-fonts             # font support table → registry/fonts.generated.json
```

Studio UI strings are Russian; code, identifiers, commits and docs are English.

Current milestone: **M6 visual QA implemented and live-verified**. Open
`/studio` to create/edit projects, upload photos and references, direct each
photo's placement and protected crop, and create one complete design. New
projects start empty; the demo collection is never copied as generated output.
Start with **«Опишите приглашение»** and optional references; event facts can be added later. Generated invitations open in a live canvas: click names or copy to edit, use the side panel for date and other blocks, and changes save automatically. Undo/redo applies to content. Live generation creates one complete website. The owner’s Gatsby and Jafar–Sitora repositories now inform native cinematic and portrait-story compositions; those use live typography, SVG decoration and code effects without a bitmap request. Original portrait artwork remains available for an explicitly illustrated frame or scene. See [source study and implementation](./docs/source-references/README.md). Explicit names/date/venue/closing in the brief can fill empty content fields; a date without a time remains a civil date. Added content now grows within a stable narrative order: opening, description, location, programme, dress code, wishes, response and farewell; selected photo placements are honoured. Details: [narrative growth](./docs/narrative-growth/README.md), [single design](./docs/single-design/README.md), [live editor](./docs/live-editor/README.md). Live generation creates exactly one design, including projects that still carry an older multi-variant preference. The count is fixed at one for all new generation requests; historical batches remain readable. The AI selects one
shared palette, type set, material and ornament pack, then varies composition,
section order and photo/decor placement. References inform the common style.
Photo settings must be saved first; unused photos stay excluded. Manual photo
settings, shared treatment and persistence work without an API key. Autoanalysis
uses Anthropic after `ANTHROPIC_API_KEY` is added to `.env.local` and the server
is restarted; `ANTHROPIC_MODEL` optionally overrides `claude-sonnet-4-6`.
Verification: [M2](./docs/m2/README.md), [M3 and its limits](./docs/m3/README.md),
[generation and reference acceptance](./docs/m4/README.md). Real generation has
been checked with the configured provider. Vision face/quality inference on a
real mixed-camera acceptance batch remains a separate M3 acceptance task.
For original art, add `OPENAI_API_KEY` to `.env.local`, restart the server and
enable **«Создать новый визуал по брифу и референсам»**. Anthropic first records
a visible interpretation of the brief; OpenAI Images creates one text-free
illustration shared across the selected compositions, using at least
`min(3, count)` different placements. Up to 16 uploaded style references are passed as image inputs.
`OPENAI_IMAGE_MODEL` defaults to `gpt-image-2.5-sunburst` with `high` quality.
Set the variable to override the model. Native server fetch/FormData
calls the Images API; no extra SDK is required. Image generation makes one
request with no automatic paid retry. Errors retain the previous batch.
Original immutable art, prompts, model and digest are stored under each
project's `art/`; theme JSON stores a server-issued reference. Names, dates
and actions remain HTML outside the picture. Without this option, generation
still works through the existing composition/ornament renderer.
Verification: [design fidelity](./docs/fidelity/README.md).

New themes also select tactile surface/finishing tokens, a restrained light and
grain atmosphere, and editorial display/metadata contrast. Generated decorative
accents use neutral mattes, transparent WebP and palette-aware blending; existing
opaque plates retain their original treatment. The four curated generation
directions, token defaults and browser evidence are documented in
[editorial physicality](./docs/physicality/README.md).

Each generated card now includes **«Выбрать vN»**, a version selector and
**«Доработать этот вариант»**. A plain-language instruction creates the next
immutable version through a partial merge; unmentioned fields stay intact.
The selected version is independent of the current preview version. Refining,
restoring or generating a new batch preserves the selection until another
version is explicitly chosen. Change history records the source version,
instruction, actual changed fields and any necessary safety repairs.
See [M5 acceptance](./docs/m5/README.md). Selection is local project state;
the public invitation route is still a later publishing milestone.

New series and refinements now run visual QA at 390, 1024 and 1440px before
returning to the editor. Each version has a badge, concrete findings and
full-page evidence; use **«Проверить дизайн»** to check an existing version.
QA combines browser geometry, raster contrast, fonts, protected photo crops,
reduced motion and a measured Fast 3G / 4× CPU load with three narrow screenshot
vision questions. Missing runtime/provider access stays incomplete. Unverified,
incomplete and stale reports block choosing; hard findings need the separate
**«Выбрать с замечаниями»** action. Saving new content or photo direction makes
the old report stale while preserving the selected version.

Configure an existing Playwright module (`QA_PLAYWRIGHT_MODULE`), Chromium
executable (`QA_CHROME_EXECUTABLE`) and trusted preview origin (`QA_BASE_URL`)
in `.env.local`; restart the server. No dependency/browser is downloaded by QA.
The `qa/` directory and installed browser runtime must be available to the
Node server. Run this studio as a persistent Node process: QA spawns local
workers and loads previews from the same server. A serverless deployment would
need a separate browser worker. Details and acceptance limits:
[M6](./docs/m6/README.md).

Open `/demo` for five hand-authored wedding
invitations sharing one renderer and eight section components. Open `/craft`
for the Ceremony/Editorial typography specimen. References are measured in
[docs/references.md](./docs/references.md); three screenshot critique loops are
recorded in [docs/critique.md](./docs/critique.md). Verification and its limits:
[docs/m1-qa.md](./docs/m1-qa.md).

## Invitation preview

**Dimensional materials:** the studio's **Объёмные материалы** direction now
creates independent physical scenes using `card-stack`: a weighted paper suite
on original silk, an arched cotton herbarium, and frosted glass in a botanical
setting. Open `/materials` to compare three explicitly authored examples.
Photo decks keep protected crops and add buttons, swiping and CSS perspective;
no-JS/reduced-motion readers get the complete static photo sequence. Per-variant
material, finishing, typography, ornament, lighting and motion survive generation
and canonical storage validation. Recolouring the same composition/material
cannot pass exploration diversity. Existing cohesive series retain their
shared-style contract. Details and evidence: [material scenes](./docs/material-scenes/README.md).

**Invitation design refresh:** all preview compositions now use larger display
type, a more compact hero, editorial section grids, interactive fabric swatches,
calendar links and an accessible envelope entrance for `unfold`. Add `?to=Имя`
or `?guest=Имя` for a personal greeting and form prefill. Studio embeds and
reduced motion skip the entrance; the native RSVP form remains usable without
JavaScript. The generation prompt asks for one deliberate visual archetype.
Details and browser evidence: [design refresh](./docs/design-refresh/README.md).

**Generated art revision:** `/preview/demo/arch/2` is the new Suzani Atelier
direction: embroidered frame, velvet texture and an isolated floral flourish
generated with the built-in image tool. The user's request supersedes the old
procedural-only restriction. Prompts, sources and verification are in
[docs/artwork/suzani-atelier](./docs/artwork/suzani-atelier/README.md).
Choose `artwork: "suzani-atelier"` to apply this art direction; omit it or use
`"none"` for the original treatment. This remains a fixed art direction;
the new studio image-generation API instead creates project-specific artwork.
All five original v1 routes still work.

`/preview/demo/letter/1` reads `projects/demo/content.json`, `asset-plan.json`
and `concepts/letter/v1.json`. The other concepts are `poster`, `folio`, `arch`
and `botanical`. Data and contacts in this demo are fictional.

Choose `layout.composition`, type set, palette, foil, ornament placements,
motion and section order in JSON; no component changes are needed for these
five directions. Preview reads the files on each request: refresh to see edits.
For a new revision, copy a theme to `v2.json` and open version `/2`; retain the
previous version. The reader validates but never repairs or rewrites stored
themes. `composition` defaults to `letter` for older JSON. Unbuilt presets are
rejected explicitly. Event dates require an ISO timestamp with an offset and
a valid IANA timezone.

RSVP supports a Telegram username, an international phone number, or a native
POST form to a configured HTTP(S) receiver. The receiver must accept `name`,
`attendance=yes` and optional `guests`; this project does not yet store replies.
Replace the demo phone number before using it for a real event. Theme generation
is available in the studio; public publishing remains a later milestone.

## Layout

```
app/             routes: studio, preview, public invitation, api
lib/schema/      content.json, asset-plan.json, theme.json (zod)
lib/theme/       toCssVars, validate (contrast, clamps, registry keys)
lib/typography/  micro-typography for ru / uz-latn (craft layer §7.1)
lib/layout/      the space scale, derived from the type set (§7.1)
components/craft/  always-on craft layer: reveal choreography
registry/        keys, fonts, typesets, materials, ornaments, motion, layouts
projects/        local per-event store: content, asset plan, generation/selection pointers, immutable versions and provenance, media
docs/            decisions, teardowns, critique log, backlog
scripts/         check-fonts.ts
```

## Fonts

`npm run check-fonts` requests the Google Fonts CSS2 endpoint per candidate
family, parses `unicode-range`, and verifies Cyrillic (U+0400–045F core) plus
the Uzbek Latin apostrophes U+02BB / U+02BC. The registry
(`registry/fonts.ts`) is populated strictly from that output — never from
memory. A face that fails the check does not enter the registry.

All measured families are free and sit on millions of template sites; they are
a ceiling, not a destination. One purchased display face with good Cyrillic
changes perception more than a month of work on everything else. Foundries that
take Cyrillic seriously: [type.today](https://type.today),
[Brownfox](https://brownfox.org), [CSTM Fonts](https://cstmfonts.com),
[Paratype](https://paratype.ru), [Cyreal](https://cyreal.org). Roughly $50–300
per style, one-off, web licence — one display face is enough.

Licensed files live in `public/fonts/` and are **gitignored**; see
[public/fonts/README.md](./public/fonts/README.md) for the registration steps.

The current presets use committed, OFL-licensed WOFF2 files under
`public/font-assets/`; builds make no font requests to Google. Source hashes,
glyph shaping checks and measured fallback metrics are recorded. Regeneration:
[public/font-assets/README.md](./public/font-assets/README.md).
