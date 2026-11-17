# Параметрическая композиция curated-приглашений

В режиме `curatedTemplates: true` генератор выбирает зарегистрированные ID
палитры, пары шрифтов и декора и передаёт отдельный объект `composition`.
`createVisual: false` сохраняет текст в React, использует фотографии владельца
и локальные SVG/CSS-элементы. Запросов на создание изображений нет.

## Контракт

```json
{
  "templateId": "editorial",
  "paletteId": "wine",
  "fontPairId": "ceremony",
  "ornamentSetId": "deco-lines",
  "composition": {
    "heroLayout": "framed-arch",
    "photoShape": "arch",
    "surfaceStyle": "bordered-hairline",
    "spacingScale": "airy-gallery",
    "typographyAccent": "italic-serif-accent",
    "decorConfig": {
      "placement": "corners",
      "density": "subtle",
      "opacity": 0.25
    },
    "sectionVariants": {
      "countdown": "date-led",
      "program": "editorial-list",
      "venue": "split",
      "gallery": "filmstrip",
      "rsvp": "minimal"
    }
  }
}
```

В сохранённой теме `templateId` становится `studioTemplate.id`, существующее
поле `revision: 1` сохраняется. Все поля `composition` обязательны, если объект
передан; произвольные CSS, URL, названия вариантов и значения opacity вне 0–1
отклоняются runtime-схемой `lib/schema/studioTemplate.ts`. JSON-схема AI
использует те же перечисления.

| Параметр | Допустимые значения |
| --- | --- |
| `heroLayout` | `fullscreen-cover`, `split-editorial`, `framed-arch`, `typographic-poster`, `minimal-card` |
| `photoShape` | `sharp`, `rounded`, `arch`, `pill`, `circle`, `polaroid` |
| `surfaceStyle` | `flat`, `glassmorphism`, `bordered-hairline`, `elevated-card`, `soft-gradient` |
| `spacingScale` | `compact-poster`, `balanced`, `airy-gallery` |
| `typographyAccent` | `italic-serif-accent`, `uppercase-wide-tracking`, `oversized-display`, `classic-centered` |
| `decorConfig.placement` | `corners`, `dividers`, `background-pattern`, `frame` |
| `decorConfig.density` | `none`, `subtle`, `rich` |
| `sectionVariants.countdown` | `tiles`, `date-led`, `inline` |
| `sectionVariants.program` | `timeline`, `cards`, `editorial-list` |
| `sectionVariants.venue` | `stacked`, `split`, `card` |
| `sectionVariants.gallery` | `grid`, `filmstrip`, `editorial` |
| `sectionVariants.rsvp` | `card`, `split`, `minimal` |

## Совместимость и сохранение данных

Семь направлений остаются начальными пресетами. В параметрическом режиме
совместимость определяется тегами ассетов, а не принадлежностью одному
направлению. Например, тёмная палитра допускает геометрический декор ар-деко,
а `italic-serif-accent` требует зарегистрированную пару с антиквой.
Собственные цветные растровые элементы Chinese Garden допускаются на светлых
палитрах. Итоговую совместимость проверяет компилятор независимо от промпта.

Отсутствие `composition` сохраняет прежний renderer и прежние ограничения
рецепта. Старые JSON не мигрируют автоматически и не меняют внешний вид.
Ручной выбор шаблона без брифа остаётся детерминированным и не требует AI-ключа.
Палитра/шрифты при refinement не сбрасывают сохранённую композицию.

Галерея — способ раскладки фотографии в назначенной семантической секции,
а не новая секция, перемещающая фото. Закреплённые владельцем placements
остаются на месте. Маски применяются только при сохранении защищённого кадра;
небезопасный силуэт заменяется прямоугольником. Формы, календарь и ссылки
используют существующие интерактивные компоненты, а текст сохраняет
`data-studio-field` для редактора.

## Runtime QA

```sh
ANTHROPIC_API_KEY='' OPENAI_API_KEY='' \
INVITATION_BUILD_DIR=.next-composition-qa \
npm run dev -- --hostname 127.0.0.1 --port 3154
```

В другом терминале:

```sh
STUDIO_QA_URL=http://127.0.0.1:3154 \
STUDIO_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
STUDIO_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node scripts/qa-studio-composition.mjs
```

Скрипт создаёт собственные временные проекты, получает legacy-тему через
ручной API и добавляет параметрическую конфигурацию в новую версию фикстуры.
Он не изменяет демонстрационный проект и удаляет свои проекты в `finally`.
Контролируемое тестовое изображение создаётся локально, AI и внешние
получатели RSVP не вызываются.

Проверяется репрезентативная выборка: пять Hero с фотографиями и без них,
шесть масок, пять поверхностей, все варианты секций, длинные имена и текст,
параметрический Heritage на 320/390/430px. Проверки также покрывают отсутствие
горизонтального overflow, живые поля редактора, однократный вывод закреплённых
фото, RSVP step/back и локальный native POST, календарь ICS, touch targets,
reduced motion и серверный HTML без JavaScript. Это не полный перебор всех
комбинаций и не live-проверка AI-провайдера.

Результаты и мобильные screenshots сохраняются в
`docs/studio-templates/composition-qa/` либо в `STUDIO_QA_OUTPUT`.
