import { finding, result } from "./result.mjs";
export const widow = (data) => result("widow", data.widows.map((item) => finding(data, item.selector, "В последней строке заголовка осталось одно слово.", "warning")), data.widows.length);
