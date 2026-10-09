import Link from "next/link";
import { projectStore } from "@/lib/studio/store";

export const dynamic = "force-dynamic";
export default async function StudioPage() {
  const projects = await projectStore.list();
  return <main className="studio-main"><div className="studio-page-heading"><div><p className="studio-eyebrow">Место для особенных событий</p><h1>Ваши приглашения</h1><p className="studio-subtitle">От первых слов до своего визуального почерка.</p></div><Link className="studio-primary" href="/studio/new">+ Новый проект</Link></div>
    {projects.length ? <div className="studio-project-list">{projects.map((project) => <Link className="studio-project" href={`/studio/${project.slug}`} key={project.slug}><div className="studio-project-initial" aria-hidden="true">{project.names.slice(0, 1)}</div><div className="studio-project-description"><span className="studio-tag">{project.slug === "demo" ? "Демонстрационный проект" : "В работе"}</span><h2>{project.names}</h2><p>{new Intl.DateTimeFormat("ru", { timeZone: project.timezone, day: "numeric", month: "long", year: "numeric" }).format(new Date(project.date))} · {project.venue}</p></div><span className="studio-project-count">{project.count} вариантов <span aria-hidden="true">↗</span></span></Link>)}</div> : <div className="studio-empty"><h2>Здесь появится ваше первое событие</h2><p>Заполните анкету, добавьте фотографии и сравните пять вариантов приглашения.</p><Link href="/studio/new" className="studio-primary">Создать проект</Link></div>}
    <div className="studio-workflow"><span>01 <strong>Расскажите о событии</strong></span><span>02 <strong>Соберите фотографии и референсы</strong></span><span>03 <strong>Сравните пять дизайнов</strong></span></div>
  </main>;
}
