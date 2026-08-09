import type { RouteStop } from '../../types/routeStop';
import type { RouteCalendar } from './calendar';
import { parseRouteDate } from './calendar';

/**
 * Turns a route into a schedule: when each stop is expected, when it actually
 * happened, and whether the whole thing still lands before the deadline.
 *
 * @remarks
 * The question this exists to answer is the one from Session 1 — the trake fruit
 * has to reach Regina by 235-1105, the round trip is most of the budget, and
 * nobody could tell at the table whether it fit. Estimates alone cannot answer
 * it once the route is under way; the moment a real arrival date differs from
 * the plan, every date after it moves.
 *
 * So the projection **re-bases on the latest actual**. A leg that ran a week
 * long pushes everything downstream by a week, which is what being behind
 * actually means. Projecting from the original start date instead would keep
 * showing a plan that stopped being true at the first delay.
 */

/** One stop, scheduled. */
export interface ScheduledStop {
  stop: RouteStop;
  /** Estimated days for the leg *to* this stop. 0 for the origin. */
  estimatedDays: number;
  /** Cumulative estimated days from the journey start. */
  cumulativeDays: number;
  /** Projected arrival, as an absolute day, or `null` with no start date. */
  projectedArrival: number | null;
  /** Arrival actually recorded, if any. */
  actualArrival: number | null;
  /** Departure actually recorded, if any. */
  actualDeparture: number | null;
  /**
   * Days the actual arrival ran late against the projection. Negative is early.
   * `null` when either side is unknown.
   */
  variance: number | null;
  /** Days spent in port here, when both actuals are recorded. */
  daysInPort: number | null;
}

/** The whole route, scheduled. */
export interface RouteSchedule {
  stops: ScheduledStop[];
  /** Journey start as an absolute day, or `null` if not set or unreadable. */
  start: number | null;
  /** Total estimated days across every leg. */
  totalEstimatedDays: number;
  /** Projected arrival at the final stop. */
  projectedEnd: number | null;
  /** The deadline, if one is set. */
  target: number | null;
  /**
   * Days of slack against the target: positive means arriving early, negative
   * means late. `null` when there is no target or no projection to compare.
   */
  slack: number | null;
  /** The latest recorded actual arrival, which the projection re-bases on. */
  lastActual: { index: number; day: number } | null;
}

/** Inputs for {@link buildSchedule}. */
export interface ScheduleInput {
  stops: RouteStop[];
  /** Journey start, written in the ruleset's own form. */
  startDate?: string;
  /** Deadline, written in the ruleset's own form. */
  targetDate?: string;
  calendar?: RouteCalendar;
}

/** Reads a stop's estimate, tolerating a blank or unparseable field as zero. */
function estimateOf(stop: RouteStop): number {
  const raw = stop.estimatedDays;
  if (raw === undefined || raw === null) return 0;
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * Builds the schedule.
 *
 * @remarks
 * The first stop is the origin: you do not travel to where you already are, so
 * its estimate is ignored and it is projected at the start date itself.
 */
export function buildSchedule(input: ScheduleInput): RouteSchedule {
  const { stops, calendar } = input;
  const start = parseRouteDate(input.startDate, calendar);
  const target = parseRouteDate(input.targetDate, calendar);

  // Walk once to collect cumulative estimates and any recorded actuals.
  let cumulative = 0;
  const rows = stops.map((stop, index) => {
    const estimatedDays = index === 0 ? 0 : estimateOf(stop);
    cumulative += estimatedDays;
    return {
      stop,
      index,
      estimatedDays,
      cumulativeDays: cumulative,
      actualArrival: parseRouteDate(stop.arrivedOn, calendar),
      actualDeparture: parseRouteDate(stop.departedOn, calendar),
    };
  });

  // Re-base on the latest actual arrival: once a leg has run long, every date
  // after it moves, and a projection from the original start is a plan that
  // stopped being true.
  let lastActual: RouteSchedule['lastActual'] = null;
  for (const row of rows) {
    if (row.actualArrival !== null) lastActual = { index: row.index, day: row.actualArrival };
  }

  const scheduled: ScheduledStop[] = rows.map(row => {
    let projectedArrival: number | null = null;
    if (row.actualArrival !== null) {
      // What happened is not a projection.
      projectedArrival = row.actualArrival;
    } else if (lastActual && row.index > lastActual.index) {
      const base = rows[lastActual.index];
      // Depart when we actually left, if that is recorded — time in port is
      // real time and dropping it makes every later date optimistic.
      const from = base.actualDeparture ?? lastActual.day;
      projectedArrival = from + (row.cumulativeDays - base.cumulativeDays);
    } else if (start !== null) {
      projectedArrival = start + row.cumulativeDays;
    }

    // Variance compares what happened against where the plan said we would be,
    // measured from the start — not against the re-based projection, which
    // already contains the delay and would always read zero.
    const planned = start !== null ? start + row.cumulativeDays : null;
    const variance =
      row.actualArrival !== null && planned !== null ? row.actualArrival - planned : null;

    const daysInPort =
      row.actualArrival !== null && row.actualDeparture !== null
        ? row.actualDeparture - row.actualArrival
        : null;

    return {
      stop: row.stop,
      estimatedDays: row.estimatedDays,
      cumulativeDays: row.cumulativeDays,
      projectedArrival,
      actualArrival: row.actualArrival,
      actualDeparture: row.actualDeparture,
      variance,
      daysInPort,
    };
  });

  const projectedEnd =
    scheduled.length > 0 ? scheduled[scheduled.length - 1].projectedArrival : null;

  return {
    stops: scheduled,
    start,
    totalEstimatedDays: cumulative,
    projectedEnd,
    target,
    slack: target !== null && projectedEnd !== null ? target - projectedEnd : null,
    lastActual,
  };
}
