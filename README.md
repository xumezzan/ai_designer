# Invitation Studio

Internal, single-user tool for generating web invitations for events (weddings,
anniversaries, corporate evenings) for the Uzbekistan and CIS market. The
questionnaire and brief become 4–6 genuinely different designs; one is
approved, refined in plain language, and published at a link.

**The architectural rule that must never be broken:** the AI does not write the
invitation's HTML or CSS — it produces `theme.json` only, a configuration on top
of a hand-built component library.

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
cp .env.example .env.local      # fill in when you reach M4 (generation)

npm run dev                     # http://localhost:3000
npm test                        # unit tests
npm run typecheck
npm run lint
npm run build
npm run check-fonts             # font support table → registry/fonts.generated.json
```

Studio UI strings are Russian; code, identifiers, commits and docs are English.

Current milestone: **M1 complete**. Open `/demo` for five hand-authored wedding
invitations sharing one renderer and eight section components. Open `/craft`
for the Ceremony/Editorial typography specimen. References are measured in
[docs/references.md](./docs/references.md); three screenshot critique loops are
recorded in [docs/critique.md](./docs/critique.md). Verification and its limits:
[docs/m1-qa.md](./docs/m1-qa.md). M2's studio shell is next.

## Invitation preview

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
Replace the demo phone number before using it for a real event. Studio creation,
AI generation, media direction and public publishing belong to later milestones.

## Layout

```
app/             routes: studio, preview, public invitation, api
lib/schema/      content.json, asset-plan.json, theme.json (zod)
lib/theme/       toCssVars, validate (contrast, clamps, registry keys)
lib/typography/  micro-typography for ru / uz-latn (craft layer §7.1)
lib/layout/      the space scale, derived from the type set (§7.1)
components/craft/  always-on craft layer: reveal choreography
registry/        keys, fonts, typesets, materials, ornaments, motion, layouts
projects/        per-event store: content, asset plan, concept versions, media
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
