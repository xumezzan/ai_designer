import sharp from "sharp";
import { relativeLuminance } from "@/lib/theme/validate";

export function visualMatte(background: string) {
  return relativeLuminance(background) < .35 ? "#000000" : "#FFFFFF";
}

/** Remove the neutral matte, including faint compression noise, from decoration.
 * Partial coverage is un-matted before encoding so anti-aliased lines have no halo.
 * Existing source transparency is retained; no invitation text enters this pipeline.
 */
export async function isolateDecoration(source: Buffer, matte: "#000000" | "#FFFFFF") {
  const { data, info } = await sharp(source, { limitInputPixels: 16777216 }).rotate().toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const white = matte === "#FFFFFF";
  for (let offset = 0; offset < data.length; offset += 4) {
    const channels = [data[offset], data[offset + 1], data[offset + 2]];
    const distance = white ? 255 - Math.min(...channels) : Math.max(...channels);
    const coverage = distance <= 10 ? 0 : distance / 255;
    for (let channel = 0; channel < 3; channel++) {
      data[offset + channel] = coverage === 0 ? 0 : Math.round(Math.max(0, Math.min(255,
        white ? 255 - (255 - channels[channel]) / coverage : channels[channel] / coverage)));
    }
    data[offset + 3] = Math.round(data[offset + 3] * coverage);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ lossless: true }).toBuffer();
}
