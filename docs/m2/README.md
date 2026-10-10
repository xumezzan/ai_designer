# M2 — Studio shell

The studio is available at `/studio`. `/` redirects there. `/studio/new`
starts an empty questionnaire; `/studio/<slug>` edits the project and shows
photos, design references and five iframe previews. Studio UI is Russian.

## Implemented

- Project list, creation, editing, server validation and readable errors.
- Hosts, event type, locale, greeting, local date/time and IANA timezone,
  countdown, venue/map, programme, dress-code swatches, RSVP and design brief.
- Five immutable v1 themes copied from the latest hand-authored demo snapshots,
  including Suzani Atelier. New projects never modify the demo or its themes.
- Photo/reference uploads, thumbnails, removal from project, 15 MiB/file limit,
  actual decoder verification, JPEG/PNG/WebP input, orientation normalization,
  WebP conversion and a 2400px output bound. Maximum 40 images/project.
- Phone/desktop iframe grid with container-aware scaling, lazy loading,
  load feedback and keyboard-accessible fullscreen dialog (Escape closes).
- Explicit saved-versus-unsaved preview status. Save refreshes previews.
  Pending edits survive uploads; stale saves return 409 rather than silently
  overwriting another tab. Navigation warns before discarding unsaved edits.

## Storage and boundaries

Projects use the existing `projects/<slug>` layout. Creation assembles a hidden
temporary directory and renames it into place. Updates acquire an exclusive
project lock, check a SHA-256 content revision, and atomically replace
`content.json`. Theme snapshots are never rewritten. Photos/references remain
server-owned on questionnaire updates, preventing an old form from erasing uploads.

Image files live in the gitignored project media directory. A project-scoped
route serves only currently referenced WebP files with `private, no-store` and
`nosniff`. Thumbnail images bypass Next's public optimizer cache. Source EXIF
is removed by decoding and encoding. Removing an image removes its project
reference and serving permission; original bytes are retained on disk for future
snapshot support. This is not a physical file purge feature.

Write requests reject foreign origins, comparing the browser origin with Host
because Next uses an internal localhost request URL. IDs reject path traversal.
The demo is read-only. This remains a single-user local tool, without auth.
Running the store requires a persistent writable project directory; a read-only
serverless deployment needs a later storage/deployment decision.

Event wall times are resolved through IANA timezone rules, not the workstation
timezone. DST gaps and repeated times are rejected explicitly. The schema stores
the resolved ISO timestamp with its offset. Studio date inputs have minute precision.

No invitation schema field or production dependency was added. Sharp is the
existing Next dependency; browser QA uses the supplied external Playwright runtime.
Theme AI generation, vision reference analysis, photo placement/cropping,
approval/history and publishing remain M3–M7. Briefs and references are saved;
the five choices are hand-authored themes, not claimed AI outputs.

## Verification

`npm test`: 124 passing tests. TypeScript, ESLint and production build pass.
Store tests exercise fresh snapshots, duplicate IDs, immutable themes, stale
revisions, traversal/reserved IDs, upload decoding, refs/photo separation,
failed-upload cleanup and timezone edge cases. HTTP origin regression covers
Next's internal request URL.

`scripts/qa-studio.mjs` runs the real browser workflow: create an empty project,
fill a programme/dress code/RSVP, upload photo and reference, preserve an unsaved
greeting through those uploads, save, remove a photo, reject a malformed file,
check all five live iframe headings, open/close the dialog and reload persisted
facts. It also checks duplicate/stale writes and foreign-origin/invalid bodies.
Temporary QA projects are removed after the run. All screenshots use fictional
event data and the project's existing decorative art as upload fixtures.

Every studio section passes no-horizontal-overflow checks at 320, 390, 768 and
1440px. Screenshot critique increased phone previews and kept the entire desktop
iframe visible, and shortened mobile navigation so all tabs fit. Runtime errors
are captured in [qa.json](./qa.json). This is an M2 browser regression workflow,
not the future M6 invitation QA/Lighthouse pipeline.

Repeat against a running server using `node scripts/qa-studio.mjs` with Playwright
available. If using the app's bundled runtime, set `STUDIO_PLAYWRIGHT_MODULE` to
its `playwright/index.mjs` and `STUDIO_CHROME` to a local Chrome executable.
`STUDIO_QA_URL` selects a server; `STUDIO_QA_MODE=production` labels the report.

Screenshots: [project list](./list-desktop.jpg), [questionnaire](./questionnaire-desktop.jpg),
[uploads](./media-desktop.jpg), [design grid](./grid-desktop.jpg), [mobile](./grid-mobile.jpg).
