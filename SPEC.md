# Invitation Studio — Master Spec

> Place this file at the repository root as `SPEC.md`. It is also the starting prompt for Codex / Claude Code.
> Work milestone by milestone (M0 → M8). **Stop after each one** and show the result.

---

## 0. Role

You are a senior frontend engineer and design-systems engineer. You are building an internal, single-user tool: a generator of web invitations for events (weddings, anniversaries, corporate evenings) for the Uzbekistan and CIS market.

Invitation content is authored in Russian, Uzbek (Latin), or English. Studio UI is in Russian. Code, identifiers, commits, and documentation are in English. Comment only where the logic is non-obvious.

---

## 1. What we are building

Input: an event questionnaire, a free-text brief, and reference images.
Output: 4–6 genuinely different invitation designs generated in parallel → preview grid → approve one → refine it in plain language → publish at a link.

**The architectural rule that must never be broken:**

> The AI does not write the invitation's HTML or CSS. The AI produces **`theme.json` only** — a configuration on top of a hand-built component library.

Free-form layout generation produces recognisably templated output and unrepeatable quality. Configuration over a hand-built library produces quality bounded by the library, and the library keeps growing.

Consequence: if some design variant requires touching a section component, the theme schema is missing a field. Fix the schema, not the component.

---

## 2. Non-goals for v1

Do not build, even if it seems useful:

- authentication, multi-tenancy, roles, billing;
- a separate backend service, message queue, or worker pool — no FastAPI, no Celery, no Redis;
- a database (the filesystem is the store until RSVP responses need collecting);
- WebGL, three.js, heavy canvas scenes;
- image generation through any API — every texture is procedural (SVG/CSS);
- a drag-and-drop visual editor;
- email delivery, analytics, A/B tests;
- an i18n framework (three locales are set per project; UI strings live in one dictionary).

Rationale for the light stack: there is one user, roughly 10–20 invitations a month, and the deliverable is HTML and CSS. A second language on the backend would mean maintaining the schema twice and syncing it forever, for zero gain in design quality.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript strict |
| Styling | Tailwind for **layout utilities only** (flex, grid, spacing primitives). Every visual token flows through CSS custom properties from the theme. Tailwind colours, fonts, radii, and shadows are forbidden in invitation components |
| Animation | `motion` (Framer Motion). GSAP + ScrollTrigger allowed **only** for the `overture` motion preset, lazy-loaded, never on the critical path |
| Validation | `zod` |
| AI | `@anthropic-ai/sdk`, model `claude-sonnet-4-6` |
| Images | `sharp` via `next/image` |
| Visual QA | Playwright (dev dependency only, never shipped) |
| Storage | filesystem, `projects/` directory |
| Deploy | Vercel |

Any dependency outside this list requires my approval. Ask.

`.env.local`: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_BASE_URL`.

---

## 4. Repository layout

```
app/
  studio/
    page.tsx                          # project list
    [slug]/page.tsx                   # questionnaire, refs, generation, preview grid
  preview/[slug]/[conceptId]/[version]/page.tsx
  i/[slug]/page.tsx                   # public invitation
  api/
    generate/route.ts                 # parallel theme generation
    refine/route.ts                   # plain-language edits → new version
    analyze-refs/route.ts             # vision mood-board extraction
    plan-assets/route.ts              # per-image art direction
lib/
  schema/content.ts
  schema/assetPlan.ts
  schema/theme.ts
  theme/toCssVars.ts
  theme/validate.ts                   # clamps, contrast, registry key checks
  theme/diversity.ts                  # forced-variety matrix
  versions/                           # immutable concept/version store
  typography/ru.ts                    # Russian micro-typography engine
  typography/uz.ts
  ai/generateTheme.ts
  ai/refineTheme.ts
  ai/analyzeRefs.ts
  ai/planAssets.ts
  ai/prompts/                         # system prompts, one file each
registry/
  layouts/
  typesets/
  materials/
  ornaments/
  motion/
  fonts.ts
components/
  sections/                           # Hero, Greeting, Countdown, Timeline, Venue, DressCode, Rsvp, Footer
  primitives/                         # Surface, Ornament, FoilText, GrainOverlay, DeckleEdge, DirectedImage
qa/
  checks/                             # one file per mechanical check
  runVisualQa.ts
