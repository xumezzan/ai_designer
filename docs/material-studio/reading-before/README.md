# Проверка читаемости материальных сайтов

Результат:**FAIL**. Страниц:13/13. POST/генерация:0.

Проверены границы живого текста относительно viewport и родителей, ширина абзацев, последовательное личное поздравление и контраст финала по стандартной sRGB формуле WCAG. Порог:4.5 для обычного текста,3 для крупного. Фон изображения не считается надёжной подложкой текста.

- Existing published snapshots only. No registration, draft edit, upload, publication or AI generation request is sent.
- Default scope: the real burgundy silk greeting and authored porcelain greeting. MATERIAL_READING_ALL=1 includes the other two authored material scenes.
- Chromium with reduced motion at 320/390/430/768/1280/1664px and the live greeting without JavaScript at390px; physical phones, Safari and normal animation are not tested.
- Contrast uses computed CSS text colours and a near-opaque local footer plate, with conservative black/white backdrop bounds. Image pixels, shadows, texture and decorative pseudo-elements are not sampled.

## Ошибки

- p.material-site-eyebrow: No near-opaque local footer plate; contrast over artwork is not established
- p.material-site-closing: No near-opaque local footer plate; contrast over artwork is not established
- div.material-site-signature: No near-opaque local footer plate; contrast over artwork is not established
- a.material-site-top: No near-opaque local footer plate; contrast over artwork is not established
- h2#greeting-title: text glyph bounds escape parent section#greeting.invitation-section.greeting-section
- h2#material-story-title: text glyph bounds escape parent div.material-site-story-copy
- Personal greeting uses 2 grid columns (237.328px 296.672px)
- Personal greeting copy does not follow its heading vertically
- Personal greeting uses 2 grid columns (212.438px 265.562px)
- Personal greeting uses 2 grid columns (266.656px 333.344px)
- Personal greeting uses 2 grid columns (250.656px 313.344px)

Все размеры, CSS-цвета, контрастные коэффициенты, bounding boxes и файлы снимков:[report.json](report.json).
