import { finding, result } from "./result.mjs";
export const cls = (metrics) => result("cls", metrics.cls > .1 ? [finding({ viewport: 390 }, "main.invitation", "Во время загрузки заметно сдвигается содержимое.", "warning", Math.round(metrics.cls * 1000) / 1000, .1)] : []);