projects/
  <slug>/
    content.json
    asset-plan.json
    refs-analysis.json
    concepts/<conceptId>/v1.json, v2.json, ...
    concepts/<conceptId>/meta.json    # lineage, approval pointer
    approved.json                     # { conceptId, version }
    media/
docs/
  references.md                       # measured teardowns of benchmark work
  critique.md                         # self-critique log
  decisions.md                        # architecture decisions
  backlog.md                          # section variants not yet built
scripts/
  check-fonts.ts
```

---

## 5. Data model

### 5.1 `content.json`

Deterministic facts. The AI does not generate these (it may help draft the greeting text on request).

```ts
const Content = z.object({
  slug: z.string(),
  locale: z.enum(['ru', 'uz-latn', 'en']),
  eventType: z.enum(['wedding', 'anniversary', 'birthday', 'corporate', 'engagement', 'other']),

  hosts: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
  })).min(1),

  headline: z.string().optional(),
  greeting: z.string().optional(),

  date: z.object({
    start: z.string(),                        // ISO 8601 with offset
    timezone: z.string().default('Asia/Tashkent'),
    showCountdown: z.boolean().default(true),
  }),

  venue: z.object({
    name: z.string(),
    address: z.string(),
    coords: z.tuple([z.number(), z.number()]).optional(),
    mapUrl: z.string().url().optional(),
    note: z.string().optional(),
  }),

  timeline: z.array(z.object({
    time: z.string(),
    title: z.string(),
    note: z.string().optional(),
  })).default([]),

  dressCode: z.object({
    title: z.string(),
    note: z.string().optional(),
    swatches: z.array(Hex).default([]),
  }).optional(),

  rsvp: z.object({
    enabled: z.boolean().default(true),
    mode: z.enum(['telegram', 'form', 'phone']).default('telegram'),
    target: z.string(),
    deadline: z.string().optional(),
    askGuestCount: z.boolean().default(true),
  }).optional(),

  media: z.array(z.object({ id: z.string(), src: z.string() })).default([]),

  brief: z.string().optional(),
  refs: z.array(z.string()).default([]),
});
```

### 5.2 `asset-plan.json` — art direction per image

Client photographs are the fastest way to wreck a premium design: mixed white balance, low resolution, faces near the frame edge. A global crop rule cannot solve this. Every image gets its own direction.

```ts
const AssetPlan = z.object({
  assets: z.array(z.object({
    id: z.string(),

    role: z.enum(['hero', 'portrait', 'story', 'gallery', 'backdrop', 'unused']),
    subject: z.enum(['couple', 'person', 'group', 'venue', 'detail', 'landscape']),

    // Normalised 0..1. The renderer maps focal to object-position.
    focal: z.tuple([z.number(), z.number()]),

    // Normalised box that must never be cropped away (faces, joined hands).
    safeArea: z.object({
      x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    }),

    allowedRatios: z.array(z.enum(['3:4', '4:5', '1:1', '3:2', '16:9'])).min(1),
    treatment: z.enum(['none', 'warm-film', 'duotone', 'desaturate', 'bw']),

    quality: z.enum(['high', 'usable', 'low']),
    issues: z.array(z.enum([
      'soft-focus', 'low-res', 'harsh-flash', 'mixed-white-balance',
      'busy-background', 'watermark', 'cluttered-edges',
    ])).default([]),

    maxViewportShare: z.number().min(0.15).max(1),   // cap on how much screen it may occupy
    placement: z.object({ section: SectionId, index: z.number() }).nullable(),
    note: z.string().optional(),
  })),

  // A single treatment chosen for the whole set, so mismatched sources read as one film.
  unifiedTreatment: z.enum(['warm-film', 'desaturate', 'bw', 'none']),
});
```

Rules the renderer enforces, not suggestions:

- `object-fit: cover` with default centring is banned. `DirectedImage` always positions from `focal`.
- A crop that would intersect `safeArea` is rejected at build time; the next allowed ratio is used instead.
- `quality: 'low'` can never exceed its `maxViewportShare`, and can never be the hero.
- `unifiedTreatment` plus a shared grain layer is applied across every photo, so a phone snap and a studio frame belong to the same set.

`POST /api/plan-assets` produces this with a vision call. Every field is user-editable in the studio, because the model will misjudge focal points on group shots.

### 5.3 `theme.json`

**Schema principle: the AI picks from a menu, it does not turn knobs.**

Tracking, leading, scale ratios, grain density, easing curves and durations are craft, not taste. Give a model numeric fields and it will fill in reasonable values, and the result will be exactly reasonable. Each such group is hand-tuned into a named set; the model selects the set whole.

```ts
const Theme = z.object({
  meta: z.object({
    name: z.string(),
    mood: z.array(z.string()).max(4),
    rationale: z.string().max(400),           // one paragraph: what the key decision is and why
  }),

  palette: z.object({
    bg: Hex, surface: Hex, ink: Hex,
    muted: Hex, accent: Hex, accentAlt: Hex,
  }),

  // Hand-tuned typographic pairing: families, weights per level, tracking per level,
  // leading, modular scale, OpenType features. See 6.1.
  typeSet: TypeSetId,

  // Hand-built material: grain layers, vignette weight, foil physics, edge treatment. See 6.2.
  materialSet: MaterialSetId,
  foil: z.object({ enabled: z.boolean(), color: Hex }),

  ornament: z.object({
    pack: OrnamentPackId,                     // includes 'none'
    density: z.enum(['light', 'medium']),     // 'rich' deliberately excluded
    placement: z.array(z.enum(['divider', 'corners', 'hero-frame', 'watermark'])).max(2),
    color: z.enum(['accent', 'accentAlt', 'muted']),
  }),

  layout: z.object({
    preset: LayoutId,
    hero: z.enum(['full-photo', 'typographic', 'ornament-frame']),
    sectionOrder: z.array(SectionId),
  }),

  motion: z.object({
    preset: MotionId,                         // 'still' | 'unfold' | 'drift' | 'overture'
    ambient: z.enum(['none', 'dust', 'petals', 'snow']),
  }),
});
```

Note what the schema does **not** contain and must never gain: text alignment, radii, shadows, font sizes, padding, line length, animation durations. Those are decided once, correctly, in the layout and the craft layer.

---

## 6. Registries

Each registry is a TS module exporting preset objects. The theme schema references registry keys; validation must reject unknown keys.

**Depth beats breadth.** Three layouts taken to studio standard beat twelve mediocre ones by a wide margin. Each preset is a piece of design work with a screenshot critique loop behind it, not an enum member. Extend the registry only after the existing entries are finished.

### 6.1 Type sets (`registry/typesets`)

The most important registry in the project. Each set is tuned by hand and specifies:

- a pairing of two families, or one family carried by strong weight contrast;
- a modular scale with a **large** gap between display and body: 64–96 px against 15–17 px. An even 1.2 ratio across every level is the clearest amateur tell;
- tracking per level: negative on large display (−0.02…−0.04em), neutral on body, positive on small caps;
- leading: 1.05–1.15 for display, 1.5–1.65 for a serif body;
- `font-feature-settings` with real small caps (`smcp`), oldstyle figures (`onum`), ligatures. `text-transform: uppercase` plus `letter-spacing` as a substitute for small caps is forbidden;
- maximum measure in characters, not pixels.

### 6.2 Materials (`registry/materials`)

A set of CSS custom properties plus an SVG filter. Procedural only: `feTurbulence` for paper and linen grain, layered `conic-gradient` for foil sheen, SVG `mask-image` for deckle edges, `backdrop-filter` for glass. No raster textures in the repository.

Rules without which a material reads as cheap:

- grain is always multi-layer — coarse and fine at different opacities. A single noise layer looks like noise;
- shadows are long, soft, low-opacity, and tinted toward the background. `rgba(0,0,0,.1)` under every block is a generation tell;
- foil applies to **one element per page**. Gold on every heading cheapens the whole thing instantly;
- no pure black, no pure white. `ink` derives from the paper hue at low saturation. Note that a generic tinted near-black such as `#0B0B0B` is itself a tell — the hue must actually relate to the palette.

