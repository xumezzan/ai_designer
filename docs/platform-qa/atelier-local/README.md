# Ivory Atelier local acceptance — 2026-10-22

Local application: `http://127.0.0.1:4310`.
Fictional published invitation: `/i/invite-49fbdf73e77b56c9891d3165`.
Private runtime records are outside the repository in the local data directory.

## Actual provider run

- One Anthropic art direction call and one OpenAI image request succeeded.
- Job `997dcb3c-5821-45ac-8c86-0702d9f2c093` completed in about 59 seconds.
- Result: original 1024 × 1536 porcelain magnolias/limestone artwork; editable
  greeting/closing copy. Names, explicit event date/time, venue and programme
  remained unchanged.
- Replaying the identical request returned the same result. Persisted provider
  call markers remained `{ planner: 1, image: 1 }`.
- Artwork returned 404 anonymously before publication and rendered after explicit
  publication. Guest generation history returned 401. Foreign-origin POST returned
  403 `INVALID_ORIGIN` through a real HTTP request.
- Owner draft edit returned 200 while the guest snapshot retained its prior
  greeting. The draft was restored to the reviewed design afterwards.
- Guest RSVP saved two attendees; owner response listing included it and did not
  expose its editing capability.

## Browser and regression checks

`browser-report.json` and `generated-390.png` / `generated-1280.png` come from
`scripts/qa-platform-ai.mjs`. The script makes no paid request and checks the
already generated fictional invitation at 320, 390, 430, 1024 and 1280 px.
All widths had no horizontal overflow, duplicate IDs or page errors. Artwork
remained inside the hero on all sizes. Guest content and a native RSVP form
were present with JavaScript disabled.

Wizard browser QA used real local authentication/draft/media routes and a mocked
generation response: registration resumes the wizard, reference uploads remain
out of the guest gallery, 502 triggers bounded GET recovery without another
automatic POST, reopening restores the form, and explicit retry after terminal
failure uses a new request UUID. Those checks made zero paid provider calls.
`wizard-report.json` contains the results. `editor-report.json` additionally
records real autosave/restore checks with mocked AI results, rapid-click
deduplication and GET recovery; these also made zero paid calls.

The optimized Next build completed successfully. Its running production server
passed `scripts/platform-http-smoke.mjs` for auth, ownership, publication
snapshots, hidden fields, conflicts, RSVP/native submission, archive/logout,
CSRF, protected-image caching and blocked historical operator routes.
The complete Vitest suite passed 62 files / 549 tests. ESLint and TypeScript
passed; editor feedback text was rechecked after the final UI changes.

## Scope

This is a local reviewed workflow. Public hosting, payments, PostgreSQL/object
storage, a durable background job worker and multiple server processes remain
outside this increment. The dimensional materials are raster art rather than
live WebGL geometry. Generated-image quality is stochastic; the real-provider
acceptance above covers one supplied art direction, not every possible brief.
