import { finding, result } from "./result.mjs";
export const resolution = (data) => {
  const images = [...data.photos, ...(data.visuals ?? [])];
  return result("resolution", images.filter((image) => image.density < 1.98).map((image) => finding(data, image.selector, image.density < .98 ? "Изображение увеличено сверх исходного разрешения." : "Для экрана с плотностью 2× изображение недостаточно чёткое.", image.density < .98 ? "error" : "warning", Math.round(image.density * 100) / 100, 2)), images.length);
};
