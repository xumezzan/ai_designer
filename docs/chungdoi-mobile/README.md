# ChungDoi: полный разбор мобильных предпросмотров

12 октября 2026 года открыт [каталог ChungDoi](https://chungdoi.com/ru/templates),
найдены **72 карточки**, для каждой открыта страница шаблона, найден её настоящий
линк предпросмотра, открыто демо и нажата обложка «Открыть». Пройден весь документ.
**72 из 72 демо открыты; пропущенных и ошибок навигации нет.** Цветовые варианты
тоже просмотрены отдельно. При удалении цветового окончания из названий URL
получается 39 групп; это наша группировка, а не заявленное число оригинальных
композиций сервиса. Варианты одной группы иногда отличаются и структурой.

Основной экран: **390×844 CSS px, mobile + touch**. Для каждого открытого
приглашения дополнительно измерены ширины **320 и 430px**. Исследование выполнено
в браузере; карточки каталога не заменяли открытые приглашения.

## Что просмотрено и сохранено

- [Каталог всех 72 ссылок](./catalog.json).
- [Измерения каждого демо](./measurements.json): открытие, размер документа,
  типографика, изображения, панели, перспективы, тени, blur, элементы управления,
  полученные браузером анимации, дополнительные ширины и reduced motion.
- Для каждого шаблона — обложка и полный снимок страницы шириной 390px.
- Полный вертикальный ритм всех страниц: [01](./boards/01-full-pages.jpg),
  [02](./boards/02-full-pages.jpg), [03](./boards/03-full-pages.jpg),
  [04](./boards/04-full-pages.jpg), [05](./boards/05-full-pages.jpg),
  [06](./boards/06-full-pages.jpg). Детали читаются в исходных полных снимках.
- Сравнительные листы: [01](./boards/01-page.jpg), [02](./boards/02-page.jpg),
  [03](./boards/03-page.jpg), [04](./boards/04-page.jpg),
  [05](./boards/05-page.jpg), [06](./boards/06-page.jpg).
- Вход и завершение: [01](./boards/01-entry-exit.jpg),
  [02](./boards/02-entry-exit.jpg), [03](./boards/03-entry-exit.jpg),
  [04](./boards/04-entry-exit.jpg), [05](./boards/05-entry-exit.jpg),
  [06](./boards/06-entry-exit.jpg).
- [Отдельный опыт с касанием](./interactions.json): в Chateau Blue настоящий
  горизонтальный touch-жест сменил фото 1 на 2; tap выбрал фото 3. RSVP также
  открыт отдельно в видимом браузере: поле имени и два варианта присутствия.
  Ответы, пожелания и другие формы не отправлялись.

Все сравнительные листы визуально просмотрены. Полные снимки позволяют проверить
продолжение композиции: церемонию, галерею, банкет, календарь, карту, дресс-код,
программу, пожелания и завершение.

## Выводы для нашего проекта

**Приглашение проектируется сначала для телефона.** Это последовательная
вертикальная композиция со своим началом, масштабом фотографии, паузами и
завершением. На узком экране должна сохраняться узнаваемость каждого дизайна.
Редактор студии — отдельная поверхность; его desktop-сетка не определяет
геометрию приглашения. Требование закреплено в [AGENTS.md](../../AGENTS.md),
основном README и инструкциях генерации/редактирования темы.

### Материалы и глубина

Объём у этих демо возникает из отношений между слоями: ткань позади кружева,
бумага перед фоном, фотография под краем конверта, цветок перед оптическим краем
стекла. Большую часть конкретной фактуры несут отдельные декоративные изображения;
имена, расписание и действия остаются HTML. По скриншоту нельзя называть всё это
процедурной CSS-графикой. Наши оригинальные материалы должны иметь согласованный
свет, контактную тень, толщину и перекрытия, а фотографии — свои защищённые рамки.

Материал продолжает страницу. У кружевного демо фактические блоки имеют кружевные
края; у фарфора повторяется орнаментальный фон и светлая вставка; у стекла факты
лежат на прозрачных панелях; у ленточных композиций изгиб связывает соседние
участки. Нужно создавать этот общий визуальный мир и менять ритм разделов.

### Различия между дизайнами

Разнообразие определяется мобильным силуэтом и отношением имён, фото и мотива:
пейзаж под именами; арочная фотография; два наклонённых отпечатка; фото в конверте;
ажурная карманная форма; крупная цветочная рамка; тёмное поле с золотой линией;
герб или рисованная история. Палитра дополняет эту конструкцию.

Наши три material scenes остаются реализованной основой. Это исследование
расширяет визуальную библиотеку и требования; **оно не означает, что все 72
композиции или все изученные эффекты уже реализованы в нашем renderer**.

### Движение и действия на телефоне

В исследованных галереях браузер показывает CSS perspective **1000px** и
раздельно трансформированные карточки. В Chateau Blue мобильные боковые стрелки
скрыты, а свайп действительно меняет активное фото. Индикаторы измерены как
8×8px и 24×8px — для наших интерактивных индикаторов нужен более просторный
невидимый touch-target, даже если сам графический штрих маленький.

Стеклянные панели Glass Garden имеют измеренный
`backdrop-filter: blur(7px) saturate(1.08)`, внутренние блики и несколько теней.
Кружево использует медленное плавание слоёв: измеренные циклы 6000 и 7500ms;
Minimalism Dark Red — циклы отдельных слоёв примерно 5000–6500ms. Это наблюдения
конкретных демо, а не обязательные тайминги нашего продукта. Вес бумаги лучше
передавать малой амплитудой и уверенным торможением; большие блоки не должны
постоянно летать. Hover-наклон остаётся дополнением для desktop.

Для гостей первичны открытие, свободный вертикальный скролл, фото, дата,
сохранение события, маршрут и ответ. Каждый шаг должен работать с пальцем.
Читаемый статический вид, reduced motion и остановка фона при скрытии страницы
остаются требованиями нашего проекта независимо от поведения референса.

## Карта визуальных семейств

Это наши наблюдения и интерпретация показанных композиций. Полный список каждого
цветового варианта со ссылками и доказательствами приведён ниже.

| Группа | Мобильная композиция и графический язык |
|---|---|
| Chateau | Имена над архитектурной акварелью; замок/сад создаёт нижний вес первого экрана, детали продолжаются на светлом поле. |
| Jasmine White | Вертикальная овальная цветочная рамка; тонкая линия, белые цветы и зелёные имена. |
| Minimalism | Фото в конверте, сургуч, гербарные акценты и бумажные вставки в нескольких вариантах. Brown использует прикреплённый отпечаток, Red — крупный типографический мотив LOVE: серия структурно неоднородна. |
| Applique Lace | Тёмная ткань, белый кружевной карман, наклонённое фото; кружево повторяется в блоках фактов. |
| Spring Garden | Воздушные акварельные края, рукописные имена, ранняя галерея и лёгкие открытые разделы. |
| Wildflower | Открытый венок из разноцветных полевых цветов и банта; небольшие рассыпанные лепестки продолжают страницу. |
| Florence | Узнаваемая архитектура и вода под именами; светлое акварельное поле вместо отдельной карточки. |
| Glass Garden | Арочная стеклянная поверхность среди объёмных цветов; прозрачные панели и размытая глубина в разделах. |
| Hoa Kho V2 | Сухие стебли и цветы образуют тонкую вытянутую рамку; бабочки, спокойная бумага и синие акценты. |
| Baroque | Светлый фон, рельефная золотая рама и белые цветы; мотив возвращается вокруг календаря. |
| Crystal Floral | Фигурная украшенная рамка вокруг имён, цветы и ювелирные детали; родственные угловые акценты календаря. |
| Riviera | Голубая приморская акварель, город и горы; светлая открытая вертикальная история. |
| Baroque II | Большая фотография в тяжёлой фигурной золотой раме на тёмном фактурном фоне; тёмный календарь и светлые акценты. |
| Silk Ribbon | Два наклонённых снимка и крупный цветок; непрерывный изгиб шёлковой ленты ведёт вниз, имена размещены асимметрично. |
| San Miguel | Яркая архитектурная акварель с жёлтым храмом и зеленью; сюжет продолжается горизонтальным пейзажем у календаря. |
| Royal | Тёмное поле, крупные светлые имена, золотая ботаническая линия сверху и орнаментальные разделители. |
| Porcelain | Повторяющийся туаль/ботанический рисунок; спокойные светлые фигурные вставки и контрастный календарь. |
| Royal II | Тёмные зелёные/фиолетовые поверхности, угловые цветы и золото; рамка и декор меняют расположение по странице. |
| Mahal | Индийская архитектура, орнаментальная арка и тёплое светлое поле; крупные малиновые цветы обрамляют сюжет. |
| Boho Floral | Пара отдельных наклонённых фото и имена рядом с ними; мягкие большие цветы/листья связывают вертикальную композицию. |
| Lien Hoa | Розовые лотосы на светлом поле, тонкая золотая прямоугольная рамка и открытая типографика. |
| Porcelain II | Более плотный крупный растительный рисунок; светлая прямоугольная вставка и цветная карточка календаря. |
| Double Happiness | Контрастный верх со знаком, крупное арочное фото и полосы названий разделов. |
| Dragon Phoenix | Рукописные имена на тёмном поле с тонкими культурными фигурами; ранняя объёмная фотогалерея. |
| Song Hy V2 | Фигурная фотография на светлой вставке, красное поле и символическая орнаментальная структура разделов. |
| Double Crane | Парные журавли на красном поле, асимметричные имена и светлый фигурный календарный лист. |
| Dragon Phoenix V4 | Богатые цветные фигуры вокруг круглой фотографии; узор продолжается на красных информационных разделах. |
| Silk Flora | Большая линейная цветочная гравюра на тёплом светлом поле; имена сдвинуты относительно рисунка. |
| Hoa Kho | Выраженная арочная вставка, оранжевые цветы и зелёный календарный акцент. |
| Dragon Phoenix V2 | Крупная светлая декоративная пара на красном фоне, имена над ней и фигурные светлые вставки ниже. |
| Elegant Leaf | Фото как отдельные отпечатки с именами рядом, крупные листья; дальше цельное тёмно-зелёное поле с линейной ветвью. |
| Dragon Phoenix V3 | Арочное фото в красной орнаментальной композиции; тонкие фигурные контуры информации. |
| Chibi | Центральная иллюстрированная пара, кремовый фон, красные символы и маленькие рисованные акценты. |
| Cherry Blossom | Один крупный наклонённый фотоснимок под веткой сакуры; большие розовые имена и бумажное продолжение. |
| Lotus V2 | Фигурная крупная фотография, листья и лотосы, разнесённые по диагонали имена. |
| Sunflower | Вертикальная цветочная композиция сбоку от имён; светлая бумага и жёлтый акцент действий. |
| Double Dragon | Два круглых фотопортрета, горизонтальная цветная полоса и символ между ними; разделы поддержаны такими же полосами. |
| Love Art | Нарисованные рамки двух фото, каракули/сердца и разные роли шрифта; календарь выглядит как рисованный блокнот. |
| Double Phoenix | Большие парные линейные фигуры и знак на светлом поле с цветной полосой; основная графика отличается от фотоистории. |

## Метод и границы проверки

Скрипт [study-chungdoi.mjs](../../scripts/study-chungdoi.mjs) использует существующий
Playwright/Chrome. Все 72 открытых документа измерены на основной ширине; ещё
144 измерения проверяют общий scrollWidth на 320/430px. В этих замерах нет
горизонтального расширения документа. Это не проверка каждого текстового
переполнения, контраста или качества на физическом iPhone/Android и не мобильный
performance-аудит. Сетевое/CPU замедление в этой работе не измерялось.

Computed font-family описывает объявленный CSS-стек, не доказательство выбора
шрифта для каждого кириллического символа. `getAnimations()` включает анимации
смонтированных скрытых элементов и оверлеев; их наличие не доказывает, что гость
увидел каждую из них. В режиме reduced motion такие объекты оставались; этот
замер также не доказывает видимость каждой анимации. Несколько мелких декоративных
img в момент снимка имели naturalWidth 0 — это сохранено в данных.

Надёжные визуальные доказательства — обложка и **полный** снимок мобильной
страницы. Из-за поведения mobile/CDP обычный viewport-снимок после scroll мог
показывать неверное положение. Поэтому сравнительные листы используют явно
обозначенные кропы полного снимка: начало, 42% высоты и конец. Эти кропы не
выдаются за дополнительные независимые viewport-проверки.

Скриншоты — локальные доказательства исследования. Декоративные изображения,
фото людей, фирменные элементы и исходный код ChungDoi в продукт не перенесены.
Исследование и новые инструкции не выполняют публикацию, сбор RSVP или создание
72 готовых шаблонов нашего приложения.

## Каждый открытый предпросмотр

<!-- generated-catalog -->

| № | Шаблон / живое демо | Обложка | Полная мобильная страница | Высота при 390px | 320 / 430px |
|---:|---|---|---|---:|---|
| 1 | [Шато - Синий](https://chungdoi.com/ru/templates/chateau-blue/demo) | [Снимок](./screenshots/chateau-blue-cover.jpg) | [Снимок](./screenshots/chateau-blue-full.jpg) | 6431px | 320 / 430px |
| 2 | [Май Лан - Белый](https://chungdoi.com/ru/templates/jasmine-white/demo) | [Снимок](./screenshots/jasmine-white-cover.jpg) | [Снимок](./screenshots/jasmine-white-full.jpg) | 5820px | 320 / 430px |
| 3 | [Minimalism - Тёмно-красный](https://chungdoi.com/ru/templates/minimalism-dark-red/demo) | [Снимок](./screenshots/minimalism-dark-red-cover.jpg) | [Снимок](./screenshots/minimalism-dark-red-full.jpg) | 5602px | 320 / 430px |
| 4 | [Кружевная вышивка - белый](https://chungdoi.com/ru/templates/applique-lace-white/demo) | [Снимок](./screenshots/applique-lace-white-cover.jpg) | [Снимок](./screenshots/applique-lace-white-full.jpg) | 5060px | 320 / 430px |
| 5 | [Весенний Сад - Красный](https://chungdoi.com/ru/templates/spring-garden-red/demo) | [Снимок](./screenshots/spring-garden-red-cover.jpg) | [Снимок](./screenshots/spring-garden-red-full.jpg) | 5959px | 320 / 430px |
| 6 | [Minimalism - Тёмно-коричневый](https://chungdoi.com/ru/templates/minimalism-dark-brown/demo) | [Снимок](./screenshots/minimalism-dark-brown-cover.jpg) | [Снимок](./screenshots/minimalism-dark-brown-full.jpg) | 5481px | 320 / 430px |
| 7 | [Wildflower - Розовый](https://chungdoi.com/ru/templates/wildflower-pink/demo) | [Снимок](./screenshots/wildflower-pink-cover.jpg) | [Снимок](./screenshots/wildflower-pink-full.jpg) | 5032px | 320 / 430px |
| 8 | [Флоренция - Коричневый](https://chungdoi.com/ru/templates/florence-brown/demo) | [Снимок](./screenshots/florence-brown-cover.jpg) | [Снимок](./screenshots/florence-brown-full.jpg) | 5352px | 320 / 430px |
| 9 | [Minimalism - Коричневый](https://chungdoi.com/ru/templates/minimalism-brown/demo) | [Снимок](./screenshots/minimalism-brown-cover.jpg) | [Снимок](./screenshots/minimalism-brown-full.jpg) | 5660px | 320 / 430px |
| 10 | [Minimalism - Тёмно-синий](https://chungdoi.com/ru/templates/minimalism-dark-blue/demo) | [Снимок](./screenshots/minimalism-dark-blue-cover.jpg) | [Снимок](./screenshots/minimalism-dark-blue-full.jpg) | 5501px | 320 / 430px |
| 11 | [Весенний Сад - Синий](https://chungdoi.com/ru/templates/spring-garden-blue/demo) | [Снимок](./screenshots/spring-garden-blue-cover.jpg) | [Снимок](./screenshots/spring-garden-blue-full.jpg) | 5959px | 320 / 430px |
| 12 | [Стеклянный Сад - Зелёный](https://chungdoi.com/ru/templates/glass-garden-green/demo) | [Снимок](./screenshots/glass-garden-green-cover.jpg) | [Снимок](./screenshots/glass-garden-green-full.jpg) | 5474px | 320 / 430px |
| 13 | [Сухоцветы V2 - Синий](https://chungdoi.com/ru/templates/hoa-kho-v2-blue/demo) | [Снимок](./screenshots/hoa-kho-v2-blue-cover.jpg) | [Снимок](./screenshots/hoa-kho-v2-blue-full.jpg) | 5257px | 320 / 430px |
| 14 | [Барокко - Золотой](https://chungdoi.com/ru/templates/baroque-gold/demo) | [Снимок](./screenshots/baroque-gold-cover.jpg) | [Снимок](./screenshots/baroque-gold-full.jpg) | 5662px | 320 / 430px |
| 15 | [Хрустальные Цветы - Синий](https://chungdoi.com/ru/templates/crystal-floral-blue/demo) | [Снимок](./screenshots/crystal-floral-blue-cover.jpg) | [Снимок](./screenshots/crystal-floral-blue-full.jpg) | 5792px | 320 / 430px |
| 16 | [Ривьера - Синий](https://chungdoi.com/ru/templates/riviera-blue/demo) | [Снимок](./screenshots/riviera-blue-cover.jpg) | [Снимок](./screenshots/riviera-blue-full.jpg) | 5567px | 320 / 430px |
| 17 | [Барокко II - Тёмно-красный](https://chungdoi.com/ru/templates/baroque-v2-dark-red/demo) | [Снимок](./screenshots/baroque-v2-dark-red-cover.jpg) | [Снимок](./screenshots/baroque-v2-dark-red-full.jpg) | 5884px | 320 / 430px |
| 18 | [Шато - Зелёный](https://chungdoi.com/ru/templates/chateau-green/demo) | [Снимок](./screenshots/chateau-green-cover.jpg) | [Снимок](./screenshots/chateau-green-full.jpg) | 6572px | 320 / 430px |
| 19 | [Minimalism - Зелёный](https://chungdoi.com/ru/templates/minimalism-green/demo) | [Снимок](./screenshots/minimalism-green-cover.jpg) | [Снимок](./screenshots/minimalism-green-full.jpg) | 5627px | 320 / 430px |
| 20 | [Шёлковая Лента - Тёмно-красный](https://chungdoi.com/ru/templates/silk-ribbon-dark-red/demo) | [Снимок](./screenshots/silk-ribbon-dark-red-cover.jpg) | [Снимок](./screenshots/silk-ribbon-dark-red-full.jpg) | 5930px | 320 / 430px |
| 21 | [Сан-Мигель - Жёлтый](https://chungdoi.com/ru/templates/san-miguel-yellow/demo) | [Снимок](./screenshots/san-miguel-yellow-cover.jpg) | [Снимок](./screenshots/san-miguel-yellow-full.jpg) | 5540px | 320 / 430px |
| 22 | [Весенний Сад - Зелёный](https://chungdoi.com/ru/templates/spring-garden-green/demo) | [Снимок](./screenshots/spring-garden-green-cover.jpg) | [Снимок](./screenshots/spring-garden-green-full.jpg) | 5959px | 320 / 430px |
| 23 | [Королевский - Зелёный](https://chungdoi.com/ru/templates/royal-green/demo) | [Снимок](./screenshots/royal-green-cover.jpg) | [Снимок](./screenshots/royal-green-full.jpg) | 5696px | 320 / 430px |
| 24 | [Фарфор - Синий](https://chungdoi.com/ru/templates/porcelain-blue/demo) | [Снимок](./screenshots/porcelain-blue-cover.jpg) | [Снимок](./screenshots/porcelain-blue-full.jpg) | 5335px | 320 / 430px |
| 25 | [Minimalism - Фиолетовый](https://chungdoi.com/ru/templates/minimalism-purple/demo) | [Снимок](./screenshots/minimalism-purple-cover.jpg) | [Снимок](./screenshots/minimalism-purple-full.jpg) | 5674px | 320 / 430px |
| 26 | [Королевский II - Зелёный](https://chungdoi.com/ru/templates/royal-v2-green/demo) | [Снимок](./screenshots/royal-v2-green-cover.jpg) | [Снимок](./screenshots/royal-v2-green-full.jpg) | 6006px | 320 / 430px |
| 27 | [Стеклянный Сад - Розовый](https://chungdoi.com/ru/templates/glass-garden-pink/demo) | [Снимок](./screenshots/glass-garden-pink-cover.jpg) | [Снимок](./screenshots/glass-garden-pink-full.jpg) | 5496px | 320 / 430px |
| 28 | [Mahal - Золотой](https://chungdoi.com/ru/templates/mahal-gold/demo) | [Снимок](./screenshots/mahal-gold-cover.jpg) | [Снимок](./screenshots/mahal-gold-full.jpg) | 6013px | 320 / 430px |
| 29 | [Бохо Флора - Зелёный](https://chungdoi.com/ru/templates/boho-floral-green/demo) | [Снимок](./screenshots/boho-floral-green-cover.jpg) | [Снимок](./screenshots/boho-floral-green-full.jpg) | 5924px | 320 / 430px |
| 30 | [Minimalism - Красный](https://chungdoi.com/ru/templates/minimalism-red/demo) | [Снимок](./screenshots/minimalism-red-cover.jpg) | [Снимок](./screenshots/minimalism-red-full.jpg) | 5775px | 320 / 430px |
| 31 | [Королевский - Красный](https://chungdoi.com/ru/templates/royal-red/demo) | [Снимок](./screenshots/royal-red-cover.jpg) | [Снимок](./screenshots/royal-red-full.jpg) | 5699px | 320 / 430px |
| 32 | [Лотос - Розовый](https://chungdoi.com/ru/templates/lien-hoa-pink/demo) | [Снимок](./screenshots/lien-hoa-pink-cover.jpg) | [Снимок](./screenshots/lien-hoa-pink-full.jpg) | 6174px | 320 / 430px |
| 33 | [Хрустальные Цветы - Зелёный](https://chungdoi.com/ru/templates/crystal-floral-green/demo) | [Снимок](./screenshots/crystal-floral-green-cover.jpg) | [Снимок](./screenshots/crystal-floral-green-full.jpg) | 5789px | 320 / 430px |
| 34 | [Бохо Флора - Коричневый](https://chungdoi.com/ru/templates/boho-floral-brown/demo) | [Снимок](./screenshots/boho-floral-brown-cover.jpg) | [Снимок](./screenshots/boho-floral-brown-full.jpg) | 6007px | 320 / 430px |
| 35 | [Фарфор II - Зелёный](https://chungdoi.com/ru/templates/porcelain-v2-green/demo) | [Снимок](./screenshots/porcelain-v2-green-cover.jpg) | [Снимок](./screenshots/porcelain-v2-green-full.jpg) | 5475px | 320 / 430px |
| 36 | [Хрустальные Цветы - Красный](https://chungdoi.com/ru/templates/crystal-floral-red/demo) | [Снимок](./screenshots/crystal-floral-red-cover.jpg) | [Снимок](./screenshots/crystal-floral-red-full.jpg) | 5804px | 320 / 430px |
| 37 | [Двойное Счастье - Красный](https://chungdoi.com/ru/templates/double-happiness-red/demo) | [Снимок](./screenshots/double-happiness-red-cover.jpg) | [Снимок](./screenshots/double-happiness-red-full.jpg) | 5830px | 320 / 430px |
| 38 | [Фарфор II - Красный](https://chungdoi.com/ru/templates/porcelain-v2-red/demo) | [Снимок](./screenshots/porcelain-v2-red-cover.jpg) | [Снимок](./screenshots/porcelain-v2-red-full.jpg) | 5559px | 320 / 430px |
| 39 | [Стеклянный Сад - Синий](https://chungdoi.com/ru/templates/glass-garden-blue/demo) | [Снимок](./screenshots/glass-garden-blue-cover.jpg) | [Снимок](./screenshots/glass-garden-blue-full.jpg) | 5447px | 320 / 430px |
| 40 | [Дракон и Феникс - Красный](https://chungdoi.com/ru/templates/dragon-phoenix-red/demo) | [Снимок](./screenshots/dragon-phoenix-red-cover.jpg) | [Снимок](./screenshots/dragon-phoenix-red-full.jpg) | 5929px | 320 / 430px |
| 41 | [Шёлковая Лента - Розовый](https://chungdoi.com/ru/templates/silk-ribbon-pink/demo) | [Снимок](./screenshots/silk-ribbon-pink-cover.jpg) | [Снимок](./screenshots/silk-ribbon-pink-full.jpg) | 5898px | 320 / 430px |
| 42 | [Двойное Счастье V2 - Красный](https://chungdoi.com/ru/templates/song-hy-v2-red/demo) | [Снимок](./screenshots/song-hy-v2-red-cover.jpg) | [Снимок](./screenshots/song-hy-v2-red-full.jpg) | 5606px | 320 / 430px |
| 43 | [Двойной журавль - Красный](https://chungdoi.com/ru/templates/double-crane-red/demo) | [Снимок](./screenshots/double-crane-red-cover.jpg) | [Снимок](./screenshots/double-crane-red-full.jpg) | 5887px | 320 / 430px |
| 44 | [Дракон и Феникс V4 - Красный](https://chungdoi.com/ru/templates/dragon-phoenix-v4-red/demo) | [Снимок](./screenshots/dragon-phoenix-v4-red-cover.jpg) | [Снимок](./screenshots/dragon-phoenix-v4-red-full.jpg) | 5558px | 320 / 430px |
| 45 | [Барокко II - Тёмно-зелёный](https://chungdoi.com/ru/templates/baroque-v2-dark-green/demo) | [Снимок](./screenshots/baroque-v2-dark-green-cover.jpg) | [Снимок](./screenshots/baroque-v2-dark-green-full.jpg) | 5958px | 320 / 430px |
| 46 | [Шёлковая Лента - Зелёный](https://chungdoi.com/ru/templates/silk-ribbon-green/demo) | [Снимок](./screenshots/silk-ribbon-green-cover.jpg) | [Снимок](./screenshots/silk-ribbon-green-full.jpg) | 5741px | 320 / 430px |
| 47 | [Королевский II - Фиолетовый](https://chungdoi.com/ru/templates/royal-v2-purple/demo) | [Снимок](./screenshots/royal-v2-purple-cover.jpg) | [Снимок](./screenshots/royal-v2-purple-full.jpg) | 6117px | 320 / 430px |
| 48 | [Хоа Луа - Коричневый](https://chungdoi.com/ru/templates/silk-flora-brown/demo) | [Снимок](./screenshots/silk-flora-brown-cover.jpg) | [Снимок](./screenshots/silk-flora-brown-full.jpg) | 5844px | 320 / 430px |
| 49 | [Фарфор II - Розовый](https://chungdoi.com/ru/templates/porcelain-v2-pink/demo) | [Снимок](./screenshots/porcelain-v2-pink-cover.jpg) | [Снимок](./screenshots/porcelain-v2-pink-full.jpg) | 5545px | 320 / 430px |
| 50 | [Двойное Счастье - Зелёный](https://chungdoi.com/ru/templates/double-happiness-green/demo) | [Снимок](./screenshots/double-happiness-green-cover.jpg) | [Снимок](./screenshots/double-happiness-green-full.jpg) | 5735px | 320 / 430px |
| 51 | [Барокко II - Тёмно-синий](https://chungdoi.com/ru/templates/baroque-v2-dark-blue/demo) | [Снимок](./screenshots/baroque-v2-dark-blue-cover.jpg) | [Снимок](./screenshots/baroque-v2-dark-blue-full.jpg) | 5940px | 320 / 430px |
| 52 | [Дракон и Феникс - Чёрный](https://chungdoi.com/ru/templates/dragon-phoenix-black/demo) | [Снимок](./screenshots/dragon-phoenix-black-cover.jpg) | [Снимок](./screenshots/dragon-phoenix-black-full.jpg) | 5833px | 320 / 430px |
| 53 | [Фарфор - Коричневый](https://chungdoi.com/ru/templates/porcelain-brown/demo) | [Снимок](./screenshots/porcelain-brown-cover.jpg) | [Снимок](./screenshots/porcelain-brown-full.jpg) | 5380px | 320 / 430px |
| 54 | [Королевский - Синий](https://chungdoi.com/ru/templates/royal-blue/demo) | [Снимок](./screenshots/royal-blue-cover.jpg) | [Снимок](./screenshots/royal-blue-full.jpg) | 5667px | 320 / 430px |
| 55 | [Сухоцветы - Оранжевый](https://chungdoi.com/ru/templates/hoa-kho-orange/demo) | [Снимок](./screenshots/hoa-kho-orange-cover.jpg) | [Снимок](./screenshots/hoa-kho-orange-full.jpg) | 5212px | 320 / 430px |
| 56 | [Бохо Флора - Розовый](https://chungdoi.com/ru/templates/boho-floral-pink/demo) | [Снимок](./screenshots/boho-floral-pink-cover.jpg) | [Снимок](./screenshots/boho-floral-pink-full.jpg) | 5994px | 320 / 430px |
| 57 | [Дракон и Феникс V2 - Красный](https://chungdoi.com/ru/templates/dragon-phoenix-v2-red/demo) | [Снимок](./screenshots/dragon-phoenix-v2-red-cover.jpg) | [Снимок](./screenshots/dragon-phoenix-v2-red-full.jpg) | 5540px | 320 / 430px |
| 58 | [Тхань Дьеп - Зелёный](https://chungdoi.com/ru/templates/elegant-leaf-green/demo) | [Снимок](./screenshots/elegant-leaf-green-cover.jpg) | [Снимок](./screenshots/elegant-leaf-green-full.jpg) | 6452px | 320 / 430px |
| 59 | [Дракон и Феникс V3 - Красный](https://chungdoi.com/ru/templates/dragon-phoenix-v3-red/demo) | [Снимок](./screenshots/dragon-phoenix-v3-red-cover.jpg) | [Снимок](./screenshots/dragon-phoenix-v3-red-full.jpg) | 5648px | 320 / 430px |
| 60 | [Чиби - Красный](https://chungdoi.com/ru/templates/chibi-red/demo) | [Снимок](./screenshots/chibi-red-cover.jpg) | [Снимок](./screenshots/chibi-red-full.jpg) | 5549px | 320 / 430px |
| 61 | [Сакура - Розовый](https://chungdoi.com/ru/templates/cherry-blossom-pink/demo) | [Снимок](./screenshots/cherry-blossom-pink-cover.jpg) | [Снимок](./screenshots/cherry-blossom-pink-full.jpg) | 6151px | 320 / 430px |
| 62 | [Дракон и Феникс - Зелёный](https://chungdoi.com/ru/templates/dragon-phoenix-green/demo) | [Снимок](./screenshots/dragon-phoenix-green-cover.jpg) | [Снимок](./screenshots/dragon-phoenix-green-full.jpg) | 5896px | 320 / 430px |
| 63 | [Лотос II - Зелёный](https://chungdoi.com/ru/templates/lotus-v2-green/demo) | [Снимок](./screenshots/lotus-v2-green-cover.jpg) | [Снимок](./screenshots/lotus-v2-green-full.jpg) | 5666px | 320 / 430px |
| 64 | [Подсолнух](https://chungdoi.com/ru/templates/sunflower-yellow/demo) | [Снимок](./screenshots/sunflower-yellow-cover.jpg) | [Снимок](./screenshots/sunflower-yellow-full.jpg) | 5129px | 320 / 430px |
| 65 | [Два Дракона - Красный](https://chungdoi.com/ru/templates/double-dragon-red/demo) | [Снимок](./screenshots/double-dragon-red-cover.jpg) | [Снимок](./screenshots/double-dragon-red-full.jpg) | 5459px | 320 / 430px |
| 66 | [Фарфор - Красный](https://chungdoi.com/ru/templates/porcelain-red/demo) | [Снимок](./screenshots/porcelain-red-cover.jpg) | [Снимок](./screenshots/porcelain-red-full.jpg) | 5303px | 320 / 430px |
| 67 | [Хоа Тинь - Красный](https://chungdoi.com/ru/templates/love-art-red/demo) | [Снимок](./screenshots/love-art-red-cover.jpg) | [Снимок](./screenshots/love-art-red-full.jpg) | 6006px | 320 / 430px |
| 68 | [Два Феникса - Зелёный](https://chungdoi.com/ru/templates/double-phoenix-green/demo) | [Снимок](./screenshots/double-phoenix-green-cover.jpg) | [Снимок](./screenshots/double-phoenix-green-full.jpg) | 5371px | 320 / 430px |
| 69 | [Два Феникса - Красный](https://chungdoi.com/ru/templates/double-phoenix-red/demo) | [Снимок](./screenshots/double-phoenix-red-cover.jpg) | [Снимок](./screenshots/double-phoenix-red-full.jpg) | 5466px | 320 / 430px |
| 70 | [Дракон и Феникс - Синий](https://chungdoi.com/ru/templates/dragon-phoenix-blue/demo) | [Снимок](./screenshots/dragon-phoenix-blue-cover.jpg) | [Снимок](./screenshots/dragon-phoenix-blue-full.jpg) | 5898px | 320 / 430px |
| 71 | [Два Дракона - Зелёный](https://chungdoi.com/ru/templates/double-dragon-green/demo) | [Снимок](./screenshots/double-dragon-green-cover.jpg) | [Снимок](./screenshots/double-dragon-green-full.jpg) | 5477px | 320 / 430px |
| 72 | [Два Дракона - Синий](https://chungdoi.com/ru/templates/double-dragon-blue/demo) | [Снимок](./screenshots/double-dragon-blue-cover.jpg) | [Снимок](./screenshots/double-dragon-blue-full.jpg) | 5363px | 320 / 430px |
