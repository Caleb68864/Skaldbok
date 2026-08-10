/**
 * Out-of-the-box shape of a campaign's cashbook.
 *
 * @remarks
 * Both values here are user-meaningful strings and numbers rather than
 * structural constants — the crew's first account might be a strongbox or a
 * counting house, and a table using four-week months disagrees with 30 about
 * what a month is. They sat as literals in the account repository and the bills
 * form, which is the "enum of user-meaningful values in component code" smell
 * CLAUDE.md names.
 *
 * Read them through the settings layer where one exists; a caller that imports
 * these directly is taking the out-of-the-box value on purpose.
 */

/**
 * Name given to the account every campaign starts with.
 *
 * @remarks
 * Created lazily on first read, so renaming this does not touch a campaign that
 * already opened its book — the stored account keeps whatever it was called.
 */
export const DEFAULT_PRIMARY_ACCOUNT_NAME = 'Cash';

/**
 * Days between charges on a new recurring cost.
 *
 * @remarks
 * Days rather than "months" because rulesets disagree about what a month is —
 * the Imperium dates by day-of-year and has none. This is only the value the
 * form opens with; every bill stores its own.
 */
export const DEFAULT_BILL_INTERVAL_DAYS = 30;
