export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Returns a local-calendar ISO date string (`YYYY-MM-DD`) without converting
 * through UTC first.
 */
export function localDateOnlyISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an ISO calendar date string (`YYYY-MM-DD`) without timezone drift.
 *
 * `new Date('2026-04-16')` is parsed as UTC and can display as the prior day in
 * local timezones, so we parse the calendar parts manually.
 */
export function formatLocalDateOnly(
  isoDate: string,
  locale: string | string[] | undefined = undefined,
): string {
  try {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) return isoDate;
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString(locale);
  } catch {
    return isoDate;
  }
}

export function formatLocalDateTime(
  isoDateTime: string,
  locale: string | string[] | undefined = undefined,
): string {
  try {
    return new Date(isoDateTime).toLocaleString(locale);
  } catch {
    return isoDateTime;
  }
}
