import { describe, it, expect } from 'vitest';
import {
  parseRouteDate,
  formatRouteDate,
  isRouteDateValid,
  describeDuration,
  type RouteCalendar,
} from './calendar';
import { buildSchedule } from './schedule';
import type { RouteStop } from '../../types/routeStop';

/** Traveller's Imperial dating. */
const IMPERIAL: RouteCalendar = { kind: 'day-of-year', daysInYear: 365, example: '097-1105' };

function stop(over: Partial<RouteStop> & { name: string }): RouteStop {
  return {
    id: `s-${over.name}`,
    campaignId: 'c1',
    order: 0,
    values: {},
    schemaVersion: 1,
    createdAt: '2026-08-08T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
    ...over,
  };
}

/** The real Session 1 route, with the estimates from the notes. */
function feastRoute(): RouteStop[] {
  return [
    stop({ name: 'Regina', order: 0 }),
    stop({ name: 'Extolay', order: 1, estimatedDays: 7 }),
    stop({ name: 'Knorbes', order: 2, estimatedDays: 14 }),
    stop({ name: 'Zila', order: 3, estimatedDays: 42 }),
    stop({ name: 'Regina (deliver)', order: 4, estimatedDays: 35 }),
  ];
}

describe('parseRouteDate', () => {
  it('reads Imperial dating', () => {
    expect(parseRouteDate('097-1105', IMPERIAL)).toBe(1105 * 365 + 96);
  });

  it('accepts an unpadded day', () => {
    expect(parseRouteDate('97-1105', IMPERIAL)).toBe(parseRouteDate('097-1105', IMPERIAL));
  });

  it('tolerates surrounding whitespace and spaces around the dash', () => {
    expect(parseRouteDate('  097 - 1105 ', IMPERIAL)).toBe(parseRouteDate('097-1105', IMPERIAL));
  });

  it('returns null for a half-typed date rather than guessing', () => {
    // The normal state of an input somebody is still filling in.
    expect(parseRouteDate('09', IMPERIAL)).toBeNull();
    expect(parseRouteDate('097-', IMPERIAL)).toBeNull();
  });

  it('rejects a day outside the year', () => {
    expect(parseRouteDate('000-1105', IMPERIAL)).toBeNull();
    expect(parseRouteDate('366-1105', IMPERIAL)).toBeNull();
    expect(parseRouteDate('365-1105', IMPERIAL)).not.toBeNull();
  });

  it('returns null for blank or absent input', () => {
    expect(parseRouteDate('', IMPERIAL)).toBeNull();
    expect(parseRouteDate(undefined, IMPERIAL)).toBeNull();
  });

  it('falls back to plain day numbers when no calendar is declared', () => {
    expect(parseRouteDate('42')).toBe(42);
    expect(parseRouteDate('097-1105')).toBeNull();
  });
});

describe('formatRouteDate', () => {
  it('round-trips an Imperial date', () => {
    const day = parseRouteDate('097-1105', IMPERIAL)!;
    expect(formatRouteDate(day, IMPERIAL)).toBe('097-1105');
  });

  it('pads the day to three digits', () => {
    expect(formatRouteDate(parseRouteDate('001-1105', IMPERIAL)!, IMPERIAL)).toBe('001-1105');
  });

  it('rolls into the next year', () => {
    const day = parseRouteDate('365-1105', IMPERIAL)!;
    expect(formatRouteDate(day + 1, IMPERIAL)).toBe('001-1106');
  });

  it('round-trips every day of a year', () => {
    for (const d of [1, 2, 99, 100, 200, 364, 365]) {
      const text = `${String(d).padStart(3, '0')}-1105`;
      expect(formatRouteDate(parseRouteDate(text, IMPERIAL)!, IMPERIAL)).toBe(text);
    }
  });
});

