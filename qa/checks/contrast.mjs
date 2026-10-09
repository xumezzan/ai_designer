import sharp from "sharp";
import { finding, result } from "./result.mjs";
const luminance = (rgb) => rgb.map((channel) => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
export async function contrast(data, png, mask) {
  const { data: pixels, info } = await sharp(png, { limitInputPixels: 30000000 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const marked = mask ? await sharp(mask, { limitInputPixels: 30000000 }).removeAlpha().raw().toBuffer({ resolveWithObject: true }) : null;
  if (marked && (marked.info.width !== info.width || marked.info.height !== info.height)) throw new Error("Glyph mask dimensions changed");
  const colorAt = (x, y) => { const offset = (Math.max(0, Math.min(info.height - 1, Math.round(y))) * info.width + Math.max(0, Math.min(info.width - 1, Math.round(x)))) * info.channels; return [...pixels.subarray(offset, offset + 3)]; };
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const findings = [];
  for (const box of data.fragments) {
    if (box.y + box.h > info.height || !box.alpha) continue;
    const background = [];
    for (let x = box.x + 1; x < box.x + box.w; x += Math.max(1, box.w / 20)) background.push(colorAt(x, box.y - 2), colorAt(x, box.y + box.h + 2));
    if (!background.length) continue;
    const bg = [0, 1, 2].map((channel) => median(background.map((color) => color[channel])));
    let closest = Infinity, foreground = box.color;
    const cores = [];
    for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
      const pixel = colorAt(x, y), distance = pixel.reduce((sum, channel, index) => sum + (channel - box.color[index]) ** 2, 0);
      if (distance < closest) { closest = distance; foreground = pixel; }
      if (marked && x >= 0 && x < info.width && y >= 0 && y < info.height) {
        const offset = (Math.round(y) * info.width + Math.round(x)) * marked.info.channels;
        const marker = marked.data.subarray(offset, offset + 3);
        if (marker[0] > 240 && marker[1] < 15 && marker[2] > 240) cores.push(ratio(pixel, bg));
      }
    }
    const min = box.size >= 24 || (box.size >= 18.66 && box.weight >= 700) ? 3 : 4.5;
    if (marked && !cores.length) {
      findings.push(finding(data, box.selector, "Не удалось выделить непрозрачные штрихи текста. Оцените читаемость вручную.", "warning"));
      continue;
    }
    cores.sort((a, b) => a - b);
    // A lower percentile tolerates isolated edge/registration pixels, while
    // still catching weak highlights across a meaningful part of the lettering.
    const measured = Math.min(marked ? cores[Math.floor(cores.length * .05)] : ratio(foreground, bg), ratio(box.color, bg));
    if (measured < min - .05) findings.push(finding(data, box.selector, "Текст недостаточно контрастен на фактическом фоне.", "error", Math.round(measured * 100) / 100, min));
  }
  return result("contrast", findings, data.fragments.length);
}
