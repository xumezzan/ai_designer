import type { StudioSelection } from "@/lib/schema/studioTemplate";

const modernEditorial = "modern-editorial";
const botanicalHaute = "botanical-haute";
const velvetNoir = "velvet-noir";

export const moodPalettes = {
  [modernEditorial]: {
    name: "Журнальная бумага",
    bg: "#FAF9F6", surface: "#F3F1EC", ink: "#1A1A1A",
    muted: "#635B54", accent: "#8C7A6B", accentAlt: "#8C7A6B",
  },
  [botanicalHaute]: {
    name: "Лён и шалфей",
    bg: "#F5F4F0", surface: "#EAE7DF", ink: "#2C352D",
    muted: "#52604F", accent: "#B89778", accentAlt: "#8A9A86",
  },
  [velvetNoir]: {
    name: "Уголь и золото",
    bg: "#0F0F0F", surface: "#1A1A1A", ink: "#E5E5E5",
    // Keep the specified gray as an ornament/control outline. Copy still
    // needs 4.5:1 against both dark surfaces.
    muted: "#A4A4A4", accent: "#D4AF37", accentAlt: "#737373",
  },
};

type MoodProfile = {
  id: string;
  className: string;
  name: string;
  description: Record<"ru" | "uz-latn", string>;
  selection: StudioSelection & { composition: NonNullable<StudioSelection["composition"]> };
  css: Record<string, string>;
};

