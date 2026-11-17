# Appearance history acceptance — 2026-10-22

Local studio: `http://127.0.0.1:4310/`.
Open an invitation editor and select **Версии** / **Variantlar**.

## Verified

- Complete regression suite: **64 files / 563 tests passed**.
- TypeScript and ESLint passed. The optimized Next build succeeded with the new
  history route; its running production server passed the existing real HTTP
  auth, owner, publication, RSVP, CSRF and protected-image regression script.
- `report-all.json`: 10 browser checks. Manual appearance saving survives editor
  closure; preview uses the actual iframe without saving a draft; cancel clears
  selection; publication is disabled during a staged preview; restore flushes
  current text edits and preserves current facts and the guest snapshot. The
  before-restore checkpoint supports durable undo. Rapid restore clicks send
  one POST. Layout has no overflow at 320/390/430 px.
- Recovery checks reproduce a network error followed by a field edit inside the
  800 ms autosave debounce. PATCH now completes before recovery GET, preserving
  the edit. Running jobs are discovered from the server with empty browser
  session storage; checking status does not send another generation POST.
- `report-artwork.json`: two artwork files uploaded through the real owner media
  API are individually previewed in the iframe. Before/after list data is mocked
  for this UI-only check; the service tests separately cover real persisted
  generation-job history. Live job records were not changed for test fixtures.

All generation requests in browser tests are intercepted. **Zero paid provider
calls were made for this increment.** Other browser operations use actual local
account, draft, media, history and publication endpoints. Fictional accounts and
guest details are the only test inputs.

## Reproduce

Start the local server with a private writable data directory, then:

```bash
PLATFORM_QA_BASE_URL=http://127.0.0.1:4310 node --env-file=.env.local scripts/qa-design-history.mjs
PLATFORM_QA_BASE_URL=http://127.0.0.1:4310 PLATFORM_QA_PHASE=artwork node --env-file=.env.local scripts/qa-design-history.mjs
```

The QA harness needs `QA_PLAYWRIGHT_MODULE` and `QA_CHROME_EXECUTABLE` paths. It
creates fictional local accounts, invitations and uploads. Screenshots and JSON
reports are stored beside this file. Existing hosted deployments and their
access policy were not changed.
