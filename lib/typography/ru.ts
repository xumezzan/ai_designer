/**
 * Micro-typography for the studio's locales (SPEC §7.1, craft layer).
 *
 * Theme-independent, applied to every string before render, never exposed to
 * the AI — a theme cannot switch any of this off. Each rule has a unit test in
 * `ru.test.ts`; the rules are the ones §7.1 lists, no more.
 *
 * The functions are pure string transforms and safe to apply to plain text
 * only. They must run on text values, never on markup: quote detection reads
 * character context, it does not parse HTML.
 *
 * Every rule is idempotent: `typograph(typograph(x)) === typograph(x)`.
 */

/** Non-breaking space — glues a word to the one it belongs with. */
export const NBSP = " ";
/** Thin space — the space after an em dash. */
export const THIN_SPACE = " ";
export const EM_DASH = "—";
/** ʻ — Uzbek after O/o and G/g (oʻzbek, Gʻani). */
export const UZ_OCHEL = "ʻ";
/** ʼ — Uzbek tutuq belgisi everywhere else (maʼno, sanʼat). */
export const UZ_TUTUQ = "ʼ";

export type Locale = "ru" | "uz-latn" | "en";

const SPACE = " ";

// ---------------------------------------------------------------------------
// Quotes — «» at the first level, „“ at the second

const OPEN_BY_DEPTH = ["«", "„"] as const;
const CLOSE_BY_DEPTH = ["»", "“"] as const;

