import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachedText, fetchTextWithTimeout } from './worldData';

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
