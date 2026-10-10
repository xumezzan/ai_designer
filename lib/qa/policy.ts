import { qaStatus, type QaState } from "@/lib/schema/qa";
export function approvalProblem(qa: QaState | undefined, override = false): string | null {
  if (!qa || qa.stale) return "Проверьте эту версию на текущих данных перед выбором.";
  const status = qaStatus(qa.report);
  if (status === "incomplete") return "Проверка не завершена. Повторите её перед выбором.";
  if (status === "failed" && !override) return "Есть ошибки в дизайне. Исправьте их или явно выберите вариант с замечаниями.";
  return null;
}
