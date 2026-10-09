import Link from "next/link";
import { demoConcepts } from "@/lib/projects/read";
import "./demo.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Пять приглашений · Invitation Studio" };
export default async function DemoPage() {
  const concepts = await demoConcepts();
  return <main className="demo-index"><Link href="/">← Invitation Studio</Link>
    <aside className="demo-new-direction"><span>Новое направление · генеративное оформление</span><Link href="/preview/demo/arch/2">Сузани · Atelier ↗</Link><p>Бархат, объёмная вышивка и гранатовые ветви. Посмотреть обновлённое приглашение.</p></aside>
    <h1>Один вечер.<br />Пять разных голосов.</h1>
    <p>Рустам и Амина · 24 апреля 2027 · Ташкент</p>
    <p>Демонстрационный проект. Данные события и контакты вымышлены.</p>
    <ol>{concepts.map((concept, index) => <li key={concept.id}>
      <span className="demo-number">0{index + 1}</span><div><h2><Link href={`/preview/demo/${concept.id}/${concept.version}`}>{concept.theme.meta.name} ↗</Link></h2><p>{concept.theme.meta.rationale}</p></div>
      <span className="demo-palette" aria-hidden="true">{[concept.theme.palette.bg, concept.theme.palette.ink, concept.theme.palette.accent].map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>
    </li>)}</ol>
  </main>;
}
