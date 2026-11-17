import Link from "next/link";
import { studioTemplates, studioPalettes } from "@/registry/studioTemplates";
import "./templates.css";

export const metadata = { title: "Авторские шаблоны · Invitation Studio", robots: { index: false, follow: false } };
export default function Templates() {
  return <main className="template-library">
    <div className="template-library-top"><Link href="/studio">← В студию</Link><span>Invitation Studio / Collection 01</span></div>
    <header><p>Семь характеров. Одна студия.</p><h1>Дизайн начинается<br /><em>с композиции.</em></h1><div>Готовые авторские шаблоны с выверенной типографикой, материалами и движением. Выберите подходящий характер — палитру и тексты настроим под ваше событие.</div></header>
    <div className="template-library-grid">{studioTemplates.map((template, index) => {
      const palette = studioPalettes[template.defaultPaletteId];
      return <article key={template.id}><Link className="template-library-preview" href={`/templates/${template.id}`} style={{ background: palette.bg, color: palette.ink }} aria-label={`Открыть шаблон ${template.name}`}><iframe src={`/templates/${template.id}?embed=1`} loading="lazy" title={`Пример: ${template.name}`} tabIndex={-1} /><span>Посмотреть приглашение ↗</span></Link><div className="template-library-caption"><small>0{index + 1}</small><div><h2><Link href={`/templates/${template.id}`}>{template.name}</Link></h2><p>{template.description}</p></div></div></article>;
    })}</div>
    <footer>Данные в примерах вымышленные. В вашем приглашении остаются ваши фотографии и редактируемый текст.</footer>
  </main>;
}
