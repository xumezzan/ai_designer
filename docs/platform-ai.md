# AI studio: brief to editable invitation or personal greeting

The authenticated customer platform uses server-side AI to select an authored
website composition for weddings, birthdays, anniversaries, corporate events,
engagements and other occasions. The author chooses an invitation or a personal
greeting. Personal greetings require a recipient but no event date or venue,
and never expose attendance forms, calendars or event sections.

## Creation and editing

The dashboard opens a brief wizard. It creates an owned draft with explicit
event facts, optionally uploads up to three private reference images, and sends
an idempotent generation request. References are private aesthetic input to the
planner, not guest gallery photos. Claude returns JSON through
`output_config.format`. The plan chooses one registered `themeId`, with
optional authored block variants, an opening layout, a section-order preset
and a motion preset. It can fill empty headline, greeting and closing fields
in the invitation's locale. The API parses the output with Zod and compiles it
over the registered recipe before updating the stored draft.

Palettes, type pairs, spacing and ornament assets come from the chosen theme.
The model has no artwork prompt, asset URL, HTML, CSS or custom type fields in
this contract. The normal customer generation path only calls the planner and
does not need an image API key. Uploaded photos continue through the existing
media path, and already saved or published material designs remain readable.

The authored React renderer composes the complete responsive website using
editable event facts and copy. An empty optional section remains absent. The
default order keeps the existing invitation narrative. Event-first brings the
date and logistics ahead of the greeting, while programme-first swaps the
programme and venue. Each preserves the opening, the actual contents of the
blocks and the guest actions. The chosen order is saved with the composition.

The editor autosaves with an optimistic revision. It can request a new design
while preserving purpose, event facts and existing copy. The appearance controls
keep the composition when changing the palette or type pair and let the owner
select the cover, block variants, section order and motion. Material sites expose their own page-layout selector and keep
font editing; changing the physical material/light/background is a new AI brief,
because a palette picker cannot recolor an original image. Greeting and closing are generated only into empty fields;
the greeting format can additionally receive an empty occasion headline.
The Versions tab also provides [durable design history](platform-design-history.md),
including manually saved appearances, previews and design-only restoration.
Publishing explicitly freezes a guest snapshot at `/i/[slug]`. Generating and
editing the private draft never silently replaces the published invitation.

### Art direction and assembly

Tilda MCP's Vibe and Zero Block guidance informed the shared art direction
prompt for the customer and operator planners. The reference tools were
`vibe_block_design_instructions`, `vibe_block_generation_instructions`, and
`zero_block_instructions`. Both planners choose an opening focal point,
a palette with clear roles, a pace for reading, and section treatments fitted
to the brief. Prefer a meaningful visual gesture over repeated decoration,
card frames, and labels.

Each section has a purpose and composes from editable React elements. Let
typography, event details and actions flow with their actual content. Keep
intentional overlaps in the ornamental layers and make copy readable as soon
as it renders. Material covers keep a palette-tinted reading surface behind
live copy while the artwork shows between those areas. The material story
uses its heading and prose to establish the section, including photo-only
stories.

