import { finding, result } from "./result.mjs";
export const busyPhoto = (data) => result("busy-photo", data.busy.map((text) => finding(data, text.selector, "Текст накладывается на изображение; нужна проверка читаемости.", "warning")), data.photos.length + (data.visuals?.length ?? 0));
