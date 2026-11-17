# Local wizard UI acceptance

Result: **PASS**. Mode: **mocked generation**.

Completed scenarios: 2/2. Intercepted generation POSTs: 2. Provider POSTs forwarded: 0.

- Generation responses are mocked at the browser route. No provider or real AI design quality is tested, and no paid generation POST reaches the server.
- Registration, wizard draft persistence, editor rendering, appearance autosave and reload use the actual isolated local platform API.
- Mobile Chromium touch emulation at 390 pixels; physical phones, Safari and production hosting are outside this check.

## birthday-invitation

Wizard → persisted draft → mocked generation → actual preview iframe → palette/font autosave → reload.

- [birthday-invitation-390-wizard-facts.png](birthday-invitation-390-wizard-facts.png)
- [birthday-invitation-390-wizard-design.png](birthday-invitation-390-wizard-design.png)
- [birthday-invitation-390-editor.png](birthday-invitation-390-editor.png)
- [birthday-invitation-390-editor-iframe.png](birthday-invitation-390-editor-iframe.png)

## personal-greeting

Wizard → persisted draft → mocked generation → actual preview iframe → palette/font autosave → reload.

- [personal-greeting-390-wizard-facts.png](personal-greeting-390-wizard-facts.png)
- [personal-greeting-390-wizard-design.png](personal-greeting-390-wizard-design.png)
- [personal-greeting-390-editor.png](personal-greeting-390-editor.png)
- [personal-greeting-390-editor-iframe.png](personal-greeting-390-editor-iframe.png)

## Failures

No automated failures.

Full assertions and fictional request facts: [report.json](report.json).
