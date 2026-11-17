# Проверка материальных сайтов

Результат: **FAIL**. API-сценарии: 3/3. Браузерные страницы: 13/13. Вызовы генерации: 0.

| Сцена | Композиция | Мобильная страница | Десктоп | Локальная ссылка |
| --- | --- | --- | --- | --- |
| Шёлк и винная каллиграфия | editorial | [390px полностью](silk-wedding-390-full.png) | [1280px](silk-wedding-1280-hero.png) | [Открыть](http://127.0.0.1:4315/i/invite-758c987c942f036275f2c1a3) |
| Ночной сад и свет | immersive | [390px полностью](night-garden-birthday-390-full.png) | [1280px](night-garden-birthday-1280-hero.png) | [Открыть](http://127.0.0.1:4315/i/invite-bcaf09fef10fa8ab5676cbca) |
| Фарфоровое поздравление | keepsake | [390px полностью](porcelain-greeting-390-full.png) | [1280px](porcelain-greeting-1280-hero.png) | [Открыть](http://127.0.0.1:4315/i/invite-d295acafb9165598f0b7a4e5) |

## Ограничения

- Authored fixtures with original supplied material artwork; no AI generation endpoint or provider is invoked.
- Chromium with reduced motion at 320, 390, 430 and 1280 pixels; physical phones, Safari and normal-motion animations are not tested.
- The greeting is also inspected with JavaScript disabled. Browser assertions establish integration and readability; visual quality requires reviewing the saved complete mobile pages.
- All names, event facts, accounts and drafts are fictional and remain in the isolated local test store.

## Ошибки

- porcelain-greeting (320px, standard): Missing supplied personal headline
- porcelain-greeting (390px, standard): Missing supplied personal headline
- porcelain-greeting (430px, standard): Missing supplied personal headline
- porcelain-greeting (1280px, standard): Missing supplied personal headline
- porcelain-greeting (390px, no-javascript): Missing supplied personal headline

Детали: [report.json](report.json).
