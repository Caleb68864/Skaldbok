import type { RecurringBill } from '../../types/recurringBill';
import type { RouteCalendar } from '../route/calendar';
import { parseRouteDate, formatRouteDate } from '../route/calendar';

/**
 * Works out which recurring charges have fallen due, and when.
 *
 * @remarks
 * Pure. Given the campaign's current date it returns the charges owed and the
 * new watermark for each bill — it never writes, so posting can be previewed,
 * capped, or refused without the arithmetic knowing or caring.
 *
 * The whole thing turns on one property: **posting is idempotent**. Each bill
 * carries `postedThrough`, and a charge only falls due strictly after it. Run
 * this twice on the same campaign date and the second run finds nothing, which
 * is what makes it safe to call on every screen open.
 */

/** One charge that has fallen due. */
export interface DueCharge {
  bill: RecurringBill;
  /** Campaign date the charge falls on, in the ruleset's dating. */
  date: string;
  /** Absolute day, for ordering across bills. */
  day: number;
  /** Which occurrence this is, counting from one. */
  occurrence: number;
}

/** What a bill owes, and where its watermark should move to. */
export interface BillAccrual {
  bill: RecurringBill;
  charges: DueCharge[];
  /** New `postedThrough` once these charges are written. */
  postedThrough: string;
  /** New `postedCount` once these charges are written. */
  postedCount: number;
  /** True when the occurrence limit was reached during this run. */
  reachedLimit: boolean;
}

/** Everything owed across a campaign's bills. */
export interface AccrualResult {
  accruals: BillAccrual[];
  /** Every charge across every bill, oldest first. */
  charges: DueCharge[];
  /** Sum of the amounts owed. */
  total: number;
  /**
   * True when the per-run cap stopped the calculation short.
   *
   * @remarks
   * Matters because it means the campaign date has moved a very long way and the
   * next open will post more. Silently truncating would read as "all caught up".
   */
  truncated: boolean;
}

/** Inputs for {@link accrueBills}. */
export interface AccrualInput {
  bills: RecurringBill[];
  /** The campaign's current in-world date, in the ruleset's dating. */
  campaignDate: string;
  calendar?: RouteCalendar;
  /**
   * Most charges to produce in one run.
   *
   * @remarks
   * A guard, not a policy. Setting a start date years in the past should not
   * dump three hundred rows into the book in one go; the rest post next time.
   */
  maxCharges?: number;
}

/**
 * Computes every charge due up to the campaign's current date.
 *
 * @remarks
 * A bill with no start date, no amount, or that is paused produces nothing. A
 * bill whose start date lies in the future produces nothing yet — the first
 * charge falls **on** the start date, not a period after it, because "the
 * mortgage starts on 097" means a payment on 097.
 */
export function accrueBills(input: AccrualInput): AccrualResult {
  const { bills, calendar, maxCharges = 60 } = input;
  const now = parseRouteDate(input.campaignDate, calendar);

  const accruals: BillAccrual[] = [];
  const all: DueCharge[] = [];
  let truncated = false;

  if (now === null) {
    return { accruals: [], charges: [], total: 0, truncated: false };
  }

  for (const bill of bills) {
    const start = parseRouteDate(bill.startDate, calendar);
    const charges: DueCharge[] = [];

    let postedThrough = bill.postedThrough;
    let postedCount = bill.postedCount;
    let reachedLimit = false;

    const usable =
      bill.active && start !== null && bill.amount > 0 && bill.everyDays > 0;

    if (usable) {
      const watermark = parseRouteDate(bill.postedThrough, calendar);
      // Nothing posted yet means the first charge is the start date itself.
      let next = watermark === null ? start : watermark + bill.everyDays;
      let occurrence = postedCount + 1;

      while (next <= now) {
        if (bill.occurrenceLimit !== undefined && occurrence > bill.occurrenceLimit) {
          reachedLimit = true;
          break;
        }
        if (all.length + charges.length >= maxCharges) {
          truncated = true;
          break;
        }
        const charge: DueCharge = {
          bill,
          date: formatRouteDate(next, calendar),
          day: next,
          occurrence,
        };
        charges.push(charge);
        postedThrough = charge.date;
        postedCount = occurrence;
        occurrence += 1;
        next += bill.everyDays;
      }

      if (
        !reachedLimit &&
        bill.occurrenceLimit !== undefined &&
        postedCount >= bill.occurrenceLimit
      ) {
        reachedLimit = true;
      }
    }

    accruals.push({ bill, charges, postedThrough, postedCount, reachedLimit });
    all.push(...charges);
  }

  all.sort((a, b) => a.day - b.day || a.bill.name.localeCompare(b.bill.name));

  return {
    accruals,
    charges: all,
    total: all.reduce((sum, c) => sum + c.bill.amount, 0),
    truncated,
  };
}

/**
 * When a bill next falls due, for display.
 *
 * @remarks
 * Returns `null` for a bill that is paused, unusable, or has run out of
 * occurrences — the panel then says why rather than showing a date that will
 * never arrive.
 */
export function nextDue(bill: RecurringBill, calendar?: RouteCalendar): string | null {
  if (!bill.active || bill.amount <= 0 || bill.everyDays <= 0) return null;
  if (bill.occurrenceLimit !== undefined && bill.postedCount >= bill.occurrenceLimit) return null;

  const start = parseRouteDate(bill.startDate, calendar);
  if (start === null) return null;

  const watermark = parseRouteDate(bill.postedThrough, calendar);
  return formatRouteDate(watermark === null ? start : watermark + bill.everyDays, calendar);
}

/** Charges left before a bill's limit runs out, or `null` when it never does. */
export function remainingOccurrences(bill: RecurringBill): number | null {
  if (bill.occurrenceLimit === undefined) return null;
  return Math.max(0, bill.occurrenceLimit - bill.postedCount);
}