### 6.3 Ornaments (`registry/ornaments`)

SVG packs with `divider`, `corner`, `frame`, `watermark` elements. `uzbek-suzani` and `geometric-islamic` are constructed as real geometry with correct repetition, not stock clipart. Colour via `currentColor`, stroke no thinner than 0.75 px at 2× DPR.

### 6.4 Motion (`registry/motion`)

A preset defines the entire choreography: the page-load sequence, durations, custom `cubic-bezier` curves, permitted triggers.

- expensive motion is slow: 600–1200 ms, not 300;
- one orchestrated moment beats ten scattered effects. Fade-up on every section reads as auto-generated;
- `still` — complete stillness — is a first-class and often the best answer;
- `overture` is the only preset allowed to load GSAP, and only on layouts with scroll-linked sequences.

---

## 7. Render layer

The theme becomes CSS custom properties on the root element. Components read variables and nothing else.

```ts
// lib/theme/toCssVars.ts
{ '--bg': palette.bg, '--ink': palette.ink, '--accent': palette.accent,
  '--font-display': stackFor(typeSet.display), '--grain': materialSet.grain, ... }
```

Section components must not branch on the theme beyond one level: material lives entirely inside `<Surface>`, ornament inside `<Ornament>`, grain inside `<GrainOverlay>`, photo direction inside `<DirectedImage>`. A section knows its content and order, never its styling.

