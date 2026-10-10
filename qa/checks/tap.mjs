import { finding, result } from "./result.mjs";
export const tap = (data) => result("tap", data.taps.filter((item) => item.w < 43.5 || item.h < 43.5).map((item) => finding(data, item.selector, "Ссылка или кнопка меньше 44 px.", "error", Math.round(Math.min(item.w, item.h)), 44)), data.taps.length);
