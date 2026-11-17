import {
  createEmptyDraft,
  type InvitationDraft,
  type TemplateId,
} from "@/lib/platform/schema";

/** Catalogue content is deliberately fictional and never reads an account,
 * an existing invitation, a guest response or the owner's photographs. */
export function createPlatformDemo(
  templateId: TemplateId,
  locale: "ru" | "uz-latn",
): InvitationDraft {
  const draft = createEmptyDraft(templateId);
  const russian = locale === "ru";
  const names = {
    classic: russian ? ["Азиз", "Малика"] : ["Aziz", "Malika"],
    botanical: russian ? ["Сардор", "Нилуфар"] : ["Sardor", "Nilufar"],
    nocturne: russian ? ["Тимур", "Сабина"] : ["Timur", "Sabina"],
    heritage: russian ? ["Алишер", "Шахноза"] : ["Alisher", "Shahnoza"],
    "sculpted-garden": russian ? ["София", "Александр"] : ["Sofiya", "Aleksandr"],
    editorial: russian ? ["Дилноза", "Джахонгир"] : ["Dilnoza", "Jahongir"],
    modern: russian ? ["Александра"] : ["Aleksandra"],
    corporate: russian ? ["Команда"] : ["Jamoa"],
  };
  return {
    ...draft,
    locale,
    names: names[templateId],
    eventType: templateId === "modern" ? "birthday" : templateId === "corporate" ? "corporate" : draft.eventType,
    title: russian ? "Демонстрационное приглашение" : "Namuna taklifnoma",
    fontPairId:
      templateId === "heritage"
        ? "romantic"
        : templateId === "nocturne"
          ? "editorial"
          : "classic",
    date: {
      day: "2027-05-20",
      time: "18:00",
      timezone: "Asia/Tashkent",
      showCountdown: true,
    },
    greeting: russian
      ? "Дорогие родные и друзья!\n\nЕсть дни, которые хочется запомнить навсегда. Будем счастливы, если в этот день вы будете рядом — с улыбками, тёплыми словами и любовью."
      : "Aziz yaqinlar va do‘stlar!\n\nBir umr yodda qoladigan kunlar bo‘ladi. Ana shunday kunda sizni yonimizda ko‘rishdan baxtiyormiz — tabassum, iliq so‘zlar va mehr bilan.",
    story: russian
      ? "Всё началось с простого разговора, который не хотелось заканчивать. Из встреч, путешествий и маленьких общих привычек сложилась наша история. Теперь мы открываем её новую главу."
      : "Hammasi tugashini istamagan oddiy suhbatdan boshlandi. Uchrashuvlar, sayohatlar va kichik odatlardan bizning hikoyamiz yaratildi. Endi uning yangi sahifasini ochmoqdamiz.",
    venue: {
      name: russian ? "Сад «Баҳор»" : "«Bahor» bog‘i",
      address: russian
        ? "Ташкент, в окружении зелёного сада"
        : "Toshkent, yashil bog‘ bag‘rida",
      note: russian
        ? "Место и адрес приведены для демонстрации дизайна."
        : "Joy va manzil dizayn namunasi uchun keltirilgan.",
    },
    timeline: russian
      ? [
          {
            time: "18:00",
            title: "Сбор гостей",
            note: "Встреча, улыбки и первые фотографии",
          },
          {
            time: "18:30",
            title: "Наша церемония",
            note: "Самые важные слова",
          },
          {
            time: "19:00",
            title: "Праздничный ужин",
            note: "Музыка, тёплые тосты и танцы",
          },
        ]
      : [
          {
            time: "18:00",
            title: "Mehmonlarni kutib olish",
            note: "Uchrashuvlar, tabassumlar va ilk suratlar",
          },
          {
            time: "18:30",
            title: "Bizning marosimimiz",
            note: "Eng muhim so‘zlar",
          },
          {
            time: "19:00",
            title: "Bayram dasturxoni",
            note: "Musiqa, iliq tilaklar va raqslar",
          },
        ],
    dressCode: {
      title: russian ? "В гармонии с нашим днём" : "Kunimizga uyg‘un ranglar",
      note: russian
        ? "Будем рады нарядам в мягких природных оттенках. Главное — ваше хорошее настроение."
        : "Mayin, tabiiy rangdagi liboslardan xursand bo‘lamiz. Eng muhimi — yaxshi kayfiyatingiz.",
      swatches:
        templateId === "heritage"
          ? ["#991E25", "#F8F4EC", "#B18445"]
          : templateId === "nocturne"
            ? ["#303847", "#D0BB8D", "#F3EEE4"]
            : ["#E5DCCB", "#ADB89E", "#C6A3A1"],
    },
    closing: russian
      ? "Этот день станет теплее с вами"
      : "Siz bilan bu kun yanada iliq bo‘ladi",
    enabledSections: [
      "opening",
      "greeting",
      "story",
      "date",
      "venue",
      "timeline",
      "dressCode",
      "closing",
    ],
    media: [],
  };
}