describe('isRouteDateValid', () => {
  it('treats blank as valid — an empty optional field is not an error', () => {
    expect(isRouteDateValid('', IMPERIAL)).toBe(true);
    expect(isRouteDateValid(undefined, IMPERIAL)).toBe(true);
  });
  it('flags something unreadable', () => {
    expect(isRouteDateValid('next tuesday', IMPERIAL)).toBe(false);
  });
});

describe('describeDuration', () => {
  it('speaks in weeks, because a jump is a week', () => {
    expect(describeDuration(7)).toBe('1 week');
    expect(describeDuration(42)).toBe('6 weeks');
    expect(describeDuration(45)).toBe('6 weeks 3 days');
    expect(describeDuration(3)).toBe('3 days');
    expect(describeDuration(0)).toBe('same day');
  });
});

describe('buildSchedule — projection from estimates', () => {
  it('totals the estimated days across every leg', () => {
    const s = buildSchedule({ stops: feastRoute(), calendar: IMPERIAL });
    expect(s.totalEstimatedDays).toBe(98);
  });

  it('ignores an estimate on the origin — you do not travel to where you are', () => {
    const stops = feastRoute();
    stops[0] = stop({ name: 'Regina', order: 0, estimatedDays: 999 });
    expect(buildSchedule({ stops, calendar: IMPERIAL }).totalEstimatedDays).toBe(98);
  });

  it('projects each arrival from the start date', () => {
    const s = buildSchedule({ stops: feastRoute(), startDate: '097-1105', calendar: IMPERIAL });
    const dates = s.stops.map(x => formatRouteDate(x.projectedArrival!, IMPERIAL));
    expect(dates).toEqual(['097-1105', '104-1105', '118-1105', '160-1105', '195-1105']);
  });

  it('projects nothing without a start date', () => {
    const s = buildSchedule({ stops: feastRoute(), calendar: IMPERIAL });
    expect(s.stops.every(x => x.projectedArrival === null)).toBe(true);
    expect(s.projectedEnd).toBeNull();
  });

  it('handles an empty route', () => {
    const s = buildSchedule({ stops: [], startDate: '097-1105', calendar: IMPERIAL });
    expect(s.projectedEnd).toBeNull();
    expect(s.totalEstimatedDays).toBe(0);
  });
});

describe('buildSchedule — the deadline', () => {
  it('reports slack when the route lands early', () => {
    const s = buildSchedule({
      stops: feastRoute(),
      startDate: '097-1105',
      targetDate: '279-1105',
      calendar: IMPERIAL,
    });
    // Projected 195, deadline 279 — 84 days spare.
    expect(s.slack).toBe(84);
  });

  it('reports negative slack when it lands late', () => {
    const s = buildSchedule({
      stops: feastRoute(),
      startDate: '097-1105',
      targetDate: '150-1105',
      calendar: IMPERIAL,
    });
    expect(s.slack).toBe(-45);
  });

  it('has no slack without a deadline', () => {
    const s = buildSchedule({ stops: feastRoute(), startDate: '097-1105', calendar: IMPERIAL });
    expect(s.slack).toBeNull();
  });
});

