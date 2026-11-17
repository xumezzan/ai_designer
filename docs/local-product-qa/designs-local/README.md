# Local platform design acceptance

- Mode: **authored-fixtures**
- Result: **FAIL**
- Generation POSTs: 0; successful generations in this run: 0; existing generations reused: 0; browser generation attempts blocked: 0.
- API scenarios: 0/5; browser pages: 0/20.
- Mobile pages use Chromium touch emulation, reduced motion and widths 320, 390 and 430. Desktop width is 1280.

| Scenario | Template | Hero | Font | Surface | Mobile evidence | Desktop opening |
| --- | --- | --- | --- | --- | --- | --- |

## Scope and limits

- Authored registry-compatible fixtures test integration and responsive rendering. They do not test AI selection, new artwork or real AI design quality.
- Schema validity, token diversity and passing browser assertions do not establish that a design is beautiful. Review the saved mobile pages visually.
- Chromium emulates mobile touch at 320, 390 and 430 pixels. Physical phones, Safari, normal-motion animation and production hosting are not tested.
- The editorial anniversary intentionally has no photograph; personal photo upload, cropping and photographic art direction are not exercised.
- Small controls and text clipping candidates are reported as observations for visual review.

## Token distribution

```json
{
  "template": {},
  "hero": {},
  "font": {},
  "surface": {}
}
```

## Failures

- botanical-wedding: POST /api/platform/invitations: HTTP 400: {"error":{"code":"VALIDATION_ERROR","message":"Проверьте поля формы","fields":[{"path":"draft.fontPairId","message":"Invalid enum value. Expected 'editorial' | 'classic' | 'modern' | 'romantic', received 'ceremony'"},{"path":"draft","message":"Unrecognized key(s) in object: 'purpose', 'ornamentSetId', 'composition'"}]}}
- deco-wedding: POST /api/platform/invitations: HTTP 400: {"error":{"code":"VALIDATION_ERROR","message":"Проверьте поля формы","fields":[{"path":"draft.paletteId","message":"Invalid enum value. Expected 'ivory' | 'sage' | 'midnight' | 'rose' | 'cinnabar', received 'ink'"},{"path":"draft.fontPairId","message":"Invalid enum value. Expected 'editorial' | 'classic' | 'modern' | 'romantic', received 'poetic'"},{"path":"draft","message":"Unrecognized key(s) in
- poster-birthday: POST /api/platform/invitations: HTTP 400: {"error":{"code":"VALIDATION_ERROR","message":"Проверьте поля формы","fields":[{"path":"draft.templateId","message":"Invalid enum value. Expected 'classic' | 'botanical' | 'nocturne' | 'heritage' | 'sculpted-garden', received 'modern'"},{"path":"draft.paletteId","message":"Invalid enum value. Expected 'ivory' | 'sage' | 'midnight' | 'rose' | 'cinnabar', received 'terracotta'"},{"path":"draft.fontP
- editorial-anniversary: POST /api/platform/invitations: HTTP 400: {"error":{"code":"VALIDATION_ERROR","message":"Проверьте поля формы","fields":[{"path":"draft.templateId","message":"Invalid enum value. Expected 'classic' | 'botanical' | 'nocturne' | 'heritage' | 'sculpted-garden', received 'editorial'"},{"path":"draft","message":"Unrecognized key(s) in object: 'purpose', 'ornamentSetId', 'composition'"}]}}
- personal-greeting: POST /api/platform/invitations: HTTP 400: {"error":{"code":"VALIDATION_ERROR","message":"Проверьте поля формы","fields":[{"path":"draft.templateId","message":"Invalid enum value. Expected 'classic' | 'botanical' | 'nocturne' | 'heritage' | 'sculpted-garden', received 'corporate'"},{"path":"draft.paletteId","message":"Invalid enum value. Expected 'ivory' | 'sage' | 'midnight' | 'rose' | 'cinnabar', received 'clay'"},{"path":"draft.fontPair
- harness: Not all API scenarios completed

0 !== 5


Raw browser observations and API assertions are in [report.json](report.json). All event data is fictional. QA accounts and drafts remain only in the isolated local data directory.
