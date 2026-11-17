import type { Content } from "@/lib/schema/content";
import { labels } from "@/lib/invitation/locale";

const headings = {
  ru: {
    corporate: { greeting: "Дорогие коллеги", countdown: "До встречи", timeline: "Программа встречи" },
    birthday: { greeting: "Дорогие друзья", countdown: "До праздника", timeline: "План праздника" },
    anniversary: { greeting: "Дорогие близкие", countdown: "До нашего вечера", timeline: "Программа вечера" },
    other: { greeting: "Дорогие гости", countdown: "До встречи", timeline: "Программа встречи" },
  },
  "uz-latn": {
    corporate: { greeting: "Hurmatli hamkasblar", countdown: "Uchrashuvgacha", timeline: "Uchrashuv dasturi" },
    birthday: { greeting: "Aziz doʻstlar", countdown: "Bayramgacha", timeline: "Bayram dasturi" },
    anniversary: { greeting: "Aziz yaqinlar", countdown: "Oqshomgacha", timeline: "Oqshom dasturi" },
    other: { greeting: "Hurmatli mehmonlar", countdown: "Uchrashuvgacha", timeline: "Uchrashuv dasturi" },
  },
  en: {
    corporate: { greeting: "Dear colleagues", countdown: "Until we meet", timeline: "The programme" },
    birthday: { greeting: "Dear friends", countdown: "Until the celebration", timeline: "The party plan" },
    anniversary: { greeting: "Dear loved ones", countdown: "Until our evening", timeline: "The evening programme" },
    other: { greeting: "Dear guests", countdown: "Until we meet", timeline: "The programme" },
  },
} as const;

/** Role labels follow the event; the owner's actual copy remains untouched. */
export function eventSectionCopy(content: Pick<Content, "locale" | "eventType" | "purpose">) {
  if (content.purpose === "greeting") return greetingPageCopy(content);
  if (content.eventType === "wedding" || content.eventType === "engagement") return labels[content.locale];
  return headings[content.locale][content.eventType];
}

const greetingCopy = {
  ru: { greeting: "С тёплыми пожеланиями", countdown: "", timeline: "", footer: "С любовью", story: "Дорогие сердцу моменты", storyEyebrow: "То, что нас объединяет", gallery: "Тёплые воспоминания", photo: "Фотография из наших воспоминаний", top: "К началу поздравления", wedding: "С днём свадьбы", anniversary: "С годовщиной", birthday: "С днём рождения", corporate: "С благодарностью", engagement: "С помолвкой", other: "От всего сердца" },
  "uz-latn": { greeting: "Samimiy tilaklar", countdown: "", timeline: "", footer: "Mehr bilan", story: "Qadrli lahzalar", storyEyebrow: "Bizni birlashtirgan xotiralar", gallery: "Iliq xotiralar", photo: "Xotiralarimizdan surat", top: "Tabrik boshiga", wedding: "Toʻyingiz muborak", anniversary: "Yillik bayramingiz muborak", birthday: "Tugʻilgan kuningiz muborak", corporate: "Minnatdorchilik bilan", engagement: "Unashtiruvingiz muborak", other: "Chin yurakdan" },
  en: { greeting: "Warmest wishes", countdown: "", timeline: "", footer: "With love", story: "Moments we treasure", storyEyebrow: "What brings us together", gallery: "Warm memories", photo: "A photograph from our memories", top: "Back to the greeting", wedding: "Happy wedding day", anniversary: "Happy anniversary", birthday: "Happy birthday", corporate: "With appreciation", engagement: "Congratulations on your engagement", other: "From the heart" },
} as const;

export function greetingPageCopy(content: Pick<Content, "locale">) {
  return greetingCopy[content.locale];
}