The layout preset is the single place where a `switch` on the theme is allowed: it picks the wrapper and the section order.

### 7.1 Craft layer

This is what makes the work look expensive, and it is **theme-independent and not exposed to the AI**. Written once, always on, in every variant without exception.

**Russian micro-typography** (`lib/typography/ru.ts`) — applied to every string before render:

- guillemets «» at the first level, „“" at the second;
- non-breaking space after one- and two-letter prepositions and conjunctions, before dashes, inside initials, between number and unit, in dates;
- a real em dash where a dash is meant, with a thin space;
- no dangling preposition at the end of a line;
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs;
- hanging punctuation on pull quotes and quoted lines.

For `uz-latn`: correct `ʻ` (U+02BB) and `ʼ` (U+02BC) instead of the typewriter apostrophe.

Each rule gets a unit test. A guest reading `"Зелихан"` with straight quotes and a preposition stranded at a line break registers the page as amateur work no matter how cinematic the scrolling is.

**Space.** Generous and asymmetric. The spacing scale derives from the type scale, not from an 8/16/24/32 ladder. The hero is two-thirds empty by default. Space between meaning-blocks is at least twice the space inside a block; equal spacing makes the page read as a form.

**Load choreography.** The page assembles rather than appears. Fonts preloaded, no first-screen shift (`size-adjust` in `@font-face`), the reveal sequence defined and played exactly once.

**Quality floor** no variant drops below: visible keyboard focus, AA contrast, correct `lang`, meaningful `alt`, content readable without JS, `prefers-reduced-motion` honoured.

None of this is a theme field. If the agent proposes moving any of it into `theme.json`, refuse.

---

## 8. Theme generator

`POST /api/generate` → `{ slug, count = 5 }` → array of concept ids.

1. Assemble the brief: `content.brief`, event type, locale, reference analysis, asset-plan summary (how many usable photos, whether a hero-grade image exists).
2. Build the **diversity matrix** (`lib/theme/diversity.ts`): shuffle `(layout × materialSet)` pairs and assign one hard to each branch, plus distinct ornament packs and motion presets. Without this, five branches return five shades of the same idea. Named creative directions ("luxury", "editorial") are a weaker diversity mechanism — they collapse into each other — which is why the axis is structural.
3. Fire `count` Anthropic calls **in parallel** via `Promise.allSettled`, `temperature: 1`.
4. Structured output via tool use: expose the theme schema as the `input_schema` of an `emit_theme` tool with `tool_choice: { type: 'tool', name: 'emit_theme' }`. Never parse JSON out of prose.
5. Validate with zod. On failure, **one** retry with the error text appended. A second failure drops that branch; it never fails the whole run.
6. Run `lib/theme/validate.ts`: contrast, clamps, registry key existence, font support for the locale.
7. Write each surviving theme as `concepts/<conceptId>/v1.json`.

### 8.1 Auto-repair and clamps

- `ink` on `bg` and on `surface`: minimum **4.5:1**. `muted` on `bg`: minimum **3:1**. Computed by WCAG relative luminance. On failure, shift lightness until it passes and log the adjustment on the branch.
- `layout.hero === 'full-photo'` with no `quality: 'high'` asset in the plan → forced to `typographic`.
- `ornament.placement` longer than 2 entries → truncated.
- `materialSet` is glass while `palette.bg` sits above 60% lightness → glass is unreadable, darken `bg`.
- Foil enabled on more than one section → the renderer honours only the first.

