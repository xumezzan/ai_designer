# Invitation design refresh · 2026-10-10

The invitation renderer now uses a stronger display hierarchy, a compact first
screen and varied section rhythms. Letter, poster, folio, arch and botanical
retain their individual compositions and stored section order. The folio gains
an outlined host monogram; the embroidered Suzani art keeps its original frame
proportions. Palette, typography and material still come from theme tokens.

The generation prompt now asks for one deliberate visual archetype and one
dominant motif. Typography-led briefs can omit ornament; original illustrations
take priority over additional procedural frames. These decisions apply to new
generation. Existing immutable themes have not been rewritten.

## Guest experience

- `unfold` opens a native modal envelope by click, upward swipe or Escape, then
  reveals the names and later sections. `drift` uses section reveals without
  the envelope; `still` is static. Fine-pointer RSVP actions have a bounded
  magnetic movement. Reduced motion skips the envelope and animations.
- `?to=Александр` or `?guest=Александр` personalizes the cover, first screen,
  greeting and form name. Query names are bounded, escaped and display-only.
- Fabric swatches replace exposed color codes. Selecting a shade updates two
  illustrative outfit silhouettes and announces the selection.
- Form-mode RSVP uses two steps, validates the name before advancing, retains
  the existing native POST contract and permits returning to the first step.
  Phone and Telegram invitations retain their configured contact actions.
- The calendar action offers Google Calendar and an `.ics` download for
  Apple/Outlook. Both preserve the supplied event instant and timezone; an end
  time is not invented. ICS text is escaped and folded by UTF-8 octets.
- The invitation remains readable without JavaScript. Form mode renders all
  native fields in that case. `?embed=1` bypasses the envelope for studio previews.

## Verification

`npm run build`, `npm run lint`, `npm run typecheck` and all 221 tests pass.
The browser check exercises five demo compositions at 320, 390, 768, 1024 and
1440px, plus five existing generated-art compositions at 390, 1024 and 1440px.
It checks geometry, text collisions/clipping, local fonts, touch targets,
reduced motion and raster contrast on the demos. The report also records guest
personalization, palette selection, calendar links, envelope click/swipe/Escape,
scroll reveals, embed bypass, no-JS content and POST to an intercepted local
test receiver. No generation API or real external receiver is called.

Renderer fingerprints include the new CSS, components and typography, so
previous visual QA reports become stale when the design changes. QA excludes
unpainted closed dialogs/details and hidden form steps from measurements.

Evidence: [report](./report.json), [paper desktop](./after-letter-1440.jpg),
[paper mobile](./after-letter-390.jpg), [night desktop](./after-folio-1440.jpg),
[night mobile](./after-folio-390.jpg), [Suzani mobile](./after-arch-390.jpg),
[envelope](./envelope-390.jpg), [generated art](./generated-1440.jpg).
The [final interaction report](./report-interactions.json) additionally verifies
a native Chrome touch gesture and opening the envelope in landscape orientation.

Run the browser check with an installed Playwright module and Chrome:

```sh
QA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
QA_CHROME_EXECUTABLE=/absolute/path/to/chrome \
STUDIO_QA_URL=http://127.0.0.1:3147 \
node scripts/qa-design-refresh.mjs
```

`STUDIO_QA_ART_SLUG` optionally adds an existing disposable `qa-fidelity-*`
project. `STUDIO_QA_INTERACTIONS_ONLY=1` runs interaction checks separately.