describe('buildSchedule — actuals re-base the plan', () => {
  it('uses a recorded arrival instead of projecting it', () => {
    const stops = feastRoute();
    stops[1] = stop({ name: 'Extolay', order: 1, estimatedDays: 7, arrivedOn: '110-1105' });
    const s = buildSchedule({ stops, startDate: '097-1105', targetDate: '279-1105', calendar: IMPERIAL });
    expect(formatRouteDate(s.stops[1].projectedArrival!, IMPERIAL)).toBe('110-1105');
  });

  it('pushes every later stop by the delay', () => {
    // Arrived 110 where the plan said 104 — six days late, and everything
    // downstream moves with it.
    const stops = feastRoute();
    stops[1] = stop({ name: 'Extolay', order: 1, estimatedDays: 7, arrivedOn: '110-1105' });
    const s = buildSchedule({ stops, startDate: '097-1105', calendar: IMPERIAL });
    const dates = s.stops.map(x => formatRouteDate(x.projectedArrival!, IMPERIAL));
    expect(dates).toEqual(['097-1105', '110-1105', '124-1105', '166-1105', '201-1105']);
  });

  it('reports the variance against the original plan, not the re-based one', () => {
    const stops = feastRoute();
    stops[1] = stop({ name: 'Extolay', order: 1, estimatedDays: 7, arrivedOn: '110-1105' });
    const s = buildSchedule({ stops, startDate: '097-1105', calendar: IMPERIAL });
    expect(s.stops[1].variance).toBe(6);
  });

  it('reports a negative variance for arriving early', () => {
    const stops = feastRoute();
    stops[1] = stop({ name: 'Extolay', order: 1, estimatedDays: 7, arrivedOn: '100-1105' });
    expect(buildSchedule({ stops, startDate: '097-1105', calendar: IMPERIAL }).stops[1].variance).toBe(-4);
  });

  it('counts time in port when a departure is recorded', () => {
    const stops = feastRoute();
    stops[1] = stop({
      name: 'Extolay', order: 1, estimatedDays: 7,
      arrivedOn: '104-1105', departedOn: '111-1105',
    });
    const s = buildSchedule({ stops, startDate: '097-1105', calendar: IMPERIAL });
    expect(s.stops[1].daysInPort).toBe(7);
    // A week sat in port is a week the rest of the route loses.
    expect(formatRouteDate(s.stops[2].projectedArrival!, IMPERIAL)).toBe('125-1105');
  });

  it('projects from arrival when no departure is recorded', () => {
    const stops = feastRoute();
    stops[1] = stop({ name: 'Extolay', order: 1, estimatedDays: 7, arrivedOn: '104-1105' });
    const s = buildSchedule({ stops, startDate: '097-1105', calendar: IMPERIAL });
    expect(formatRouteDate(s.stops[2].projectedArrival!, IMPERIAL)).toBe('118-1105');
  });

  it('re-bases on the latest actual, not the first', () => {
    const stops = feastRoute();
    stops[1] = stop({ name: 'Extolay', order: 1, estimatedDays: 7, arrivedOn: '110-1105' });
    stops[2] = stop({ name: 'Knorbes', order: 2, estimatedDays: 14, arrivedOn: '130-1105' });
    const s = buildSchedule({ stops, startDate: '097-1105', calendar: IMPERIAL });
    expect(s.lastActual?.index).toBe(2);
    expect(formatRouteDate(s.stops[3].projectedArrival!, IMPERIAL)).toBe('172-1105');
  });

  it('turns slack negative once a delay pushes the route past the deadline', () => {
    // This is the Session 1 question: does the trake fruit still make 235?
    const stops = feastRoute();
    stops[1] = stop({ name: 'Extolay', order: 1, estimatedDays: 7, arrivedOn: '160-1105' });
    const s = buildSchedule({
      stops, startDate: '097-1105', targetDate: '235-1105', calendar: IMPERIAL,
    });
    expect(s.slack).toBeLessThan(0);
  });

  it('leaves variance null when there is no start date to compare against', () => {
    const stops = feastRoute();
    stops[1] = stop({ name: 'Extolay', order: 1, estimatedDays: 7, arrivedOn: '110-1105' });
    expect(buildSchedule({ stops, calendar: IMPERIAL }).stops[1].variance).toBeNull();
  });

  it('ignores an unreadable actual rather than throwing', () => {
    const stops = feastRoute();
    stops[1] = stop({ name: 'Extolay', order: 1, estimatedDays: 7, arrivedOn: 'soon' });
    const s = buildSchedule({ stops, startDate: '097-1105', calendar: IMPERIAL });
    expect(s.stops[1].actualArrival).toBeNull();
    expect(formatRouteDate(s.stops[1].projectedArrival!, IMPERIAL)).toBe('104-1105');
  });
});
