/**
 * Date arithmetic for a ruleset's own calendar.
 *
 * @remarks
 * A jump route is scheduled in the setting's dates, not the player's. Traveller
 * writes `097-1105` — day 97 of year 1105, 365 days to a year, no leap — and a
 * schedule that showed ISO dates would be one the table has to translate every
 * time it looks at it.
 *
 * Everything here works in an **absolute day number** internally, so "add
 * fourteen weeks" is addition and "are we ahead or behind" is subtraction. The
 * calendar only decides how that number is written down.
 */

/** How a ruleset writes dates. */
export interface RouteCalendar {
  /**
   * `day-of-year` is `DDD-YYYY`: Traveller's Imperial dating, and simple enough
   * that no other kind has been needed yet. A system declaring nothing falls
   * back to plain day numbers.
   */
  kind: 'day-of-year';
  /** Days in a year. 365 for the Imperium. */
  daysInYear: number;
  /** Shown to the user when a field is empty, e.g. `097-1105`. */
  example?: string;
}

/** Matches `97-1105`, `097-1105`, with optional surrounding space. */
const DAY_OF_YEAR = /^\s*(\d{1,3})\s*-\s*(\d{1,5})\s*$/;

/**
 * Reads a written date as an absolute day number.
 *
 * @remarks
 * Returns `null` rather than guessing. A half-typed date is the normal state of
 * an input the user is still filling in, and treating `09` as a real date would
 * make the whole schedule lurch while they type.
 *
 * With no calendar the text is read as a plain integer day, so a ruleset that
 * declares none still gets working arithmetic.
 */
export function parseRouteDate(text: string | undefined, cal?: RouteCalendar): number | null {
  if (text === undefined || text === null) return null;
  const trimmed = String(text).trim();
  if (trimmed === '') return null;

  if (!cal) {
    const n = Number(trimmed);
    return Number.isInteger(n) ? n : null;
  }

  const match = DAY_OF_YEAR.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const year = Number(match[2]);
  if (day < 1 || day > cal.daysInYear) return null;
  return year * cal.daysInYear + (day - 1);
}

/** Writes an absolute day number back in the ruleset's own form. */
export function formatRouteDate(absoluteDay: number, cal?: RouteCalendar): string {
  if (!Number.isFinite(absoluteDay)) return '';
  const day = Math.round(absoluteDay);
  if (!cal) return String(day);

  const year = Math.floor(day / cal.daysInYear);
  const dayOfYear = day - year * cal.daysInYear + 1;
  return `${String(dayOfYear).padStart(3, '0')}-${year}`;
}

/**
 * Whether a written date is readable.
 *
 * @remarks
 * Blank counts as valid — an empty optional field is not an error, and marking
 * it red while somebody works down the list is noise.
 */
export function isRouteDateValid(text: string | undefined, cal?: RouteCalendar): boolean {
  if (text === undefined || String(text).trim() === '') return true;
  return parseRouteDate(text, cal) !== null;
}

/**
 * Describes a day count the way a person would say it.
 *
 * @remarks
 * Weeks matter here: a jump is one week, so "6 weeks" is a number of jumps and
 * "42 days" is arithmetic homework. Days are kept alongside because deadlines
 * are quoted in them.
 */
export function describeDuration(days: number): string {
  const whole = Math.round(days);
  const abs = Math.abs(whole);
  if (abs === 0) return 'same day';
  const weeks = Math.floor(abs / 7);
  const rest = abs % 7;
  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks} week${weeks === 1 ? '' : 's'}`);
  if (rest > 0) parts.push(`${rest} day${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}
