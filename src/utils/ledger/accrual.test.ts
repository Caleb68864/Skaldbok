import { describe, it, expect } from 'vitest';
import { accrueBills, nextDue, remainingOccurrences } from './accrual';
import type { RecurringBill } from '../../types/recurringBill';
import type { RouteCalendar } from '../route/calendar';

const IMPERIAL: RouteCalendar = { kind: 'day-of-year', daysInYear: 365, example: '097-1105' };

function bill(over: Partial<RecurringBill> & { name: string; amount: number }): RecurringBill {
  return {
    id: `b-${over.name}`,
    campaignId: 'c1',
    everyDays: 30,
    startDate: '097-1105',
    postedThrough: '',
    postedCount: 0,
    active: true,
    note: '',
    schemaVersion: 1,
    createdAt: '2026-08-08T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
    ...over,
  };
}

/** The Leap's real monthly costs. */
const MORTGAGE = bill({ name: 'Mortgage', amount: 201_335 });
const LIFE_SUPPORT = bill({ name: 'Life support', amount: 10_000 });

describe('accrueBills — nothing due', () => {
  it('produces nothing before the start date', () => {
    const r = accrueBills({ bills: [MORTGAGE], campaignDate: '096-1105', calendar: IMPERIAL });
    expect(r.charges).toHaveLength(0);
    expect(r.total).toBe(0);
  });

  it('produces nothing when the campaign date is unreadable', () => {
    const r = accrueBills({ bills: [MORTGAGE], campaignDate: 'soon', calendar: IMPERIAL });
    expect(r.charges).toHaveLength(0);
  });

  it('produces nothing for a paused bill', () => {
    const r = accrueBills({
      bills: [bill({ name: 'Berthing', amount: 7_000, active: false })],
      campaignDate: '200-1105',
      calendar: IMPERIAL,
    });
    expect(r.charges).toHaveLength(0);
  });

  it('produces nothing for a bill with no start date', () => {
    const r = accrueBills({
      bills: [bill({ name: 'X', amount: 100, startDate: '' })],
      campaignDate: '200-1105',
      calendar: IMPERIAL,
    });
    expect(r.charges).toHaveLength(0);
  });

  it('produces nothing for a bill of zero', () => {
    const r = accrueBills({
      bills: [bill({ name: 'Free', amount: 0 })],
      campaignDate: '200-1105',
      calendar: IMPERIAL,
    });
    expect(r.charges).toHaveLength(0);
  });
});

describe('accrueBills — charging', () => {
  it('charges on the start date itself, not a period later', () => {
    // "The mortgage starts on 097" means a payment on 097.
    const r = accrueBills({ bills: [MORTGAGE], campaignDate: '097-1105', calendar: IMPERIAL });
    expect(r.charges).toHaveLength(1);
    expect(r.charges[0].date).toBe('097-1105');
  });

  it('charges once per period as the campaign date advances', () => {
    const r = accrueBills({ bills: [MORTGAGE], campaignDate: '187-1105', calendar: IMPERIAL });
    expect(r.charges.map(c => c.date)).toEqual([
      '097-1105', '127-1105', '157-1105', '187-1105',
    ]);
    expect(r.total).toBe(201_335 * 4);
  });

  it('moves the watermark to the last charge', () => {
    const r = accrueBills({ bills: [MORTGAGE], campaignDate: '187-1105', calendar: IMPERIAL });
    expect(r.accruals[0].postedThrough).toBe('187-1105');
    expect(r.accruals[0].postedCount).toBe(4);
  });

  it('is idempotent — a second run finds nothing', () => {
    // The property that makes posting safe on every screen open.
    const first = accrueBills({ bills: [MORTGAGE], campaignDate: '187-1105', calendar: IMPERIAL });
    const caughtUp = {
      ...MORTGAGE,
      postedThrough: first.accruals[0].postedThrough,
      postedCount: first.accruals[0].postedCount,
    };
    const second = accrueBills({ bills: [caughtUp], campaignDate: '187-1105', calendar: IMPERIAL });
    expect(second.charges).toHaveLength(0);
  });

  it('catches up several periods at once after a long gap', () => {
    // 032-1106 is 300 days after 097-1105, so charges land on offsets 0..300.
    const r = accrueBills({ bills: [MORTGAGE], campaignDate: '032-1106', calendar: IMPERIAL });
    expect(r.charges).toHaveLength(11);
    expect(r.charges[10].date).toBe('032-1106');
  });

  it('produces nothing for a campaign date outside the year', () => {
    // Day 397 of a 365-day year is not a date; the parser refuses it rather
    // than wrapping, so nothing accrues.
    const r = accrueBills({ bills: [MORTGAGE], campaignDate: '397-1105', calendar: IMPERIAL });
    expect(r.charges).toHaveLength(0);
  });

  it('honours a period other than thirty days', () => {
    const r = accrueBills({
      bills: [bill({ name: 'Fortnightly', amount: 100, everyDays: 14 })],
      campaignDate: '125-1105',
      calendar: IMPERIAL,
    });
    expect(r.charges.map(c => c.date)).toEqual(['097-1105', '111-1105', '125-1105']);
  });

  it('rolls charges into the next year', () => {
    const r = accrueBills({
      bills: [bill({ name: 'Mortgage', amount: 1, startDate: '350-1105' })],
      campaignDate: '045-1106',
      calendar: IMPERIAL,
    });
    expect(r.charges.map(c => c.date)).toEqual(['350-1105', '015-1106', '045-1106']);
  });

  it('orders charges across bills by date', () => {
    const r = accrueBills({
      bills: [
        bill({ name: 'Later', amount: 1, startDate: '120-1105' }),
        bill({ name: 'Earlier', amount: 1, startDate: '097-1105' }),
      ],
      campaignDate: '130-1105',
      calendar: IMPERIAL,
    });
    expect(r.charges.map(c => c.date)).toEqual(['097-1105', '120-1105', '127-1105']);
  });

  it('totals across several bills', () => {
    const r = accrueBills({
      bills: [MORTGAGE, LIFE_SUPPORT],
      campaignDate: '127-1105',
      calendar: IMPERIAL,
    });
    expect(r.charges).toHaveLength(4);
    expect(r.total).toBe((201_335 + 10_000) * 2);
  });
});

