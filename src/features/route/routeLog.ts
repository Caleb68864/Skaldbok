import type { SystemDefinition } from '../../types/system';
import type { RoutePlan } from '../../types/routePlan';
import type { RouteStop } from '../../types/routeStop';

type Planner = NonNullable<SystemDefinition['routePlanner']>;

/** A readable, fixed snapshot for a session log entry. */
export function routeLogSnapshot(
  planner: Planner,
  stops: RouteStop[],
  plan: RoutePlan | null,
  distanceLabel?: string,
  total?: number,
): { title: string; body: string } {
  const first = stops[0]?.name || 'Start';
  const last = stops[stops.length - 1]?.name || first;
  const title = `${planner.label}: ${first}${stops.length > 1 ? ` → ${last}` : ''}`;
  const lines = [title];
  if (plan?.startDate) lines.push(`Departs: ${plan.startDate}`);
  if (plan?.targetDate) lines.push(`Must arrive by: ${plan.targetDate}`);
  if (plan?.targetNote) lines.push(`Purpose: ${plan.targetNote}`);
  if (distanceLabel && total !== undefined) lines.push(`${distanceLabel} total: ${total}`);
  for (const [index, stop] of stops.entries()) {
    lines.push('', `${index + 1}. ${stop.name}`);
    for (const field of planner.fields) {
      if (field.id === 'name') continue;
      const value = stop.values[field.id]?.trim();
      if (value) lines.push(`${field.label}: ${value}`);
    }
    if (stop.estimatedDays != null) lines.push(`Days to get here: ${stop.estimatedDays}`);
    if (stop.arrivedOn) lines.push(`Arrived: ${stop.arrivedOn}`);
    if (stop.departedOn) lines.push(`Departed: ${stop.departedOn}`);
  }
  return { title, body: lines.join('\n') };
}