### 8.2 Generator system prompt

Stored in `lib/ai/prompts/generateTheme.ts`.

```
You are the art director of a studio that designs web invitations for events.
You do not write code. You return one theme object through the emit_theme tool.

You have been assigned a fixed pairing: layout = {X}, materialSet = {Y}.
You may not change it. Your job is to produce the best possible design
inside that pairing, not to pick a more comfortable one.

BRIEF: {brief}
EVENT: {eventType}   LANGUAGE: {locale}
FROM REFERENCES: {refAnalysis}
PHOTOGRAPHY: {assetSummary}

Rules:

1. The palette comes from the brief, not from what weddings usually look like.
   Do not default to a cream background near #F4F1EA with a high-contrast
   antique serif and a terracotta accent near #D97757. That combination is the
   single most recognisable signature of generated design. It is permitted only
   when the brief explicitly asks for it.
   Also banned as defaults: near-black background with one acid accent;
   identical rounded cards under identical grey shadows; gradient washes
   used as decoration; a tinted near-black such as #0B0B0B standing in for black.

2. Spend boldness in one place. One thing on the page is memorable —
   the typography, or the material, or the ornament. Everything else stays
   quiet. Amplifying all three amplifies nothing.

3. Typography carries the character. Choose a type set deliberately for this
   brief rather than the one you would pick for any invitation.
   Do not accent a single word in a heading with italic or colour.
   Do not put tracked-out capitals above blocks as labels.

4. Motion is one orchestrated event, not an effect per section.
   motion.preset = 'still' is a complete answer when the brief asks for restraint.

5. Ornament encodes meaning; it does not fill space. If the brief carries no
   cultural or decorative motif, pack = 'none'.

6. A celebration is not a reason for noise. A respected elder's anniversary or
   an intimate wedding calls for silence in the design.

In meta.rationale, one paragraph: what the governing decision is and how it
follows from the brief. No generic praise of elegance and refinement.
```

---

## 9. Reference analysis

`POST /api/analyze-refs`. Images are sent as base64 with the correct `media_type`.

Returns a mood board, never a theme:

```ts
{ palette: Hex[], temperature: 'warm' | 'cool' | 'neutral',
  contrast: 'low' | 'medium' | 'high',
  typographyFeel: string, materials: string[], motifs: string[],
  formality: 1 | 2 | 3 | 4 | 5, notes: string }
```

The prompt states plainly: extract mood, palette, and materials. Do not describe or reproduce the reference's layout — references are frequently paid templates.

Cached to `projects/<slug>/refs-analysis.json`.

---

## 10. Versioning

Immutable. A concept is a lineage; a version is a frozen artefact.

```
projects/<slug>/
  concepts/
    <conceptId>/
      meta.json          # { createdAt, assignedLayout, assignedMaterial, approvedVersion }
      v1.json            # never modified after write
      v2.json
      v3.json
  approved.json          # { conceptId, version }
```

Rules:

- version files are written once and never mutated;
- `/api/refine` always produces the next version, never edits in place;
- approving sets the pointer in `approved.json`; the version file itself is untouched;
- further edits to an approved concept create a new version and leave the approved pointer where it is until I move it explicitly;
- the studio can preview and restore any version by pointer change alone.

---

## 11. Refinement

`POST /api/refine` → `{ slug, conceptId, fromVersion, instruction }`, where the instruction is plain language: "darker, drop the petals", "more air", "lose the gold".

The model returns a **partial** theme object through tool use. It is deep-merged onto the source version, validated, clamped, and written as the next version. Full regeneration is forbidden: it drifts fields the instruction never mentioned.

---

## 12. Visual QA

Playwright renders every candidate at **390**, **1024**, and **1440** and runs a fixed, finite checklist. This is a **defect detector, not a taste critic** — a vision model asked to rate visual sophistication returns a confident, useless report.

Mechanical checks (`qa/checks/`, one file each, each returning pass/fail plus the offending selector):

- horizontal overflow at any breakpoint;
- bounding-box collision between text nodes;
- text clipped by a fixed-height container;
- rendered-pixel contrast below AA;
- measure outside 45–80 characters;
- a heading whose last line holds one word;
- fallback font in use (measured width mismatch against the loaded face);
- tap target under 44 px;
- image whose intrinsic resolution is below its rendered size at 2× DPR;
- animation still running under `prefers-reduced-motion: reduce`;
- LCP above 2.5 s and CLS above 0.1 under Fast 3G with 4× CPU throttling.

