import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { reserveRateLimitSlot } from '../../storage/repositories/metadataRepository';
import { WIKI_REQUEST_INTERVAL_MS } from './wikiData';

beforeEach(async () => { await resetDatabase(); });

describe('wiki request reservations', () => {
  it('spaces simultaneous tab requests and keeps the next slot in IndexedDB', async () => {
    const key = 'traveller-wiki-test';
    const slots = await Promise.all(Array.from({ length: 3 }, () => reserveRateLimitSlot(key, WIKI_REQUEST_INTERVAL_MS, 1000)));
    expect(slots.sort((a, b) => a - b)).toEqual([1000, 31_500, 62_000]);
    expect(await reserveRateLimitSlot(key, WIKI_REQUEST_INTERVAL_MS, 1000)).toBe(92_500);
  });
});
