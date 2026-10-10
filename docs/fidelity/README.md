# Brief fidelity and original artwork

One brief is interpreted into a visible design intent, shared palette and
five related compositions. The user explicitly authorized OpenAI Images.
`createVisual` opts into one original illustration for the series; at least
three visual placements are required. Named composition bases may repeat when
their visible arrangement differs. Text stays outside the bitmap.

The server uses the [Images generation API](https://developers.openai.com/api/reference/resources/images/methods/generate)
without references and the [Images edit API](https://developers.openai.com/api/reference/resources/images/methods/edit)
with uploaded references. Default requested model is `gpt-image-2`, high
quality, opaque WebP, 1536×1024. Up to 16 style inputs are supported; event
photos and event facts are excluded. There is one paid image request, no
automatic retry, no stock fallback and no added SDK dependency.

Artwork is decoded and normalized with Sharp, assigned a UUID and SHA-256,
and committed alongside its five immutable themes before the active batch
pointer changes. Prompt, requested model, dimensions and reference count are
saved locally. Stale revisions reject the result; history/selection remain
independent. Refinement can move the picture, but cannot forge its identity.
Asset reads verify the digest. Missing/inaccessible artwork prevents a valid
preview/QA, rather than silently hiding it.

## Acceptance

`imagegen-demo.png` is an original art plate created separately with the
built-in Imagegen tool; [its prompt](./imagegen-demo.prompt.txt) is preserved.
It served as the uploaded style reference in the production studio acceptance.
It is not a substitute for the runtime API call.

`openai-live.webp` is the second, independently generated image returned by
the real OpenAI Images reference-edit request from the studio. The fictional
Gatsby event used real Anthropic interpretation, real OpenAI artwork and
automatic browser/screenshot QA. [report.json](./report.json) records actual
provenance, shared intent, five arrangements and 15 viewport inspections.
Screenshots use fictional names and the existing fictional demo facts.

Final validation: 196 tests across 22 files; typecheck, lint and production
build pass. Five artwork placements were inspected at 390/1024/1440 px.
The reference acceptance finishes with no hard/incomplete QA findings or
browser errors; lab LCP and intentional alignment warnings remain visible.
The editor/new-project image option and hydration were also checked with a
browser timezone different from the server. A subsequent generation from the
user's saved brief uses the no-reference Images generation endpoint; its event
data/screenshots remain private under the ignored project directory.

The acceptance exposed two existing QA/UI timing issues: changing countdown
seconds between the real and magenta-glyph screenshot caused false contrast
failures; timezone-dependent QA timestamp formatting could cause hydration
mismatches. QA now uses [Playwright's fixed Date](https://playwright.dev/docs/api/class-clock#clock-set-fixed-time)
for its image/geometry phase, leaving timers and performance measurement live.
Report timestamps explicitly show UTC. The same paid-for image and themes are
rechecked after repairs; no extra image generation is needed.

Run a new paid acceptance explicitly:

```bash
STUDIO_QA_LIVE=1 node --env-file=.env.local scripts/qa-fidelity.mjs
```

To repeat QA/screenshots without another image request, set
`STUDIO_QA_REUSE_SLUG` to the retained `qa-fidelity-xxxxxxxx` fixture.
The script rejects other project names. Its temporary fixture stays ignored
under `projects/`; no private user event data belongs to this acceptance.

Limits: one shared illustration per batch, five compositions rather than five
independent art directions; two registered font pairings; semantic placement
choices rather than arbitrary model CSS. Taste and closeness to the customer's
intent still require human selection. Lab LCP/alignment warnings remain visible.
