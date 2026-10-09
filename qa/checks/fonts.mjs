import { finding, result } from "./result.mjs";
export const fonts = (data) => result("fonts", data.fonts.filter((font) => !font.loaded || font.difference > .5).map((font) => finding(data, font.selector, "Зарегистрированный шрифт не загрузился или заменён запасным.")), data.fonts.length);
