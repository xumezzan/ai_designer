import { finding, result } from "./result.mjs";
export const measure = (data) => result("measure", data.measures.filter((item) => item.characters < 45 || item.characters > 80).map((item) => finding(data, item.selector, "Ширина длинного текста выходит за диапазон 45–80 знаков.", "warning", Math.round(item.characters), item.characters < 45 ? 45 : 80)), data.measures.length);