Narrow vision checks, each a yes/no question with a screenshot:

- is any face cropped by a frame edge;
- does body text sit on a busy region of a photograph;
- is any element clearly misaligned against the others.

Failures attach to the concept and surface in the studio grid as a badge. A candidate with a hard failure is not shown as approvable until fixed or explicitly overridden.

---

## 13. Studio

`/studio/[slug]`, four zones:

- **Questionnaire** — a form over the content schema, live-saved, drag-and-drop upload for media and references.
- **Asset plan** — the generated per-image direction, with editable focal point (click on the image sets it), role, and treatment. The model misjudges focal points on group shots; correcting one takes two seconds and saves the hero.
- **Concept grid** — each version in an `<iframe>` at a fixed 390×844 viewport, `transform: scale()`. A live iframe is more honest than a screenshot and refreshes instantly. Under each card: theme name, `rationale`, QA badges, and a text field for plain-language edits.
- **Approval** — set the approved pointer, open the public link, browse version history.

The studio UI is deliberately neutral: system font, grey ground, no decoration. All attention belongs to the previews.

---

## 14. Publishing

`/i/[slug]` renders `content.json` plus the approved version. Also:

- `middleware.ts` rewrites `<slug>.domain` → `/i/<slug>`;
- `?guest=Name` fills the greeting when the content provides a slot;
- dynamic OG image via `next/og` in the theme palette, with names and date — this is what people actually see in a Telegram link preview;
- `noindex` on every invitation.

---

## 15. Performance budget

Guests open these on phones, usually inside the Telegram or Instagram webview. This is a budget, not an aspiration:

- ≤ 120 KB gzipped JS on the public page; sections are server components by default, client only where state genuinely exists;
- LCP ≤ 2.5 s under Fast 3G with 4× CPU throttling;
- fonts: `woff2` only, `cyrillic` + `latin` subsets (+ `latin-ext` for Uzbek Latin), `font-display: swap`, preload the display face only;
- ambient effects in CSS or 2D canvas capped at 30 fps, fully stopped on `document.hidden`;
- `prefers-reduced-motion: reduce` kills all ambient motion — a render-level rule, not a theme option;
- every photograph goes through `next/image` with explicit `sizes`.

---

## 16. Fonts

This is where most of the breakage happens. Most beautiful display faces have no Cyrillic, and Uzbek Latin needs `ʻ` (U+02BB) and `ʼ` (U+02BC).

`registry/fonts.ts` holds `id`, `family`, available weights, roles (`display` / `body` / `script`), and support flags: `cyrillic`, `latinExt`, `uzbekApostrophe`, plus `licensed: boolean` and `licenseNote`.

**Required:** write `scripts/check-fonts.ts`, which requests `https://fonts.googleapis.com/css2?family=<name>&subset=cyrillic` per family, parses `unicode-range`, and verifies coverage of `U+0400–04FF` and the presence of U+02BB. The registry is populated from the script's output, never from memory. A face that fails the check does not enter the registry.

Candidates to check: Cormorant Garamond, Cormorant Infant, Playfair Display, Prata, Forum, Tenor Sans, Old Standard TT, Alice, Philosopher, EB Garamond, Literata, PT Serif, Noto Serif Display, Golos Text, Onest, Manrope, Jost, Unbounded, Montserrat, Marck Script, Caveat, Bad Script, Comfortaa.

**On licensed faces.** Everything above is free and sits on millions of sites, including every template. It is a ceiling: Playfair and Cormorant are recognised instantly and read as "made quickly".

One purchased display face with good Cyrillic changes perception more than a month of work on everything else. Look at foundries that take Cyrillic seriously: type.today, Brownfox, CSTM Fonts, Paratype, Cyreal. Roughly $50–300 per style, one-off, web licence. **One** display face is enough; the body face can stay free and almost nobody will notice.

The registry must support local `@font-face` from `public/fonts/` alongside Google Fonts. Licensed files are gitignored; README documents where to obtain them.

Validation rejects any theme whose type set does not support `content.locale`.

---

