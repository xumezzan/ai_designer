import Link from "next/link";
import { projectStore } from "@/lib/studio/store";
import { variantCountLabel } from "@/lib/schema/variantCount";
import { ProjectThumbnail } from "@/components/studio/ProjectThumbnail";

export const dynamic = "force-dynamic";
export default async function StudioPage() {
  const projects = await projectStore.list();
  return <main className="studio-main"><div className="studio-page-heading"><div><h1>Ваши приглашения</h1><p className="studio-subtitle">События, над которыми вы работаете.</p></div><Link className="studio-primary" href="/studio/new">+ Новый проект</Link></div>
    {projects.length ? <div className="studio-project-list">{projects.map((project) => <Link className="studio-project" href={`/studio/${project.slug}`} key={project.slug}>
      {project.preview ? <ProjectThumbnail src={project.preview.href} names={project.names} /> : <div className="studio-project-thumbnail studio-project-placeholder">Ваше приглашение<br />начинается здесь</div>}
      <div className="studio-project-description"><span className="studio-tag">{project.slug === "demo" ? "Демонстрационный проект" : "В работе"}</span><h2>{project.names || "Новое приглашение"}</h2><p>{project.date ? new Intl.DateTimeFormat("ru", { timeZone: project.timezone, day: "numeric", month: "long", year: "numeric" }).format(new Date(project.date)) : project.day ? new Intl.DateTimeFormat("ru", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${project.day}T12:00:00Z`)) : "Дата пока не указана"}{project.venue && ` · ${project.venue}`}</p>{project.preview && <span className="studio-project-design">{project.preview.selected ? "Выбранный дизайн" : "Первый вариант серии"}</span>}</div><span className="studio-project-count">{variantCountLabel(project.count)} <span aria-hidden="true">↗</span></span>
    </Link>)}</div> : <div className="studio-empty"><h2>Здесь появится ваше первое событие</h2><p>Опишите идею, добавьте референсы — и получите дизайн. Данные события можно заполнить позже.</p><Link href="/studio/new" className="studio-primary">Создать проект</Link></div>}
    <div className="studio-workflow"><span>01 <strong>Расскажите о событии</strong></span><span>02 <strong>Соберите фотографии и референсы</strong></span><span>03 <strong>Выберите свой дизайн</strong></span></div>
  </main>;
}
