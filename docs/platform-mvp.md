# Premium Invitation Platform: Phase 1

This document records the scope and architecture of the first SaaS increment.
It distinguishes the working local MVP from the infrastructure required before
a commercial production launch. The existing Invitation Studio remains an
independent operator tool; historical projects are not silently assigned to a
new customer account.

## Existing project and the gap

The repository already has a suitable presentation stack: Next.js App Router,
strict TypeScript, React, Zod, authored templates, Motion, local licensed fonts,
and Sharp image processing. `Content`, `Theme` and `AssetPlan` separate event
facts, design tokens and protected photo direction. `registry/studioTemplates.ts`
provides six complete template compositions with compatible palette/font IDs.
The mobile renderer, calendar links, reduced-motion handling, immutable design
versions, live studio editor and visual QA can be reused.

The original studio is a single-user filesystem application. Its project
records have no user ownership, its routes assume a trusted operator, and its
RSVP form forwards to an external destination rather than storing replies.
Creating a customer login alone would not turn those records into safe
multi-tenant data.

| Requirement | Before this increment | Phase 1 scope |
| --- | --- | --- |
| Account and authorization | No users or sessions | Persistent account/session records and owner-scoped operations |
| Customer dashboard | Operator project list | Customer invitation list and draft editor |
| Premium templates | Six authored studio templates | Three curated choices: `classic`, `botanical`, `nocturne`; four registered palettes and three registered font pairs |
| Editing and preview | Operator studio editor | Form editing with a live preview using the existing renderer |
| Publishing | Internal preview URLs | Frozen public snapshot at `/i/[slug]` |
| Guest response | Phone, Telegram or external form | Stored `yes`, `no`, `maybe` responses; private organizer list |
| Languages | Renderer supports several locales | Russian and Uzbek Latin customer flows |
| Payments | None | Deferred; no successful payment simulation or paid entitlement activation |
| Database | `projects/` filesystem store | Separate local repository; PostgreSQL migration design below |

## Architecture decision

Keep one Next.js application for this increment. Adding a FastAPI service now
would duplicate validation and deployment work without an existing Python
backend or database to reuse. The user's preferred FastAPI/PostgreSQL/S3 stack
remains a viable production direction; PostgreSQL and managed object storage
are the next storage adapters, independent of the renderer.

The customer domain lives in `lib/platform/`, separate from `lib/studio/` and
the legacy `projects/` directory. Route handlers perform authentication, request
validation and authorization; the repository persists users, sessions,
invitations, publication snapshots and responses. The renderer receives a
validated adapter into existing `Content`/`Theme` values. A template ID selects
authored code; request data cannot introduce arbitrary HTML, CSS, script or font
URLs. Customer palette/font choices are deliberately available across all three
templates and map to bounded existing registry tokens; they do not use the
legacy studio's per-template palette/font compatibility list. The initial manual
flow does not require AI. The subsequent Ivory Atelier increment adds an
explicitly requested server-side AI generation path, documented in
[platform-ai.md](platform-ai.md). Guest replies are never input to generation.

There are three distinct surfaces:

1. **Customer editor:** authenticated, owner-scoped, saves draft data.
2. **Draft preview:** same-origin parent/editor communication and schema
   validation; draft data does not become a public database record through the
   preview route.
3. **Published invitation:** loads the last explicit publication snapshot.
   Saving a draft must not silently replace what guests see.

Publishing requires every supplied host name to be nonempty, a civil date and
explicit time; a visible venue requires its name. Drafts may leave those values
empty.
Date-only drafts retain the civil day without inventing a midnight countdown.
The existing IANA wall-time resolver rejects both DST gaps and ambiguous folds.

Publication strips disabled section fields from the public snapshot; the
private draft retains them for editing. Public reads apply the same projection
to older snapshots as well. The dashboard's internal title is replaced with
visible host names for every event type, so that administrative text is not
included in guest JSON or browser props.

Publishing is an explicit state transition. Archiving removes public access;
previously downloaded information cannot be recalled. Public links are
shareable bearer links, not a claim of confidential guest authentication.
Personalized invitations and a preloaded guest registry belong to Phase 2.

## Local persistence and authentication

The local adapter writes `.platform-data/state.json` and keeps processed media
in the same private data root. `PLATFORM_DATA_DIR` can select an absolute
persistent directory. JSON replacement is atomic and mutations use a
process-local mutex shared by route module copies. The data directory and state
file use restrictive permissions on creation; the operator must also secure any
pre-existing custom data volume. This is **not SQLite**, and no PostgreSQL server is installed or
implicitly configured by this increment.

Run exactly one long-lived Node process with a durable writable volume. Do not
run replicas, cluster workers, independent processes sharing the data file, or
an ephemeral/serverless deployment: the mutex is not distributed, and atomic
replacement does not provide multi-process transactions. The adapter exists
to validate product behavior locally before a database deployment.

