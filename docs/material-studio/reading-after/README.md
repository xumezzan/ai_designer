# Проверка читаемости материальных сайтов

Результат:**FAIL**. Страниц:25/25. POST/генерация:0.

Проверены границы живого текста относительно viewport и родителей, ширина абзацев, последовательное личное поздравление и контраст финала по стандартной sRGB формуле WCAG. Порог:4.5 для обычного текста,3 для крупного. Фон изображения не считается надёжной подложкой текста.

- Existing published snapshots only. No registration, draft edit, upload, publication or AI generation request is sent.
- Default scope: the real burgundy silk greeting and authored porcelain greeting. MATERIAL_READING_ALL=1 includes the other two authored material scenes.
- Chromium with reduced motion at 320/390/430/768/1280/1664px and the live greeting without JavaScript at390px; physical phones, Safari and normal animation are not tested.
- Contrast uses computed CSS text colours and a near-opaque local footer plate, with conservative black/white backdrop bounds. Image pixels, shadows, texture and decorative pseudo-elements are not sampled.

## Ошибки

- h2#greeting-title: text glyph bounds escape parent section#greeting.invitation-section.greeting-section
- h2#material-story-title: text glyph bounds escape parent div.material-site-story-copy
- h2#dress-title: text glyph bounds escape parent section#dressCode.invitation-section.dress-section
- h2#timeline-title: text glyph bounds escape parent div.timeline-heading
- p.material-greeting-salutation: text glyph bounds escape parent div.material-greeting-prose

Все размеры, CSS-цвета, контрастные коэффициенты, bounding boxes и файлы снимков:[report.json](report.json).