/** Characters after which a quote mark opens rather than closes. */
const OPENS_AFTER = /[ ([{«„—–‹]/;

function isOpening(prev: string | undefined, next: string | undefined): boolean {
  if (prev === undefined) return true;
  if (OPENS_AFTER.test(prev)) return true;
  // Between two letters a mark is an apostrophe, not a quote.
  if (/[\p{L}\p{N}]/u.test(prev) && next !== undefined && /[\p{L}]/u.test(next)) return false;
  return false;
}

/**
 * Straight `"…"` / `'…'` become Russian nested quotes: `«…»` outside, `„…“`
 * inside. Manually typed «„“» are tracked too, so nesting depth stays correct
 * in mixed input.
 */
export function quotes(input: string): string {
  const stack: string[] = [];
  let out = "";

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i] as string;

    if (ch === "«" || ch === "„") {
      stack.push(ch === "«" ? CLOSE_BY_DEPTH[0] : CLOSE_BY_DEPTH[1]);
      out += ch;
      continue;
    }
    if (ch === "»" || ch === "“") {
      if (stack[stack.length - 1] === ch) stack.pop();
      out += ch;
      continue;
    }
    if (ch !== '"' && ch !== "'") {
      out += ch;
      continue;
    }

    const prev = out.length > 0 ? out[out.length - 1] : undefined;
    const next = i + 1 < input.length ? input[i + 1] : undefined;

    // A straight mark between two letters is an apostrophe (O'zbek,
    // д'Артаньян), never a quote mark.
    if (
      ch === "'" &&
      prev !== undefined &&
      /[\p{L}]/u.test(prev) &&
      next !== undefined &&
      /[\p{L}]/u.test(next)
    ) {
      out += ch;
      continue;
    }

    if (stack.length === 0 || isOpening(prev, next)) {
      const depth = stack.length;
      stack.push(CLOSE_BY_DEPTH[depth % 2] as string);
      out += OPEN_BY_DEPTH[depth % 2];
      continue;
    }

    out += stack.pop() ?? CLOSE_BY_DEPTH[0];
  }

  return out;
}

// ---------------------------------------------------------------------------
// Dashes — a real em dash where a dash is meant

/** Four-digit years are a range: 1920—1990, no spaces, no hyphen. */
const YEAR_RANGE_RE = /(?<!\d)(\d{4})(?: )*[-–—](?: )*(\d{4})(?!\d)/g;

/**
 * A dash standing between words becomes NBSP + em dash + thin space: the dash
 * never starts a line. Unspaced hyphens are compounds (из-за) and phone
 * numbers (+998 90 123-45-67) and are left alone.
 */
const SPACED_DASH_RE = /(?<=[^\s])(?<![-–—([{«„“])(?: )*[-–—](?: )+(?![-–—])/gu;

export function emDash(input: string): string {
  return input
    .replace(YEAR_RANGE_RE, `$1${EM_DASH}$2`)
    .replace(SPACED_DASH_RE, `${NBSP}${EM_DASH}${THIN_SPACE}`);
}

// ---------------------------------------------------------------------------
// Non-breaking spaces

/**
 * One- and two-letter prepositions, conjunctions and particles. A line must
 * never end on one of these, so the space after it is non-breaking.
 */
export const SHORT_WORDS = [
  "бы", "же", "ли", "во", "ко", "об", "от", "до", "за", "из", "на", "не",
  "ни", "но", "ну", "по", "со", "то", "да", "а", "б", "в", "и", "к", "о",
  "с", "у",
] as const;

const SHORT_WORD_RE = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${SHORT_WORDS.join("|")})(?![\\p{L}\\p{N}_])${SPACE}`,
  "giu",
);

/** No preposition or particle is left dangling at the end of a line. */
export function nbspAfterShortWords(input: string): string {
  return input.replace(SHORT_WORD_RE, (_match, word: string) => `${word}${NBSP}`);
}

/** Units that belong to the number before them: `5 км`, `20 °C`, `100 %`. */
export const UNITS = [
  "мм", "см", "дм", "мг", "кг", "км", "мл", "сек", "мин", "сум",
  "м", "г", "л", "т", "ц", "ч", "с",
  "°C", "°F", "°",
  "₽", "$", "€", "£", "%",
] as const;

const NUMBER_UNIT_RE = new RegExp(
  `(\\d(?:[\\d.,${NBSP} ]\\d)*)(?:${NBSP}| )+(${UNITS.join("|")})(?![\\p{L}])`,
  "giu",
);

/** The number and its unit are one token. */
export function nbspNumberUnit(input: string): string {
  return input.replace(
    NUMBER_UNIT_RE,
    (_match, digits: string, unit: string) => `${digits}${NBSP}${unit}`,
  );
}

/** Initials stay together and stay with the surname: `А. П. Чехов`. */
export function nbspInInitials(input: string): string {
  return input
    .replace(/([А-ЯЁA-Z])\.(?: )?(?=[А-ЯЁA-Z]\.)/g, `$1.${NBSP}`)
    .replace(
      new RegExp(
        `((?:[А-ЯЁA-Z]\\.${NBSP}){0,3}[А-ЯЁA-Z]\\.)(?:${NBSP}| )+([А-ЯЁ][а-яё]+)`,
        "g",
      ),
      `$1${NBSP}$2`,
    );
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа",
  "сентября", "октября", "ноября", "декабря",
  "январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август",
  "сентябрь", "октябрь", "ноябрь", "декабрь",
] as const;

const gluing = `(?:${NBSP}| )+`;

/** Day, month and year are one token: `12 июня 2027`. */
const FULL_DATE_RE = new RegExp(
  `(\\d{1,2})${gluing}(${MONTHS.join("|")})${gluing}(\\d{4})(?![\\p{L}\\d])`,
  "giu",
);

/** Day and month, with no year after them: `12 июня`. */
const DAY_MONTH_RE = new RegExp(
  `(\\d{1,2})${gluing}(${MONTHS.join("|")})(?![\\p{L}])`,
  "giu",
);

/** Dates do not break: `12 июня 2027`, `2027 г.`, `2025—2026 гг.` */
export function nbspInDates(input: string): string {
  return input
    .replace(FULL_DATE_RE, `$1${NBSP}$2${NBSP}$3`)
    .replace(DAY_MONTH_RE, `$1${NBSP}$2`)
    .replace(new RegExp(`(\\d{4})${gluing}(гг?\\.|г\\.(?: ?г\\.)?)(?![\\p{L}])`, "giu"), `$1${NBSP}$2`);
}

// ---------------------------------------------------------------------------
// Uzbek Latin apostrophes

/**
 * The typewriter `'` is wrong in both Uzbek positions. After O/o and G/g it is
 * the modifier letter turned comma (U+02BB); everywhere else the tutuq
 * belgisi (U+02BC). Curly quotes typed by mistake are normalised as well.
 */
export function uzbekApostrophes(input: string): string {
  return input.replace(
    /([\p{L}]|^)(['’‘ʻʼ])(?=\p{L})/gu,
    (_match, before: string) =>
      `${before}${before === "O" || before === "o" || before === "G" || before === "g" ? UZ_OCHEL : UZ_TUTUQ}`,
  );
}

// ---------------------------------------------------------------------------
// Composition

/**
 * Apply every craft-layer typography rule for `locale`.
 *
 * `ru` — the full set. `uz-latn` — apostrophes, dashes, numbers and units;
 * Russian short words and month names do not apply. `en` — nothing: these are
 * Russian and Uzbek conventions, and a half-applied rule reads worse than
 * none.
 */
export function typograph(input: string, locale: Locale = "ru"): string {
  if (locale === "en") return input;

  if (locale === "uz-latn") {
    return emDash(nbspNumberUnit(uzbekApostrophes(input)));
  }

  return nbspInDates(
    nbspNumberUnit(nbspInInitials(nbspAfterShortWords(emDash(quotes(input))))),
  );
}
