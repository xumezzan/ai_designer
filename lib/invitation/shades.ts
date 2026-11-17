import type { Content } from "@/lib/schema/content";

const shades = [
  { hex: "#BEC5AF", ru: "Шалфей", en: "Sage", "uz-latn": "Mavrak" },
  { hex: "#D5BCAA", ru: "Песочный", en: "Sand", "uz-latn": "Qumrang" },
  { hex: "#967B71", ru: "Какао", en: "Cocoa", "uz-latn": "Kakao" },
  { hex: "#645E69", ru: "Дымчатый", en: "Smoke", "uz-latn": "Tutunrang" },
  { hex: "#B77559", ru: "Терракота", en: "Terracotta", "uz-latn": "Terakota" },
  { hex: "#C5A880", ru: "Шампань", en: "Champagne", "uz-latn": "Shampan" },
  { hex: "#2C2A29", ru: "Графит", en: "Graphite", "uz-latn": "Grafit" },
  { hex: "#F5F2EB", ru: "Молочный", en: "Ivory", "uz-latn": "Fil suyagi" },
  { hex: "#A5B7C7", ru: "Небесный", en: "Sky", "uz-latn": "Osmonrang" },
  { hex: "#D9B0B5", ru: "Пудровый", en: "Blush", "uz-latn": "Pushti" },
  { hex: "#4E644E", ru: "Лесной", en: "Forest", "uz-latn": "Oʻrmon" },
  { hex: "#78434A", ru: "Винный", en: "Wine", "uz-latn": "Sharob" },
] as const;

const rgb = (hex: string) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));

/** Descriptive nearest shade; the exact supplied hex remains the source of truth. */
export function shadeName(hex: string, locale: Content["locale"]): string {
  const color = rgb(hex);
  if (color.some(Number.isNaN)) return hex;
  let nearest: (typeof shades)[number] = shades[0];
  let distance = Infinity;
  for (const shade of shades) {
    const candidate = rgb(shade.hex).reduce((sum, channel, index) => sum + (channel - color[index]) ** 2, 0);
    if (candidate < distance) { nearest = shade; distance = candidate; }
  }
  return nearest[locale];
}