describe('accrueBills — the benefactor arrangement', () => {
  it('stops after the agreed number of months', () => {
    // Twenty-seven months of mortgage cover, then it lapses.
    const covered = bill({ name: 'Mortgage (covered)', amount: 201_335, occurrenceLimit: 27 });
    const r = accrueBills({ bills: [covered], campaignDate: '097-1110', calendar: IMPERIAL });
    expect(r.charges).toHaveLength(27);
    expect(r.accruals[0].reachedLimit).toBe(true);
    expect(r.accruals[0].postedCount).toBe(27);
  });

  it('stays stopped once the limit is reached', () => {
    const spent = bill({
      name: 'Mortgage (covered)',
      amount: 201_335,
      occurrenceLimit: 27,
      postedCount: 27,
      postedThrough: '877-1105',
    });
    const r = accrueBills({ bills: [spent], campaignDate: '097-1112', calendar: IMPERIAL });
    expect(r.charges).toHaveLength(0);
    expect(r.accruals[0].reachedLimit).toBe(true);
  });

  it('counts the limit against charges already posted, not from zero', () => {
    const partway = bill({
      name: 'Mortgage (covered)',
      amount: 201_335,
      occurrenceLimit: 27,
      postedCount: 25,
      postedThrough: '817-1105',
    });
    const r = accrueBills({ bills: [partway], campaignDate: '097-1110', calendar: IMPERIAL });
    expect(r.charges).toHaveLength(2);
  });
});

describe('accrueBills — the runaway guard', () => {
  it('caps how much posts in one run and says so', () => {
    const r = accrueBills({
      bills: [MORTGAGE],
      campaignDate: '097-1120',
      calendar: IMPERIAL,
      maxCharges: 10,
    });
    expect(r.charges).toHaveLength(10);
    expect(r.truncated).toBe(true);
  });

  it('does not claim truncation when everything fitted', () => {
    const r = accrueBills({
      bills: [MORTGAGE],
      campaignDate: '127-1105',
      calendar: IMPERIAL,
      maxCharges: 10,
    });
    expect(r.truncated).toBe(false);
  });

  it('leaves the watermark at the last charge it actually produced', () => {
    // So the next run picks up exactly where this one stopped.
    const r = accrueBills({
      bills: [MORTGAGE],
      campaignDate: '097-1120',
      calendar: IMPERIAL,
      maxCharges: 3,
    });
    expect(r.accruals[0].postedThrough).toBe('157-1105');
    expect(r.accruals[0].postedCount).toBe(3);
  });
});

describe('nextDue', () => {
  it('is the start date before anything has posted', () => {
    expect(nextDue(MORTGAGE, IMPERIAL)).toBe('097-1105');
  });

  it('is a period after the watermark', () => {
    expect(nextDue({ ...MORTGAGE, postedThrough: '127-1105' }, IMPERIAL)).toBe('157-1105');
  });

  it('is null for a paused bill', () => {
    expect(nextDue({ ...MORTGAGE, active: false }, IMPERIAL)).toBeNull();
  });

  it('is null once the occurrences run out', () => {
    expect(
      nextDue({ ...MORTGAGE, occurrenceLimit: 27, postedCount: 27 }, IMPERIAL),
    ).toBeNull();
  });
});

describe('remainingOccurrences', () => {
  it('counts down toward the limit', () => {
    expect(remainingOccurrences({ ...MORTGAGE, occurrenceLimit: 27, postedCount: 4 })).toBe(23);
  });
  it('never goes negative', () => {
    expect(remainingOccurrences({ ...MORTGAGE, occurrenceLimit: 27, postedCount: 30 })).toBe(0);
  });
  it('is null for a bill that runs forever', () => {
    expect(remainingOccurrences(MORTGAGE)).toBeNull();
  });
});