export const moodProfiles: readonly MoodProfile[] = [
  {
    id: modernEditorial,
    className: "theme-editorial",
    name: "Modern Editorial",
    description: {
      ru: "Матовая бумага, журнальная сетка и контрастная антиква.",
      "uz-latn": "Xira qog‘oz, jurnal to‘ri va kontrastli antikva.",
    },
    selection: {
      templateId: "editorial",
      paletteId: modernEditorial,
      fontPairId: modernEditorial,
      ornamentSetId: "editorial-rules",
      composition: {
        heroLayout: "split-editorial",
        photoShape: "sharp",
        surfaceStyle: "bordered-hairline",
        spacingScale: "airy-gallery",
        typographyAccent: "classic-centered",
        decorConfig: { placement: "dividers", density: "none", opacity: 0 },
        sectionVariants: { countdown: "inline", program: "editorial-list", venue: "split", gallery: "editorial", rsvp: "split" },
      },
    },
    css: {
      "--studio-rule": "#E2DFDA",
      "--studio-shadow": "none",
      "--mood-radius": "0px",
      "--mood-button-radius": "2px",
    },
  },
  {
    id: botanicalHaute,
    className: "theme-botanical",
    name: "Botanical Haute",
    description: {
      ru: "Лён, шалфей и мягкая бронза на живой ботанической обложке.",
      "uz-latn": "Zig‘ir, mavrak va mayin bronza botanik muqovada.",
    },
    selection: {
      templateId: "botanical",
      paletteId: botanicalHaute,
      fontPairId: botanicalHaute,
      ornamentSetId: "botanical-engraving",
      composition: {
        heroLayout: "framed-arch",
        photoShape: "rounded",
        surfaceStyle: "flat",
        spacingScale: "balanced",
        typographyAccent: "classic-centered",
        decorConfig: { placement: "corners", density: "subtle", opacity: 0.52 },
        sectionVariants: { countdown: "tiles", program: "timeline", venue: "stacked", gallery: "editorial", rsvp: "split" },
      },
    },
    css: {
      "--studio-rule": "color-mix(in srgb, var(--accent-alt) 42%, var(--bg))",
      "--studio-shadow": "0 20px 40px rgba(44, 53, 45, 0.06)",
      "--mood-radius": "16px",
      "--mood-button-radius": "16px",
      "--mood-control-line": "var(--muted)",
    },
  },
  {
    id: velvetNoir,
    className: "theme-noir",
    name: "Velvet Noir",
    description: {
      ru: "Чёрный бархат, матовое золото и мягкий свет вечернего зала.",
      "uz-latn": "Qora baxmal, xira oltin va oqshom zalining mayin nuri.",
    },
    selection: {
      templateId: "nocturne",
      paletteId: velvetNoir,
      fontPairId: velvetNoir,
      ornamentSetId: "deco-lines",
      composition: {
        heroLayout: "fullscreen-cover",
        photoShape: "sharp",
        surfaceStyle: "bordered-hairline",
        spacingScale: "airy-gallery",
        typographyAccent: "oversized-display",
        decorConfig: { placement: "frame", density: "subtle", opacity: 0.33 },
        sectionVariants: { countdown: "inline", program: "editorial-list", venue: "split", gallery: "editorial", rsvp: "split" },
      },
    },
    css: {
      "--studio-rule": "color-mix(in srgb, var(--accent-alt) 54%, var(--bg))",
      "--studio-shadow": "0 0 50px rgba(212, 175, 55, 0.08)",
      "--mood-radius": "6px",
      "--mood-button-radius": "6px",
      "--mood-control-line": "var(--accent-alt)",
    },
  },
  {
    id: "champagne-letter",
    className: "theme-champagne-letter",
    name: "Champagne Letter",
    description: {
      ru: "Камерное письмо на тёплой бумаге с двойной рамкой и вензелем.",
      "uz-latn": "Iliq tusli qog‘ozdagi, qo‘sh hoshiyali va monogrammali samimiy maktub.",
    },
    selection: {
      templateId: "classic",
      paletteId: "champagne",
      fontPairId: "editorial",
      ornamentSetId: "classic-monogram",
      composition: {
        heroLayout: "minimal-card",
        photoShape: "polaroid",
        surfaceStyle: "bordered-hairline",
        spacingScale: "balanced",
        typographyAccent: "classic-centered",
        motionPreset: "unfold",
        decorConfig: { placement: "frame", density: "rich", opacity: 0.38 },
        sectionVariants: { countdown: "date-led", program: "timeline", venue: "card", gallery: "grid", rsvp: "card" },
      },
    },
    css: {
      "--mood-radius": "0px",
      "--mood-button-radius": "2px",
      "--mood-control-line": "var(--muted)",
    },
  },
  {
    id: "rose-portrait",
    className: "theme-rose-portrait",
    name: "Rose Portrait",
    description: {
      ru: "Портрет на розовом паспарту, тонкий курсив и свободный ритм фотокниги.",
      "uz-latn": "Pushti paspartudagi portret, nafis kursiv va fotoalbomning erkin ritmi.",
    },
    selection: {
      templateId: "editorial",
      paletteId: "rose",
      fontPairId: "poetic",
      ornamentSetId: "editorial-rules",
      composition: {
        heroLayout: "split-editorial",
        photoShape: "sharp",
        surfaceStyle: "flat",
        spacingScale: "airy-gallery",
        typographyAccent: "italic-serif-accent",
        motionPreset: "drift",
        decorConfig: { placement: "dividers", density: "subtle", opacity: 0.26 },
        sectionVariants: { countdown: "inline", program: "editorial-list", venue: "stacked", gallery: "editorial", rsvp: "minimal" },
      },
    },
    css: {
      "--mood-radius": "0px",
      "--mood-button-radius": "999px",
      "--mood-control-line": "var(--muted)",
    },
  },
  {
    id: "forest-herbarium",
    className: "theme-forest-herbarium",
    name: "Forest Herbarium",
    description: {
      ru: "Лесная зелень, полностраничная обложка и рисунок ветвей со светлыми прожилками.",
      "uz-latn": "O‘rmon yashili, to‘liq ekranli muqova va och tomirli novdalar naqshi.",
    },
    selection: {
      templateId: "botanical",
      paletteId: "forest",
      fontPairId: "editorial",
      ornamentSetId: "botanical-engraving",
      composition: {
        heroLayout: "fullscreen-cover",
        photoShape: "arch",
        surfaceStyle: "soft-gradient",
        spacingScale: "balanced",
        typographyAccent: "classic-centered",
        motionPreset: "drift",
        decorConfig: { placement: "corners", density: "subtle", opacity: 0.47 },
        sectionVariants: { countdown: "tiles", program: "timeline", venue: "card", gallery: "filmstrip", rsvp: "card" },
      },
    },
    css: {
      "--mood-radius": "10px",
      "--mood-button-radius": "999px",
      "--mood-control-line": "var(--muted)",
    },
  },
  {
    id: "cobalt-poster",
    className: "theme-cobalt-poster",
    name: "Cobalt Poster",
    description: {
      ru: "Кобальтовая афиша с широким гротеском, графической сеткой и крупными цветными плоскостями.",
      "uz-latn": "Enli serifsiz yozuv, geometrik to‘r va yirik rangli shakllardan tuzilgan kobalt afisha.",
    },
    selection: {
      templateId: "modern",
      paletteId: "cobalt",
      fontPairId: "modernist",
      ornamentSetId: "corporate-grid",
      composition: {
        heroLayout: "typographic-poster",
        photoShape: "sharp",
        surfaceStyle: "flat",
        spacingScale: "compact-poster",
        typographyAccent: "oversized-display",
        motionPreset: "drift",
        decorConfig: { placement: "background-pattern", density: "subtle", opacity: 0.18 },
        sectionVariants: { countdown: "inline", program: "cards", venue: "split", gallery: "filmstrip", rsvp: "minimal" },
      },
    },
    css: {
      "--studio-rule": "color-mix(in srgb, var(--ink) 30%, var(--bg))",
      "--mood-radius": "0px",
      "--mood-button-radius": "0px",
      "--mood-control-line": "var(--muted)",
    },
  },
  {
    id: "slate-programme",
    className: "theme-slate-programme",
    name: "Slate Programme",
    description: {
      ru: "Сланцевая обложка, строгая типографика и компактная программа с карточками событий.",
      "uz-latn": "Slanets tusli muqova, qat’iy tipografika va tadbir kartochkalaridan tuzilgan ixcham dastur.",
    },
    selection: {
      templateId: "corporate",
      paletteId: "slate",
      fontPairId: "gallery",
      ornamentSetId: "editorial-rules",
      composition: {
        heroLayout: "minimal-card",
        photoShape: "sharp",
        surfaceStyle: "elevated-card",
        spacingScale: "compact-poster",
        typographyAccent: "uppercase-wide-tracking",
        motionPreset: "still",
        decorConfig: { placement: "dividers", density: "none", opacity: 0 },
        sectionVariants: { countdown: "date-led", program: "cards", venue: "card", gallery: "grid", rsvp: "split" },
      },
    },
    css: {
      "--mood-radius": "6px",
      "--mood-button-radius": "6px",
      "--mood-control-line": "var(--muted)",
    },
  },
  {
    id: "wine-deco",
    className: "theme-wine-deco",
    name: "Wine Deco",
    description: {
      ru: "Винная арка, золотистые линии ар-деко и тёплая книжная антиква.",
      "uz-latn": "Vino tusli ravoq, tillarang art-deko chiziqlari va nafis kitob antikvasi.",
    },
    selection: {
      templateId: "nocturne",
      paletteId: "wine",
      fontPairId: "ceremony",
      ornamentSetId: "deco-lines",
      composition: {
        heroLayout: "framed-arch",
        photoShape: "pill",
        surfaceStyle: "soft-gradient",
        spacingScale: "airy-gallery",
        typographyAccent: "classic-centered",
        motionPreset: "unfold",
        decorConfig: { placement: "frame", density: "subtle", opacity: 0.58 },
        sectionVariants: { countdown: "tiles", program: "editorial-list", venue: "split", gallery: "editorial", rsvp: "card" },
      },
    },
    css: {
      "--studio-rule": "color-mix(in srgb, var(--accent) 42%, var(--bg))",
      "--mood-radius": "8px",
      "--mood-button-radius": "2px",
      "--mood-control-line": "var(--muted)",
    },
  },
];

export function getMoodProfile(id: string) {
  return moodProfiles.find((profile) => profile.id === id);
}

export function resolveMoodProfile(selection: Partial<Record<"templateId" | "paletteId" | "fontPairId" | "ornamentSetId", string>>) {
  return moodProfiles.find(({ selection: recipe }) =>
    selection.paletteId === recipe.paletteId &&
    selection.fontPairId === recipe.fontPairId &&
    selection.templateId === recipe.templateId &&
    selection.ornamentSetId === recipe.ornamentSetId);
}
