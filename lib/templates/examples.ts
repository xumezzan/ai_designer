import type { Content } from "@/lib/schema/content";
import type { StudioTemplateId } from "@/lib/schema/studioTemplate";

/** Fictional catalog examples are never copied into a customer's project. */
export function templateExampleContent(base: Content, id: StudioTemplateId): Content {
  const content = structuredClone(base);
  content.media = []; content.refs = []; content.rsvp = undefined;
  if (id === "classic") {
    content.eventType = "anniversary"; content.hosts = [{ name: "Камол" }];
    content.headline = "Вечер в кругу близких";
    content.greeting = "Приглашаю вас разделить со мной тёплый семейный вечер. Самый ценный подарок — провести этот день вместе.";
  } else if (id === "modern") {
    content.eventType = "birthday"; content.hosts = [{ name: "Алина" }];
    content.headline = "Встречаемся на празднике";
    content.greeting = "Музыка, разговоры до позднего вечера и любимые люди рядом. Буду рада увидеть тебя на моём дне рождения.";
  } else if (id === "corporate") {
    content.eventType = "corporate"; content.hosts = [{ name: "Studio Team" }];
    content.headline = "Вечер нашей команды";
    content.greeting = "Встречаемся, чтобы отметить общие достижения и обсудить планы. В программе — приветствие, ужин и свободное общение.";
    content.dressCode = undefined; content.wishes = undefined;
    content.timeline = [{ time: "17:00", title: "Сбор гостей" }, { time: "17:30", title: "Приветствие команды" }, { time: "18:00", title: "Ужин и общение" }];
    content.closing = "До встречи на вечере команды";
  }
  return content;
}
