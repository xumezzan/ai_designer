# Persistent appearance history

The customer editor's **Versions** tab provides an owner-only history of design
choices. The history persists across editor closure, browser reload and service
restart. It does not call an AI provider or spend generation quota.

## User flow

1. Save the current appearance with an optional name, or choose a previous
   successful AI result. The design before each successful generation is listed
   too. Existing jobs are read directly, without regenerating their artwork.
2. Selecting a card changes only the preview. The editor marks this preview and
   disables publication until the user returns to their draft or explicitly
   restores the selected appearance. Manual saving always saves the real draft,
   not an uncommitted historical preview.
3. **Restore appearance** saves outstanding editor changes first, checks the
   latest revision and replaces only template, palette, font pair, ornament,
   bounded composition, material art direction and artwork. Purpose, headline, names, date/time, language, venue, texts, section visibility, programme,
   dress-code facts and gallery photos retain their current values.
4. Before restoration, the current appearance is retained as a checkpoint unless
   an identical saved checkpoint already exists. Restoring the already-current
   appearance is a no-op. The guest version remains frozen until explicit
   publication through the existing publication button.

This is appearance history, not a full document history of every typed text
change. The immediate pre-generation restore action likewise applies the earlier
appearance to the latest draft without replacing later text or event edits.

## Domain and API

`lib/platform-design/schema.ts` defines a strict `InvitationDesign` projection:
`templateId`, `paletteId`, `fontPairId`, optional `ornamentSetId`, `composition`,
`artDirection`, `artwork` and `artworkWide`. Applying a design removes optional appearance fields
absent from the selected version; merely merging would retain a previous image
or parametric layout when restoring an older authored version.

`GET /api/platform/invitations/[id]/design-history` returns 20 owner-scoped
entries, each with a reference, source, timestamp, label and design. Subsequent
pages use an opaque invitation-bound cursor. Responses omit event facts,
prompts, provider keys, internal hashes and payment markers.

`POST` on the same route requires a same-origin owner session and one action:

```json
{ "action": "save", "label": "Warm porcelain", "expectedUpdatedAt": "current-revision" }
```

```json
{
  "action": "restore",
  "reference": { "kind": "generation", "requestId": "uuid", "phase": "after" },
  "expectedUpdatedAt": "current-revision"
}
```

A saved checkpoint reference is `{ "kind": "saved", "versionId": "uuid" }`.
Restoration checks the owner, invitation, revision and every media reference in
one store transaction. Failed or running generations cannot be restored. A
currently running generation blocks history mutations; archived invitations
must be restored before choosing a design. History and publication mutations
never call one another inside nested store transactions.

## Persistence and limits

Successful AI `generationJobs.before/after` provide the existing history.
The separate `designVersions` collection stores manual and before-restoration
checkpoints, defaulting to an empty array when reading older local state.
Checkpoints never masquerade as generation jobs, so saving/restoring cannot
change generation limits or paid-request idempotency.

There are at most 50 saved checkpoints per invitation. The service deduplicates
identical manual designs and refuses a new checkpoint at capacity rather than
silently deleting old versions. Historic images remain private unless referenced
by the current published snapshot. Deleting the invitation removes its saved
design checkpoints. The existing single-process local storage restrictions still
apply; this increment does not provision hosting or a new database.

## Verification

Unit and route tests cover persistence, owner boundaries, foreign media, stale
revisions, active jobs, pagination, history capacity, saved checkpoints,
preserved facts/publication and operation without provider configuration.
`scripts/qa-design-history.mjs` exercises editor save/preview/restore and job
recovery against a local server. Its generation requests are intercepted; it
makes no paid AI call. Reports are under `docs/platform-qa/history-local/`.
