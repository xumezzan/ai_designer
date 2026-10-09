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
