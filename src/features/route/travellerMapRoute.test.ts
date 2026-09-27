import { afterEach, describe, expect, it, vi } from 'vitest';
import { planTravellerMapRoute } from './travellerMapRoute';

afterEach(() => vi.unstubAllGlobals());

describe('TravellerMap route planning', () => {
  it('requests a shortest path with the supported Red Zone and refuelling constraints', async () => {
    const fetch = vi.fn(async (_url: string) => new Response(JSON.stringify([
      { Name: 'Zila', Sector: 'Spinward Marches', Hex: '2908', UWP: 'E556727-7', PBG: '701', Zone: 'A' },
      { Name: 'Pysadi', Sector: 'Spinward Marches', Hex: '3008', UWP: 'C5766D8-5', PBG: '201', Zone: '' },
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const route = await planTravellerMapRoute('Spinward Marches 2908', 'Spinward Marches 3008', {
      jump: 2, avoidRed: true, wildernessRefuel: true, milieu: 'M1140',
    });
    expect(route.map(world => world.name)).toEqual(['Zila', 'Pysadi']);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('nored')).toBe('1');
    expect(url.searchParams.get('wild')).toBe('1');
    expect(url.searchParams.get('jump')).toBe('2');
    expect(url.searchParams.get('start')).toBe('Spinward Marches 2908');
  });
});
