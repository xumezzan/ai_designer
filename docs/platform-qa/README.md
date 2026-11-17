# Taklif Phase 1 verification — 2026-10-20

This is a local MVP acceptance record, not a production-readiness claim.
Existing uncommitted studio work and historical customer projects were retained.

## Automated verification

- `npm test`: **54 files, 495 tests passed**.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `INVITATION_BUILD_DIR=.next-platform-build npm run build`: passed after the
  final application changes. The build includes the public invitation, customer
  dashboard, platform APIs and legacy access middleware.
- `git diff --check`: passed. Temporary Next-generated changes to `tsconfig.json`
  were restored to the original configuration.
- Production HTTP regression suite passed at both `http://localhost:3100` and
  `http://127.0.0.1:3100`, using a temporary private data directory separate from
  customer data. It exercises register, cookie flags, owner isolation, draft
  privacy, optimistic conflicts, publish snapshots, disabled-content projection,
  RSVP create/edit, native URL-encoded RSVP, archive, logout, CSRF rejection,
  closed legacy operator routes and private-image optimizer rejection.
- Domain/route tests additionally exercise real Sharp image decoding, private
  media access before publication and after archive, invalid media, session
  expiry, scrypt, DST gaps/folds and serialized store writes across module copies.
- CSV tests neutralize formulas, including leading whitespace, and preserve
  quotes, line breaks, Russian and Uzbek text.

The first production HTTP test found an Origin mismatch at `127.0.0.1` because
Next's internal request URL used `localhost`. The fix compares the supplied
Origin with the actual Host plus request protocol, rejects foreign/opaque
origins and ignores `x-forwarded-host`. Both host variants passed afterward.

## Browser verification

Using fictional test accounts on the isolated production server, the browser
completed registration → draft creation → name/date/time/venue editing → live
preview → publication → public entrance → guest RSVP → response update → private
response dashboard. The updated RSVP remained a single response. Published
invitation data also survived restarting the test server.

All three authored invitation openings were visually inspected at **382 × 695**.
An earlier classic preview geometry check at **390 px** found no horizontal
overflow. The dashboard and editor were also inspected at **1280 × 720**.
Botanical was checked in Uzbek Latin. All six template/locale demonstration
routes returned HTTP 200 and explicit fictional-data labels.

Evidence:

- [Desktop dashboard](dashboard-desktop.jpg)
- [Mobile dashboard](dashboard-mobile.jpg)
- [Royal Ivory](classic-mobile.jpg)
- [Modern Botanical, Uzbek Latin](botanical-mobile.jpg)
- [Midnight Luxury](nocturne-mobile.jpg)

A transient Next development manifest `JSON.parse` error appeared during hot
compilation. Restarting the development server with its own
`.next-platform-dev` output directory restored the affected pages; all three
preview routes and the dashboard then returned successfully. The exact source
of the transient manifest error was not established. Keep simultaneous dev and
production builds in separate output directories.

## Practical limits

- This remains a single Node-process file repository; PostgreSQL, S3, encrypted
  managed backups, account recovery and commercial deployment are future work.
- No payment success, paid entitlement, AI generation, personal guest-token
  delivery or automated messenger sending is simulated.
- No live Fast 3G LCP/CLS/INP measurement, Lighthouse audit or physical iPhone
  test was performed for this increment. Screenshots do not establish those
  performance/accessibility budgets or every width from 320 to 430 px.
- Server validation messages remain Russian; customer controls, authored
  invitation labels and RSVP success flows support Russian and Uzbek Latin.
- The 12-image quota counts retained uploaded files, including files removed
  from a draft. Published media must remain available until its snapshot changes.
- `npm audit --omit=dev` reported zero vulnerabilities. The full audit reported
  five high entries from one unpatched dev-only `braces` advisory propagated
  through ESLint. Details and the primary advisory are in the architecture doc.

See [scope, security boundaries and PostgreSQL migration](../platform-mvp.md).
