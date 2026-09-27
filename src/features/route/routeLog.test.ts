import { describe, expect, it } from 'vitest';
import { routeLogSnapshot } from './routeLog';
import type { SystemDefinition } from '../../types/system';
import type { RouteStop } from '../../types/routeStop';

describe('route session log snapshot', () => {
  it('captures declared field labels and schedule at save time', () => {
    const planner = {
      label: 'Jump Route', distanceFieldId: 'jump', fields: [
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'sector', label: 'Sector', type: 'text' },
        { id: 'jump', label: 'Jump', type: 'number' },
      ],
    } as NonNullable<SystemDefinition['routePlanner']>;
    const base = { campaignId: 'campaign-1', schemaVersion: 1, createdAt: '', updatedAt: '' };
    const stops: RouteStop[] = [
      { ...base, id: 'zila', order: 0, name: 'Zila', values: { sector: 'Spinward Marches' } },
      { ...base, id: 'pysadi', order: 1, name: 'Pysadi', values: { sector: 'Spinward Marches', jump: '1' }, estimatedDays: 7 },
    ];
    const result = routeLogSnapshot(planner, stops, {
      ...base, id: 'plan', startDate: '097-1105', targetDate: '', targetNote: 'Deliver cargo',
    }, 'Jump', 1);
    expect(result.title).toBe('Jump Route: Zila → Pysadi');
    expect(result.body).toContain('Departs: 097-1105');
    expect(result.body).toContain('Purpose: Deliver cargo');
    expect(result.body).toContain('2. Pysadi\nSector: Spinward Marches\nJump: 1\nDays to get here: 7');
  });
});
