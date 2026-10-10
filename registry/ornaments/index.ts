import type { OrnamentPackId } from "../keys";

/** Eightfold repetition and radial floral geometry, not downloaded clipart. */
const star = "50,8 62,21 79,21 79,38 92,50 79,62 79,79 62,79 50,92 38,79 21,79 21,62 8,50 21,38 21,21 38,21";
const geometric = `<polygon points="${star}"/><rect x="26" y="26" width="48" height="48"/><rect x="26" y="26" width="48" height="48" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="12"/>`;
const flower = Array.from({ length: 8 }, (_, index) =>
  `<ellipse cx="50" cy="29" rx="7" ry="17" transform="rotate(${index * 45} 50 50)"/>`).join("") +
  '<circle cx="50" cy="50" r="8"/><circle cx="50" cy="50" r="45"/>';

type Elements = Record<"divider" | "corners" | "hero-frame" | "watermark", string>;
export const ornaments: Record<OrnamentPackId, { elements: Elements }> = {
  none: { elements: { divider: "", corners: "", "hero-frame": "", watermark: "" } },
  "art-deco": { elements: {
    divider: '<path d="M5 50H32L50 32 68 50H95M32 50L50 68 68 50M50 8V25M50 75V92"/>',
    corners: '<path d="M12 88V12H88M22 78V22H78M32 68V32H68M12 42L42 12M12 62L62 12"/>',
    watermark: '<path d="M50 8L92 50 50 92 8 50ZM50 22L78 50 50 78 22 50ZM50 36L64 50 50 64 36 50ZM50 8V92M8 50H92"/>',
    "hero-frame": '<path d="M8 95V20L20 8H80L92 20V95M15 95V24L24 15H76L85 24V95M35 8L50 25 65 8M42 8L50 17 58 8"/>',
  } },
  "geometric-islamic": { elements: {
    divider: geometric, corners: geometric, watermark: geometric,
    "hero-frame": '<path d="M8 95V38L50 5 92 38V95"/><g transform="translate(42 12) scale(.16)">' + geometric + '</g>',
  } },
  "uzbek-suzani": { elements: {
    divider: flower, corners: flower, watermark: flower,
    "hero-frame": '<path d="M8 95V35C8 3 92 3 92 35V95"/><g transform="translate(42 6) scale(.16)">' + flower + '</g>',
  } },
};
export function getOrnament(id: OrnamentPackId) { return ornaments[id]; }
