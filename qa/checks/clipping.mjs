import { finding, result } from "./result.mjs";
export const clipping = (data) => result("clipping", data.clipping.map((box) => finding(data, box.selector, "Текст обрезан границей блока.")), data.fragments.length);
