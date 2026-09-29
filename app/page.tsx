export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">Invitation Studio</h1>
      <p>
        Внутренняя студия приглашений для событий. Интерфейс студии появится в
        вехе M2; сейчас заложены основания: схемы данных, реестры шрифтов и
        материалов, преобразование темы в CSS-переменные, проверка контраста.
      </p>
      <p className="text-sm text-neutral-600">
        Полное описание — в SPEC.md. Статус вех и решения — в docs/decisions.md.
      </p>
    </main>
  );
}
