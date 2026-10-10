import { finding, result } from "./result.mjs";
export function overflow(data) {
  const problems = data.fragments.filter((box) => box.x < -1 || box.x + box.w > data.viewport + 1);
  const findings = problems.map((box) => finding(data, box.selector, "Текст выходит за ширину экрана."));
  if (data.scrollWidth > data.viewport + 1) findings.push(finding(data, "html", "Страница шире экрана.", "error", data.scrollWidth, data.viewport));
  return result("overflow", findings, data.fragments.length);
}
