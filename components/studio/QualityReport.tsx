"use client";
import { qaStatus, type QaState } from "@/lib/schema/qa";
const labels: Record<string, string> = { overflow: "Ширина страницы", collision: "Перекрытия текста", clipping: "Обрезка текста", contrast: "Контраст текста", measure: "Длина строки", widow: "Переносы заголовков", fonts: "Загрузка шрифтов", tap: "Размер кнопок", resolution: "Разрешение фото", "reduced-motion": "Уменьшение движения", lcp: "Скорость первого экрана", cls: "Сдвиги при загрузке", "face-crop": "Защита лиц и кадра", "busy-photo": "Текст на фотографиях", alignment: "Выравнивание · AI" };
const statuses = { passed: "Проверено", warning: "Есть замечания", failed: "Найдены ошибки", incomplete: "Проверка не завершена", stale: "Проверка устарела", missing: "Ещё не проверено" };
const checkStatuses = { pass: "✓", fail: "Ошибка", warning: "Замечание", error: "Не проверено", skipped: "Не проверено" };
export function QualityReport({ qa, pendingEdits, checking, elapsed, disabled, onCheck }: { qa?: QaState; pendingEdits: boolean; checking: boolean; elapsed: number; disabled: boolean; onCheck: () => void }) {
  const status = qa ? qa.stale || pendingEdits ? "stale" : qaStatus(qa.report) : "missing";
  return <div className="studio-qa" data-qa-status={status}>
    <div className="studio-qa-row"><span className={`studio-qa-badge qa-${status}`}>{statuses[status]}</span><button type="button" className="studio-text-button" disabled={disabled || pendingEdits} onClick={onCheck}>{checking ? `Проверяем · ${elapsed} с` : qa ? "Проверить снова" : "Проверить дизайн"}</button></div>
    {qa && <details><summary>Результат проверки · 390 / 1024 / 1440 px</summary>
      {status === "stale" && <p>Данные или оформление изменились. Перед выбором повторите проверку.</p>}
      {status === "incomplete" && <p>Не все проверки выполнены. Проверьте доступность браузера и AI в настройках сервера, затем повторите.</p>}
      <ul className="studio-qa-checks">{qa.report.checks.map((check) => <li key={check.id}><div><strong>{labels[check.id]}</strong><span>{checkStatuses[check.status]}</span></div>{check.findings.slice(0, 12).map((finding, index) => <p key={index}>{finding.viewport} px · {finding.message}{finding.observed !== undefined && finding.expected !== undefined ? ` (${finding.observed}; ориентир ${finding.expected})` : ""}<small>{finding.selector}</small></p>)}{check.findings.length > 12 && <p>Ещё {check.findings.length - 12} замечаний этого типа.</p>}</li>)}</ul>
      <div className="studio-qa-evidence">{qa.report.evidence.filter((entry) => entry.file.startsWith("viewport-")).map((entry) => <a key={entry.file} href={`/api/projects/${qa.report.slug}/qa/${qa.report.conceptId}/${qa.report.version}/${entry.file}`} target="_blank" rel="noreferrer">{entry.label} ↗</a>)}</div>
      {qa.report.measurements && <p>Fast 3G · CPU ×4: LCP {qa.report.measurements.lcpMs === null ? "не измерен" : `${(qa.report.measurements.lcpMs / 1000).toFixed(2)} с`}; CLS {qa.report.measurements.cls === null ? "не измерен" : qa.report.measurements.cls.toFixed(3)}. Измерение загрузки до взаимодействия, без прокрутки.</p>}
      <p className="studio-help">{new Date(qa.report.createdAt).toLocaleString("ru-RU")} · Геометрия и пиксели всей страницы; AI проверяет первый экран и до двух фото. Предупреждения о длине строк и скорости требуют оценки человеком.</p>
    </details>}
    <p className="studio-help">Проверка делает снимки дизайна и передаёт первый экран и до двух фото AI для поиска видимых дефектов.</p>
  </div>;
}
