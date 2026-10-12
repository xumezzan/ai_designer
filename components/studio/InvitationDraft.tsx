import type { CSSProperties } from "react";
import type { Content } from "@/lib/schema/content";
import { directions } from "@/lib/studio/directions";

const labels = { wedding: "Мы женимся", anniversary: "Особенный вечер", birthday: "День рождения", corporate: "Приглашаем на вечер", engagement: "Наша помолвка", other: "Приглашаем вас" };

export function InvitationDraft({ content, localDate, directionId }: { content: Content; localDate: string; directionId: string }) {
  const direction = directions.find((item) => item.id === directionId) ?? directions[0];
  const names = content.hosts.map((host) => host.name.trim()).filter(Boolean);
  const date = localDate ? new Date(localDate) : null;
  const locale = content.locale === "uz-latn" ? "uz-Latn" : content.locale === "en" ? "en" : "ru";
  const dateLabel = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(date) : "Дата вашего события";
  const time = localDate.slice(11, 16);
  return <div className="studio-draft-stage">
    <div className="studio-draft-paper" data-direction={direction.id} style={{ "--draft-bg": direction.bg, "--draft-ink": direction.ink, "--draft-accent": direction.accent } as CSSProperties}>
      <div className="studio-draft-mark" aria-hidden="true">{direction.id === "garden" ? <svg viewBox="0 0 80 80" fill="none"><path d="M25 66C32 45 47 33 55 15M34 46C14 42 18 26 18 26s19 2 16 20ZM44 33C43 13 60 9 60 9s5 20-16 24ZM30 57C43 56 57 49 57 49s-3 23-27 8Z" stroke="currentColor" strokeWidth="1" /></svg> : <span>{names.length ? names.map((name) => name[0]).slice(0, 2).join(" · ") : "A · R"}</span>}</div>
      <p className="studio-draft-kicker">{content.locale === "ru" ? labels[content.eventType] : content.locale === "en" ? "You are invited" : "Sizni taklif qilamiz"}</p>
      <h3>{content.headline || (names.length ? names.join(content.locale === "ru" ? " и " : " & ") : "Ваши имена")}</h3>
      <div className="studio-draft-rule" aria-hidden="true" />
      <p className="studio-draft-date">{dateLabel}{time && <span>{time}</span>}</p>
      <p className="studio-draft-venue">{content.venue.name || "Место встречи"}<span>{content.venue.address || "Адрес для ваших гостей"}</span></p>
      <p className="studio-draft-footer">{content.locale === "ru" ? "Будем рады разделить этот день с вами" : content.locale === "en" ? "We look forward to celebrating with you" : "Bu kunni siz bilan baham ko‘rishdan mamnunmiz"}</p>
    </div>
    <p className="studio-draft-note">Эскиз показывает ваши данные. Готовые дизайны появятся после создания.</p>
  </div>;
}
