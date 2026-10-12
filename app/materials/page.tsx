import Link from "next/link";
import { materialExamples } from "@/lib/materials/examples";
import "./materials.css";

export const metadata = { title: "Объёмные материалы · Invitation Studio", robots: { index: false, follow: false } };
export default function Materials() {
  return <main className="materials-gallery"><header><Link href="/studio">← В студию</Link><p>Коллекция приглашений</p><h1>Материалы с характером</h1><span>Три самостоятельные композиции. Откройте пример, чтобы посмотреть движение и детали.</span></header>
    <div className="materials-gallery-grid">{materialExamples.map((example, i) => <article key={example.id}><div className="materials-gallery-heading"><small>0{i + 1}</small><h2>{example.name}</h2><p>{example.note}</p></div><iframe src={`/materials/${example.id}?embed=1`} title={example.name} loading="lazy" /><Link href={`/materials/${example.id}`}>Открыть приглашение <span aria-hidden="true">↗</span></Link></article>)}</div>
  </main>;
}
