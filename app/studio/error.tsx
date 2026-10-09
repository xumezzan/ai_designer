"use client";
import Link from "next/link";

export default function StudioErrorPage({ reset }: { reset: () => void }) {
  return <main className="studio-main studio-empty"><h1>Не удалось открыть проекты</h1><p>Проверьте доступ к папке projects и корректность сохранённых JSON-файлов.</p><button className="studio-primary" onClick={reset}>Повторить</button><Link href="/studio">К списку проектов</Link></main>;
}