Passwords require 10–128 characters and use salted scrypt (`N=32768`, `r=8`,
`p=1`). Sessions use random
32-byte opaque tokens, store only SHA-256 token digests server-side, and have
an absolute seven-day expiry. The session cookie is HttpOnly and SameSite=Lax;
production cookies require HTTPS through Secure. Logout revokes the stored
session. A configured production HTTPS origin is necessary for deployment;
untrusted forwarded headers must not define authorization or trusted origins.

Local uploads accept JPEG, PNG and WebP signatures followed by actual image
decoding. Sharp limits input to 40 million pixels, normalizes orientation,
resizes within 2000 × 2000 and re-encodes as WebP. The input file limit is 8 MiB;
the streamed multipart request is bounded separately. Filenames and owner
identities are generated by the server. Private media belongs to its owner;
public access is limited to media referenced by a published snapshot.

The local store caps each owner at 50 invitations, each invitation at 12 stored
images and each invitation at 5000 RSVP responses. Removing an image from a
draft does not delete its stored media record or release that upload slot;
retention protects an existing published snapshot. Replacing many images needs
a future reference-aware media cleanup operation.

## User scenarios and acceptance criteria

| Scenario | Expected behavior |
| --- | --- |
| Register and return later | A new customer can create an account, log out and log back in after server restart; passwords and raw session tokens are absent from stored records |
| Create an invitation | Choose a supported event category and one of three templates; an owned draft appears in the dashboard |
| Edit event facts | Names, text, civil date, optional draft time and venue remain editable; timezone is stored as an IANA name; the current form defaults to Asia/Tashkent |
| Edit design | Select bounded registered palettes and font pairs; both long Russian and Uzbek names stay readable |
| Upload a photo | Valid images are processed; malformed, oversized and foreign-owned files are rejected |
| Preview | Changes render in a phone or desktop canvas without making the draft public; same-origin and message-source checks reject foreign messages |
| Save and reload | Draft persists across page reloads; requests carrying stale `expectedUpdatedAt` return a conflict instead of overwriting a newer revision |
| Publish | Only explicit publication creates/replaces the frozen snapshot and shareable `/i/[slug]` URL |
| Edit an already published draft | Guests continue to see the earlier snapshot until another publication |
| Reply as a guest | An open published invitation accepts `yes`, `no`, or `maybe` plus the allowed party size; an archived/draft invitation accepts no replies |
| Correct a reply | Only possession of that response's unpredictable edit token permits an update; a name alone is never an authorization identifier |
| Inspect responses | Only the invitation owner can read response names, counts and private messages |
| Switch customer language | Russian and Uzbek Latin customer strings come from a locale dictionary; adding a language does not require rewriting renderer components |
| Archive | Public content and public media access disappear; owner records remain available in the dashboard |
| Attempt cross-account access | Another signed-in account receives no invitation, media or RSVP data, even with a known UUID or slug |

The editor debounces draft saves by 800 ms, sends its current `updatedAt` as an
optimistic revision and reports failed saves. Publish, unpublish and archive
also send the current revision, so a stale tab cannot publish another tab's
unreviewed draft. API callers must also include
`expectedUpdatedAt` to request stale-write protection: the local API currently
permits omitted revisions. Conflicts require reloading and reconciling edits;
there is no automatic cross-tab merge.

The guest page remains readable without JavaScript. RSVP accepts a native
URL-encoded form POST, persists the response and redirects with a localized
confirmation. With JavaScript, the form additionally retains its response edit
token in localStorage; native submission does not persist an editing capability
in the browser and therefore cannot promise repeat editing.

The basic open RSVP form does not verify real-world identity or preloaded guest
membership. Anyone with the public URL can submit a response. Returning guests
need the edit token retained by their browser; clearing browser storage loses
that convenience. Cross-device response editing and invitation-specific guest
tokens require Phase 2 identity semantics. Do not advertise current response
totals as an authoritative count of uniquely invited people.

Russian and Uzbek Latin navigation/forms and public RSVP labels are present.
Server validation/authentication error messages currently remain Russian. This
is a localization limit, not a claim that all messages are translated.

The organizer response view supports name search, status/party totals and a
CSV export of names, attendance and party size. Guest-supplied formula prefixes
are escaped before export. This is a response list; no preloaded guest registry
or CSV import is implemented.

## Security boundary and threat model

Assume that public visitors control every URL, identifier, request body, uploaded
file and browser message. A valid customer session does not grant access to
another customer's data. Drafts, emails, password hashes, session records and
guest responses are private. Published event facts and explicitly published
photos are public to anyone who receives the link.

