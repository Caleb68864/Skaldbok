// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { db, onDatabaseBlocked, DB_BLOCKED_MESSAGE } from './client';

/**
 * The one storage failure the app named in a comment and could not detect.
 *
 * @remarks
 * `db.on('versionchange')` is handled: another tab opening a newer schema
 * closes this connection and reloads. `blocked` is the complementary case —
 * *this* tab is trying to upgrade while another connection holds the old
 * version open — and it had no handler anywhere in `src`.
 *
 * It matters because Dexie does not reject the open promise for it. It fires
 * `blocked` and **waits**. So `settingsRepository.get()` in `useAppSettings`
 * neither resolved nor rejected, `setIsLoading(false)` never ran, and `App`
 * rendered "Loading..." forever with no message and no way out. The comment on
 * that very `catch` listed "blocked" as a cause it handled; it was the one item
 * in the list the handler could not reach, because a block is not a failure —
 * it is a pending promise.
 *
 * On the target device (a tablet with the app installed and a second suspended
 * tab) the background tab does not run its `versionchange` handler promptly, so
 * the block does not clear itself. Closing the other tab is the fix, and the
 * user has to be told that.
 */

/** Fires the event IndexedDB delivers when an upgrade is held up by another connection. */
function fireBlocked(oldVersion = 200, newVersion = 210): void {
  db.on.blocked.fire({ oldVersion, newVersion, type: 'blocked' });
}

describe('db.on("blocked")', () => {
  it('tells a subscriber that another tab is holding the upgrade', () => {
    const seen: string[] = [];
    const unsubscribe = onDatabaseBlocked((message) => seen.push(message));
    try {
      fireBlocked();
    } finally {
      unsubscribe();
    }

    expect(seen, 'a blocked upgrade reached nothing: the app hangs on Loading with no message').toHaveLength(1);
    expect(seen[0]).toBe(DB_BLOCKED_MESSAGE);
    // The advice that resolves it has to be in the message the user reads.
    expect(DB_BLOCKED_MESSAGE.toLowerCase()).toContain('tab');
  });

  it('tells a subscriber that arrives after the block, not only before it', () => {
    // The race is real: the block fires while the settings read is in flight,
    // and a listener registered a tick later would otherwise hear nothing and
    // wait forever on a promise that never settles.
    fireBlocked();
    const seen: string[] = [];
    const unsubscribe = onDatabaseBlocked((message) => seen.push(message));
    unsubscribe();

    expect(seen).toEqual([DB_BLOCKED_MESSAGE]);
  });

  it('stops delivering once unsubscribed', () => {
    const seen: string[] = [];
    const unsubscribe = onDatabaseBlocked(() => seen.push('again'));
    unsubscribe();
    seen.length = 0;
    fireBlocked();

    expect(seen).toEqual([]);
  });
});