## 17. Milestones

Stop after each one, show the result, wait for a reply.

**M0. Foundations.**
Repository, all three zod schemas, `toCssVars`, `validate` with a contrast function and unit tests, the font registry and a working `check-fonts.ts`.
*Accepted when:* `npm run check-fonts` prints a support table; the contrast test catches a knowingly bad pair.

**M0.5. Craft layer and design teardowns.**
Implement section 7.1 in full: Russian micro-typography with a test per rule, the space scale, load choreography, the accessibility floor.
Separately: I supply 5–8 links to studio work I consider the benchmark. You write a measured teardown of each — type scale, tracking, empty-to-content ratio, palette in hex, motion timings — into `docs/references.md`. Type sets and materials are then built as deliberate answers to those teardowns.
*Accepted when:* micro-typography tests are green; `docs/references.md` contains measured numbers rather than adjectives.

**M1. First template.**
Layout `scroll-narrative`, one `paper` material with foil, two type sets, all eight sections, fully theme-driven. Five themes written **by hand** in `projects/demo/concepts/`.
Work in a loop: build a screen → screenshot → write your own critique → rebuild. Minimum three loops on the first screen. Log findings in `docs/critique.md` so later presets do not repeat the same mistakes.
*Accepted when:* editing JSON alone gives me five invitations that look like the work of five different designers, with no component changed for any individual variant, and none identifiable as machine-made by the tells in 8.2.

**M2. Studio shell.**
Project list, questionnaire, media upload, iframe preview grid.
*Accepted when:* I can create a project from scratch and see the five hand-written themes in the grid.

**M3. Asset director.**
`/api/plan-assets`, the asset-plan schema, `DirectedImage`, editable focal points in the studio, unified treatment across the set.
*Accepted when:* a deliberately mixed batch — one studio frame, one flash phone snap, one low-res group shot — renders as one coherent set, with no face cropped and the low-res image never oversized.

**M4. Generation.**
`/api/generate` with the diversity matrix, parallelism, tool use, validation, auto-repair.
*Accepted when:* five themes arrive in ≤ 45 s, all pass validation, no two share a layout+material pairing, and none is the cream-and-terracotta default unless the brief asked for it.

**M5. Versioning and refinement.**
The immutable concept/version store, `/api/refine` with partial merge, history and restore in the studio.
*Accepted when:* "darker, drop the petals" changes exactly what was named and nothing else, and no approved version file is ever rewritten.

**M6. Visual QA.**
Playwright harness, the mechanical checklist, the narrow vision checks, QA badges in the grid.
*Accepted when:* a deliberately broken theme (overflowing heading, face cropped at the edge, sub-AA contrast) is caught by the pipeline before I see it.

**M7. Publishing.**
Public route, subdomains, OG image, `?guest=`, RSVP in `telegram` mode.
*Accepted when:* Lighthouse mobile ≥ 90 for Performance and Accessibility on a published invitation.

**M8. Second layout.**
`card-stack` with a dark palette and a glass material.
*Accepted when:* adding the layout required no change to the theme schema. If it did, the schema was wrong — record exactly what and why in `docs/decisions.md`.

---

## 18. Working rules

- A short plan before each milestone; a short report after, including any deviation from this spec.
- Small commits with meaningful messages.
- No stubs "to be finished later": if something is unimplemented, the milestone is not done.
- Do not invent theme fields on the fly — amend this spec first, then write code.
- Make ordinary engineering decisions yourself and keep going. Record decisions that constrain future architecture in `docs/decisions.md`.
- If the spec contradicts itself or something is missing, ask rather than guess.
- Error and empty states in the studio are written plainly: what happened and what to do. No apologies, no "something went wrong".

---

## 19. Backlog

Section variants worth building once the core is solid. Keep in `docs/backlog.md`, do not build early.

**Hero** — cinematic video, split hero, portrait hero, magazine-cover hero.
**Story** — editorial chapters, cinematic chapters, letter, split narrative.
**Gallery** — asymmetric masonry, editorial grid, full-screen image story, overlapping frames, film strip, scattered prints.
**Details** — luxury editorial, minimal, classic, typography-led.
**RSVP** — editorial form, minimal form.
**Other** — venue with map, music, schedule.

Each addition requires the same screenshot critique loop as M1. A variant that has not been through it does not enter the registry.