| Threat | Required boundary |
| --- | --- |
| Object-ID enumeration | Check owner on every private repository operation; unpredictable IDs are supplementary protection |
| Session theft from storage | Persist token digests; restrict cookie access and expiry; protect the private data volume |
| Cross-site mutation | Verify trusted Origin on cookie-authorized mutations; use SameSite cookies and bounded input |
| Stored script injection | Render text as React text; schema-bound design tokens; no supplied raw HTML or arbitrary style execution |
| Image decompression/resource abuse | Bound request and decoded image size, format, dimensions and count before durable storage |
| Draft/public media leakage | Read media through owner checks or the exact published snapshot; disable shared caching for private responses; prevent the image optimizer from creating separately cached copies of revocable media |
| RSVP spoofing | Treat open-form answers as unverified; protect edits with a high-entropy token and do not list replies publicly |
| Metadata leakage | Generic Open Graph/share copy, no guest names, tokens, private messages or guest lists in metadata |
| AI data disclosure | No platform AI calls; later AI features require a separate minimal-data contract and consent where necessary |
| Legacy route bypass | Keep the operator studio outside customer authorization; do not assume a customer session owns any legacy project |

Before exposure beyond a controlled local pilot, add deployment-level shared
rate limits, abuse controls, account recovery/email verification, security
monitoring, HTTPS configuration, data-retention/deletion policy and tested
backup recovery. A per-process limiter, if present, is only a local safeguard
and resets with the process. These operational controls are not implied by
passing unit tests.

### Legacy studio access

The existing `/studio/**`, project APIs, generation/refinement/approval APIs,
non-demo `/preview/**`, generated `/art/**` and QA evidence APIs have no
customer ownership mapping. Their original same-host mutation check is not
authentication. `/studio` enumerates all local projects, and a non-demo preview
can render any stored version without a publication decision. Existing artwork
responses also historically advertise a long public immutable cache lifetime.

Production middleware denies this operator surface by default while preserving
explicit fictional demo previews. A hosted operator studio would require a
separate operator-only access policy with a carefully configured worker path.
Checking only whether *some* customer is logged in is insufficient. Local
development can retain the existing studio for its single trusted operator.
Never use a client-supplied Host header as proof of a local caller. Explicit
fictional demo routes can remain public without exposing real projects. The
middleware also rejects optimizer requests for revocable platform media and
legacy project/art sources, preventing Next's separate public image cache from
outliving a publication decision.

Legacy visual QA loads previews through a local browser process, so an operator
gateway must also authenticate that worker or run the legacy studio separately.
Do not disable the QA safety gate merely to make a customer publishing flow
work. The customer templates use their separate validated publishing workflow.

## PostgreSQL target model

This is the proposed production schema, not a claim that tables already exist.
Use UUID primary keys, `timestamptz` for instants, civil `date`/`time` fields for
event facts, and IANA timezone names. Keep immutable publication snapshots
schema-versioned to preserve old links when templates evolve.

| Table | Main columns and constraints |
| --- | --- |
| `users` | `id`, unique normalized `email`, `password_hash`, `display_name`, `locale`, `created_at`, `disabled_at` |
| `sessions` | `id`, `user_id` FK, unique `token_hash`, `expires_at`, `created_at`, `revoked_at`; index expiry and user |
| `workspaces` (B2B extension) | `id`, `name`, `created_at`; introduce when agency sharing is required |
| `workspace_members` (B2B extension) | `workspace_id`, `user_id`, bounded `role`; unique membership |
| `invitations` | `id`, `owner_id` FK, unique `public_slug`, `status` check (`draft`, `published`, `archived`), `draft_json` JSONB, `draft_revision`, timestamps |
| `publications` | `id`, `invitation_id` FK, monotonically increasing `version`, `schema_version`, `snapshot_json` JSONB, `published_at`; unique invitation/version |
| `invitation_publication` | `invitation_id` PK/FK, `publication_id` FK; atomic pointer to the active frozen publication |
| `media` | `id`, `owner_id` FK, `invitation_id` FK, unique private `object_key`, `sha256`, MIME, width/height, bytes, `created_at`; reject cross-owner association |
| `publication_media` | `publication_id`, `media_id`; exact public-media allowlist without exposing unused draft uploads |
| `rsvp_responses` | `id`, `invitation_id` FK, `display_name`, `attendance` check, `party_size` check, private note, unique `edit_token_hash`, timestamps |
| `guests` (Phase 2) | `id`, `invitation_id` FK, private name/group, allowed party size, unique hashed personal token, `revoked_at` |
| `events` (Phase 3) | `id`, `invitation_id` FK, event category, civil date/time, timezone, venue JSONB, position |
| `guest_events` (Phase 3) | `guest_id`, `event_id`, per-event RSVP and allowed party size; unique guest/event |
| `plans` (Phase 2) | stable key, currency, integer amount in minor units, versioned limits/features, active flag; no UI-only pricing authority |
| `payments` (Phase 2) | `id`, owner/invitation FK, provider, unique provider reference, expected amount/currency, bounded status, confirmed timestamps |
| `payment_events` (Phase 2) | unique provider event ID, verified payload digest, processing result; replay-safe webhook handling |
| `entitlements` (Phase 2) | owner/invitation FK, plan/version, source payment FK, validity; activate only after verified provider confirmation |