Review the complete rendered invitation at 320, 390, 430 and 1280px. Check
long names, focusable actions, section order, and resources. The material
browser harness checks cover contrast of at least 4.5:1 for regular text
and 3:1 for large text by compositing the tint over black and white.
It also checks keyboard navigation, reduced motion and a no-JS preview.
The [Tilda MCP overview](https://tilda.cc/ru/lp/mcp/) describes the block workflow.

Local acceptance on 2026-11-16 used two fictional invitations and one greeting
and passed all 14 Chromium checks. All 88 cover contrast samples passed,
with a minimum ratio of 7.43:1. The provider request path was exercised by
tests with mocked responses. Visual quality of new live AI generations and
Safari rendering remain unverified.

### Mood Profiles

Choose one of the nine profiles in the invitation editor's **Appearance**
section. Each applies a registered palette, type pair and complete composition
in one step. Profiles can be saved and restored in design history. The guest
page still uses the published snapshot. A generation brief can also name a
profile. Each registered theme uses a matching versioned WebP from
`public/artwork/mood-profiles`. The nine covers were generated once with
ImageGen and encoded at 1152 pixels wide. The site loads only the selected
cover art and draws names, photo and event facts as live content.

Modern Editorial uses paper `#FAF9F6`, surface `#F3F1EC`, ink `#1A1A1A`,
taupe `#8C7A6B`, and hairlines `#E2DFDA`. Use the taupe for accents and
control outlines, with `#635B54` for subdued copy. Cormorant Garamond 600
provides display type; locally served Inter 400–600 provides text and interface
type. Surfaces have square edges, buttons have a 2px radius, and thin rules
provide separation without shadows. A monochrome paper texture sits behind
the spread. Portrait and copy stack in reading order on phones.

Botanical Haute pairs Prata with Manrope. Linen `#F5F4F0`, canvas `#EAE7DF`,
moss `#2C352D`, bronze `#B89778` and sage `#8A9A86` shape a softly tinted
page. Engraved sprigs frame the opening, and the RSVP uses a translucent layer
with a bounded 12px blur and a solid fallback. Corners and controls use a
16px radius. Raised surfaces use `0 20px 40px rgba(44, 53, 45, 0.06)`.

Velvet Noir pairs Bodoni Moda with Montserrat, using Cormorant Garamond for
Cyrillic display glyphs. The spotlight and restrained gold glow sit over
charcoal `#0F0F0F` and surface `#1A1A1A`. Silver text is `#E5E5E5`;
`#D4AF37` accents the opening and primary action. Outlines retain
`#737373`, while secondary copy uses `#A4A4A4` for readable contrast.
The radius is 6px and the glow is `0 0 50px rgba(212, 175, 55, 0.08)`.

The six additional profiles are Champagne Letter, Rose Portrait, Forest
Herbarium, Cobalt Poster, Slate Programme and Wine Deco. Their source recipes
are in `registry/moodProfiles.ts`. The motion presets are `still`, `drift`
(soft section reveal and photo-frame parallax) and `unfold` (also opens the
existing envelope). The underlying uploaded photo keeps its original framing.
Reduced motion and disabled JavaScript leave the invitation readable.

On 2026-11-17 Chromium passed 36 guest views for the six additional profiles
at 320, 390 and 1280px in Russian and Uzbek Latin. Another 12 views checked the
three variant sets at 320, 390, 430 and 1280px alongside editor autosave and
iframe preview. All nine cover textures loaded on published 390px views. The
lowest sampled contrast beneath the names was 5.24:1. The checks used fictional
events and synthetic photos. Local font tests check Cyrillic and the Uzbek
modifier letters U+02BB and U+02BC using the actual fonts and their fallbacks.

The production build and 687 automated tests passed. The production HTTP
smoke passed authentication, ownership, publication and guest replies.
The separate operator Studio browser script stopped at its multiline
`contenteditable` assertion. The customer editor and motion were checked
independently. The end-to-end fixture path uses mocked Claude output. One
attempt through the actual generation endpoint failed before plan generation;
Anthropic's models endpoint confirmed HTTP 401 for the locally configured key.
Successful live Claude output, Safari and physical phones remain unverified.

## Server contract

`POST /api/platform/invitations/[id]/generate` requires the owner session,
same-origin mutation checks and validated JSON:

```json
{
  "requestId": "client-generated-uuid",
  "expectedUpdatedAt": "current-invitation-updatedAt",
  "brief": "20 to 2000 characters describing the design",
  "referenceIds": []
}
```

`GET` on the same path with `?requestId=...` retrieves that owner's job status.
`GET ?latest=1` discovers the latest invitation-bound job after a new browser
session. A running job can be checked without keeping its UUID in sessionStorage.
Recovery flushes unsaved editor fields before loading the current server record,
so a recovered success cannot erase an edit still inside the autosave debounce.
Jobs expose running/succeeded/failed status, a safe error or short summary, the
invitation and the previous draft. API responses never contain provider keys or
raw provider errors. Job history and before/after drafts remain private.
The request UUID is durable and replayed without a new provider call. After an
uncertain network response, clients check the existing job rather than silently
retrying a paid request. Explicit retry after a definitive failure uses a new
UUID and consumes another attempt.

The store reserves a job before provider work, limits one active generation per
owner and bounds attempts in a rolling 24-hour window. The default is three;
`PLATFORM_AI_DAILY_LIMIT` is clamped to 1–20. Paid image requests have no automatic
retry. Image-free native plans record zero image calls and require only the planner key.
Image quota and key checks run only if artwork is selected. Revision conflicts,
incompatible or malformed output and provider failure leave the
existing draft and publication intact. Unreferenced processed media can consume
an upload slot; reference-aware garbage collection is a future storage task.

## Local operation

Use one long-lived Node process and a writable private data directory.
Customer generation requires the server secret `ANTHROPIC_API_KEY` and a
model with JSON structured output support. Optional model overrides are
documented in `.env.example`.

```bash
PLATFORM_DATA_DIR=/absolute/private/path npm run dev -- --port 4310
```

Generation runs in the request with a bounded timeout. The local job supports
status recovery. The filesystem store and process-local lock require a single
long-lived process. PostgreSQL, object storage, Telegram delivery, billing and
hosted deployment remain separate work.

## Local acceptance

`scripts/qa-platform-designs.mjs` checks five briefs, persistence, appearance
history, publication boundaries and mobile rendering. Fixture mode makes no AI
calls. `PLATFORM_QA_LIVE_AI=1` explicitly enables exactly one generation POST per
brief, sequentially, with no automatic POST retry. The isolated server needs a
daily attempt limit of at least five for that acceptance run. The report marks
fixture versus live mode and does not equate token diversity with visual quality.
`PLATFORM_QA_RECHECK_REPORT=/path/to/original/report.json` checks the existing
published snapshots and their browser rendering without registration, mutation
or generation requests. Use a different output directory to preserve the
original generation evidence and keep the local server on that dataset.

`scripts/qa-platform-wizard.mjs` checks the actual wizard, editor and iframe with
intercepted generation responses. Its provider calls are mocked, while account,
draft and appearance save operations use the actual isolated local API.
