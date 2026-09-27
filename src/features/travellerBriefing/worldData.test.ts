import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachedText, fetchTextWithTimeout, distanceBetweenWorlds, loadNearbyWorlds, loadWorld, nearbyFromCatalog, type WorldHit } from './worldData';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('TravellerMap request resilience', () => {
  it('times out a server that never responds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const pending = fetchTextWithTimeout('https://travellermap.com/never', 100);
    const assertion = expect(pending).rejects.toThrow('Request timed out');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('uses a successful response when Cache Storage cannot open', async () => {
    vi.stubGlobal('caches', { open: vi.fn().mockRejectedValue(new Error('storage unavailable')) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('worlds', { status: 200 })));
    expect(await cachedText('https://travellermap.com/cache-open-test', 30)).toBe('worlds');
  });

  it('uses a successful response when the cache write is refused', async () => {
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockRejectedValue(new Error('quota exceeded')),
    }) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('worlds', { status: 200 })));
    expect(await cachedText('https://travellermap.com/cache-write-test', 30)).toBe('worlds');
  });
});

const zila: WorldHit = {
  name: 'Zila', sector: 'Spinward Marches', hex: '2908', subsector: 'Aramis', uwp: 'E556727-7',
  zone: 'A', bases: '', remarks: 'Ag Pz', pbg: '701', allegiance: 'ImDd', stellar: 'K6 V',
  ix: '', ex: '', cx: '', nobility: '', worlds: '8', worldX: -100, worldY: -72,
};

describe('nearby world discovery', () => {
  it('uses hex distance when detail data omits world coordinates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ Worlds: [
      { Name: 'Zila', Sector: 'Spinward Marches', Hex: '2908', UWP: 'E556727-7' },
    ] }), { status: 200 })));
    const selected = await loadWorld({ ...zila, worldX: undefined, worldY: undefined }, 'M1201');
    expect(distanceBetweenWorlds(selected, { ...zila, hex: '3008', worldX: undefined, worldY: undefined })).toBe(1);
    expect(selected.worldX).toBeUndefined();
  });

  it('shows cached neighbors immediately and excludes the selected world', () => {
    const nearby = nearbyFromCatalog(zila, [zila, { ...zila, name: 'Pysadi', hex: '3008', worldX: -99, worldY: -72 }], 2);
    expect(nearby).toMatchObject([{ world: { name: 'Pysadi' }, distance: 1 }]);
    expect(distanceBetweenWorlds(zila, { ...zila, name: 'Lewis', hex: '3107', worldX: -98, worldY: -73 })).toBe(2);
  });

  it('uses Jump Worlds for neighboring sectors and keeps the result sorted by distance', async () => {
    const fetch = vi.fn(async (_url: string) => new Response(JSON.stringify({ Worlds: [
      { Name: 'Lewis', Sector: 'Spinward Marches', Hex: '3107', UWP: 'D427402-7', WorldX: -98, WorldY: -73 },
      { Name: 'Zila', Sector: 'Spinward Marches', Hex: '2908', UWP: 'E556727-7', WorldX: -100, WorldY: -72 },
      { Name: 'Border', Sector: 'Neighbor Sector', Hex: '0108', UWP: 'A788899-C', WorldX: -99, WorldY: -72 },
    ] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const nearby = await loadNearbyWorlds(zila, 2, 'M1140');
    expect(nearby.map(hit => [hit.world.name, hit.distance])).toEqual([['Border', 1], ['Lewis', 2]]);
    expect(fetch.mock.calls[0][0]).toContain('/api/jumpworlds?');
    expect(fetch.mock.calls[0][0]).toContain('jump=2');
  });
});
