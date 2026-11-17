# Local platform design acceptance

- Mode: **authored-fixtures**
- Result: **FAIL**
- Generation POSTs: 0; successful generations: 0; browser generation attempts blocked: 0.
- API scenarios: 5/5; browser pages: 20/20.
- Mobile pages use Chromium touch emulation, reduced motion and widths 320, 390 and 430. Desktop width is 1280.

| Scenario | Template | Hero | Font | Surface | Mobile evidence | Desktop opening |
| --- | --- | --- | --- | --- | --- | --- |
| Тёплая ботаническая свадьба | botanical | framed-arch | ceremony | soft-gradient | [Full page](botanical-wedding-390-full.png) | [Opening](botanical-wedding-1280-hero.png) |
| Вечерняя свадьба ар-деко | nocturne | fullscreen-cover | poetic | glassmorphism | [Full page](deco-wedding-390-full.png) | [Opening](deco-wedding-1280-hero.png) |
| Яркий типографический день рождения | modern | typographic-poster | modernist | flat | [Full page](poster-birthday-390-full.png) | [Opening](poster-birthday-1280-hero.png) |
| Редакционная история годовщины | editorial | split-editorial | editorial | flat | [Full page](editorial-anniversary-390-full.png) | [Opening](editorial-anniversary-1280-hero.png) |
| Личное поздравление без мероприятия | corporate | minimal-card | gallery | elevated-card | [Full page](personal-greeting-390-full.png) | [Opening](personal-greeting-1280-hero.png) |

## Scope and limits

- Authored registry-compatible fixtures test integration and responsive rendering. They do not test AI selection, new artwork or real AI design quality.
- Schema validity, token diversity and passing browser assertions do not establish that a design is beautiful. Review the saved mobile pages visually.
- Chromium emulates mobile touch at 320, 390 and 430 pixels. Physical phones, Safari, normal-motion animation and production hosting are not tested.
- The editorial anniversary intentionally has no photograph; personal photo upload, cropping and photographic art direction are not exercised.
- Small controls and text clipping candidates are reported as observations for visual review.

## Token distribution

```json
{
  "template": {
    "botanical": 1,
    "nocturne": 1,
    "modern": 1,
    "editorial": 1,
    "corporate": 1
  },
  "hero": {
    "framed-arch": 1,
    "fullscreen-cover": 1,
    "typographic-poster": 1,
    "split-editorial": 1,
    "minimal-card": 1
  },
  "font": {
    "ceremony": 1,
    "poetic": 1,
    "modernist": 1,
    "editorial": 1,
    "gallery": 1
  },
  "surface": {
    "soft-gradient": 1,
    "glassmorphism": 1,
    "flat": 2,
    "elevated-card": 1
  }
}
```

## Failures

- personal-greeting (1280px): A display word was split across lines

Raw browser observations and API assertions are in [report.json](report.json). All event data is fictional. QA accounts and drafts remain only in the isolated local data directory.