Use a transaction for account/email uniqueness, session creation/revocation,
publish plus media references, and response updates. Update drafts with
`WHERE id = ... AND owner_id = ... AND draft_revision = ...`; an affected-row
count of zero requires owner/not-found/conflict handling. Public reads must join
the active publication and check invitation status, never select `draft_json`.
RLS can add defense in depth, but does not replace application authorization.
Limit guest-data access in both queries and serialized response DTOs.

## Migration without losing the studio

1. Back up `projects/` and the private platform data root while the single Node
   process is stopped; verify that the copy can restore into a separate local
   environment. Include processed media, not only the JSON state.
2. Add a PostgreSQL repository behind the existing domain API; run the same
   authorization/publication/RSVP contract tests against both adapters.
3. Import only the new customer store first. Preserve IDs, password parameters,
   session/token hashes, draft revisions, publication versions and references.
   Validate every record and compare counts/digests before switching reads.
4. Upload processed media to a private S3-compatible bucket and persist stable
   object keys. Public delivery must consult current publication authorization;
   avoid perpetual public cache URLs if archiving must revoke access promptly.
5. Perform a bounded maintenance-window cutover, with no concurrent writes to
   both stores. Retain the original private local store read-only for recovery.
   Test draft edits, archive behavior, response edits and isolation after cutover.
6. Import legacy studio projects only through an explicit operator workflow
   assigning a verified owner and copying a chosen version. Historical themes,
   artwork, approvals and QA evidence stay intact. Do not infer an owner from a
   public slug, person name, filesystem timestamp or arbitrary logged-in user.
7. Add managed encrypted backups, restore exercises, retention rules and
   observability before enabling multiple app replicas or commercial traffic.

## Incremental development plan

1. **Inventory:** inspect current routes, schemas, tests and template contracts;
   identify operator-only surfaces and preserve the existing store.
2. **Domain and security:** implement validated account, session, ownership,
   draft, publication and response operations with isolated data storage.
3. **Customer workflow:** build sign-in/register, invitation list, category and
   template selection, simple form editor and persistent draft save.
4. **Guest surface:** reuse the authored renderer, add private preview, explicit
   publication, archive and native stored RSVP with owner-only response access.
5. **Verification:** run relevant domain tests, existing renderer regressions,
   strict TypeScript, lint and production build. Exercise real cookie/HTTP flows,
   two-account isolation, publish/edit/archive boundaries and mobile layouts.
6. **Next production increment:** PostgreSQL + object storage, deployment access
   controls, recovery, account lifecycle and abuse protection.
7. **Phase 2:** verified payment integration, real entitlements, personal guest
   links, statistics, additional authored themes and multilingual content.
8. **Phase 3:** multiple wedding events and guest lists, seating, agency accounts,
   carefully scoped AI assistance and measured analytics.

Uzbek Cyrillic, in-invitation language switching, automated messaging, music,
CSV import, QR generation and paid subscriptions require explicit later
implementation and verification. Their presence in the product brief is not
evidence that this Phase 1 increment implements them.

## Dependency audit, 2026-10-20

`npm audit --json` reports five high entries propagated from one development
tool advisory: `eslint-config-next@15.5.27` → `@next/eslint-plugin-next` →
`fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`. The
[reviewed braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
describes stack exhaustion from deeply nested glob patterns and currently lists
no patched version. Registry inspection also reports `3.0.3` as the latest
published braces release. There is no patch/minor upgrade that currently
removes this advisory. The suggested `eslint-config-next@14.2.35` is a major
downgrade and is not a suitable automatic fix for this Next 15 project.

`npm audit --omit=dev --json` reports zero known production dependency
vulnerabilities at this check. That result does not prove absence of application
or undisclosed dependency flaws. Keep lint tooling confined to trusted local/CI
configuration; do not accept customer glob patterns. Recheck the advisory when a
maintainer fix is available. No dependency version was changed as part of this
audit.

## Evidence-driven maintenance

The user's referenced [OpenAI maintenance article](https://developers.openai.com/blog/maintaining-software-with-the-gpt-6-family)
was verified against the official source. Its applicable guidance is to start
with a small scope, gather evidence from indirect consumers, configuration and
history, preserve operational safeguards, and expand after review. Here that
means reusing the existing renderer and retaining the legacy studio behind an
explicit boundary, rather than deleting older generation paths because the new
customer UI does not call them.

Verification results belong in the implementation report. This architecture
document is not a production-readiness attestation.
