"use client";
export default function PreviewError({ reset }: { reset: () => void }) {
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6">
    <h1>Приглашение не удалось открыть</h1><p>Проверьте content.json, asset-plan.json и файл выбранной темы. Даты, ссылки и оформление должны проходить проверку.</p>
    <button onClick={reset}>Повторить загрузку</button>
  </main>;
}
