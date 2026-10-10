import { finding, result } from "./result.mjs";
export function collision(data) {
  const findings = [], boxes = data.fragments;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.id === b.id) continue;
    const x = a.ink ?? a, y = b.ink ?? b;
    const w = Math.min(x.x + x.w, y.x + y.w) - Math.max(x.x, y.x), h = Math.min(x.y + x.h, y.y + y.h) - Math.max(x.y, y.y);
    if (w > 2 && h > 2) findings.push(finding(data, `${a.selector}, ${b.selector}`, "Текстовые блоки перекрывают друг друга."));
  }
  return result("collision", findings, boxes.length);
}
