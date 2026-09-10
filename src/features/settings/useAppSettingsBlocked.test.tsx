// @vitest-environment jsdom
// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import { act, renderHook, cleanup, waitFor } from '@testing-library/react';
import { useAppSettings } from './useAppSettings';
import { db, DB_BLOCKED_MESSAGE } from '../../storage/db/client';

/**
 * The wiring, not the mechanism.
 *
 * @remarks
 * `databaseBlocked.test.ts` proves `db.on('blocked')` reaches a subscriber.
 * This proves the app is that subscriber — because the failure being fixed is
 * not "Dexie has no handler", it is "the loading screen never goes away". If
 * `useAppSettings` stops calling `onDatabaseBlocked`, the handler still fires
 * into an empty set and the user still sits on "Loading..." forever, which is
 * exactly the shape of guard that has been failing to catch things here.
 *
 * `App.tsx` renders `StorageUnavailable` whenever `storageError` is set, so
 * setting it is the whole of the wiring: the message reaches the screen the app
 * already has for "storage will not open", alongside the Reload button.
 */

afterEach(() => {
  cleanup();
});

describe('useAppSettings and a blocked upgrade', () => {
  it('turns a blocked upgrade into a storage error instead of an endless load', async () => {
    const { result } = renderHook(() => useAppSettings());

    // The fixture reached the subject: the hook mounted and its initial read
    // settled, so what follows is the block being handled and not a load that
    // had never finished in the first place.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.storageError).toBeNull();

    act(() => {
      db.on.blocked.fire({ oldVersion: 200, newVersion: 210, type: 'blocked' });
    });

    await waitFor(() =>
      expect(
        result.current.storageError,
        'a blocked upgrade left the app on its loading screen with no message and no way out',
      ).toBe(DB_BLOCKED_MESSAGE),
    );
    expect(result.current.isLoading).toBe(false);
  });
});
