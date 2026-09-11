import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { createDeletedListing, createHardDelete, createSoftDeleteOps } from './createRepository';
import * as shipRepository from './shipRepository';
import type { Ship } from '../../types/ship';

/**
 * The lifecycle factory, tested by what it does rather than by how it reads.
 *
 * @remarks
 * `repositoryConventions.test.ts` also checks this file, with the same three
 * source patterns it applies to the hand-written repositories — but a source
 * pattern proves the line is *present*, not that the behaviour it stands for
 * happens. That gap is the defect this codebase has found in its own guards
 * five times, so the convention is pinned here behaviourally as well: the
 * re-delete refusal is asserted as *"`softDeletedBy` does not change"*, which is
 * the property the missing line actually cost, and not as "the file contains a
 * return".
 *
 * Every repository that adopts the factory inherits these, so a regression here
 * is a regression in all of them at once. That is the trade the factory makes:
 * one place to get wrong, and one place that has to be right.
 *
 * The fixtures are real `ships` rows through `shipRepository.create`, rather
 * than a table invented for the test. A probe table would be free to have
 * exactly the shape the factory expects, and would prove nothing about the
 * tables it is actually used on.
 */

const PROBE = { repository: 'probeRepository', table: 'ships' } as const;

async function seedShip(campaignId = 'camp-1'): Promise<Ship> {
  return shipRepository.create({ campaignId, name: 'Beowulf' });
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createSoftDeleteOps', () => {
  const ops = createSoftDeleteOps(PROBE);

  it('tombstones a live row, stamping all three columns', async () => {
    const ship = await seedShip();
    expect(ship.deletedAt, 'the fixture was already deleted').toBeUndefined();

    await ops.softDelete(ship.id);

    const row = await db.ships.get(ship.id);
    expect(row?.deletedAt).toBeTruthy();
    expect(row?.softDeletedBy).toBeTruthy();
    // A tombstone is a change to the row. Leaving `updatedAt` alone makes the
    // deleted row lose to its own pre-delete copy when two devices' bundles
    // merge, which silently restores the thing the user deleted.
    expect(row?.updatedAt).not.toBe(ship.updatedAt);
  });

  it('joins a cascade when handed a transaction id', async () => {
    const ship = await seedShip();

    await ops.softDelete(ship.id, 'tx-from-the-parent');

    expect((await db.ships.get(ship.id))?.softDeletedBy).toBe('tx-from-the-parent');
  });

  it('leaves an already-deleted row on its original transaction id', async () => {
    // The whole cost of the missing re-delete guard, stated as behaviour: a
    // second delete used to overwrite `softDeletedBy`, so restoring the parent
    // returned this row and orphaned everything that went down with it.
    const ship = await seedShip();
    await ops.softDelete(ship.id, 'tx-first');

    await ops.softDelete(ship.id, 'tx-second');

    expect((await db.ships.get(ship.id))?.softDeletedBy).toBe('tx-first');
  });

  it('mints a distinct id per delete when none is handed to it', async () => {
    const one = await seedShip();
    const two = await seedShip();

    await ops.softDelete(one.id);
    await ops.softDelete(two.id);

    const first = (await db.ships.get(one.id))?.softDeletedBy;
    const second = (await db.ships.get(two.id))?.softDeletedBy;
    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it('is a no-op on a row that is not there', async () => {
    await expect(ops.softDelete('no-such-ship')).resolves.toBeUndefined();
  });

  it('clears both columns on restore', async () => {
    const ship = await seedShip();
    await ops.softDelete(ship.id);

    await ops.restore(ship.id);

    const row = await db.ships.get(ship.id);
    expect(row?.deletedAt).toBeUndefined();
    expect(row?.softDeletedBy).toBeUndefined();
  });

  it('leaves a live row alone on restore', async () => {
    const ship = await seedShip();
    const before = await db.ships.get(ship.id);

    await ops.restore(ship.id);

    expect(await db.ships.get(ship.id)).toEqual(before);
  });

  it('reports a failed write to the caller, with the cause attached', async () => {
    // Local-first: a write that does not land has no server copy and no later
    // retry, so the one thing a repository may not do is return as though it
    // succeeded. Two repositories did exactly that before `c3adae1`.
    const ship = await seedShip();
    const quota = new DOMException('quota', 'QuotaExceededError');
    // `db.table('ships')`, not `db.ships`. Dexie hands back a *different object*
    // for the two accessors — measured here, `db.ships === db.table('ships')` is
    // `false` while `db.table('ships') === db.table('ships')` is `true` — and the
    // factory writes through the second. Spying the first leaves an inert spy
    // and a test that passes on nothing, which is how this codebase's own scan
    // recorded a false result once already.
    const update = vi.spyOn(db.table('ships'), 'update').mockRejectedValue(quota);

    await expect(ops.softDelete(ship.id)).rejects.toThrow(/probeRepository\.softDelete failed/);
    expect(update, 'the injection was never reached — the spy is inert').toHaveBeenCalled();
    await expect(ops.softDelete(ship.id)).rejects.toMatchObject({ cause: quota });
  });
});

describe('createDeletedListing', () => {
  const ops = createSoftDeleteOps(PROBE);
  const getDeleted = createDeletedListing<Ship>({ ...PROBE, scopeIndex: 'campaignId' });

  it('returns only tombstoned rows, and only from the scope asked for', async () => {
    const mine = await seedShip('camp-1');
    const live = await seedShip('camp-1');
    const theirs = await seedShip('camp-2');
    await ops.softDelete(mine.id);
    await ops.softDelete(theirs.id);

    const listed = await getDeleted('camp-1');

    expect(listed.map(r => r.id)).toEqual([mine.id]);
    expect(listed.map(r => r.id)).not.toContain(live.id);
  });

  it('lists the most recent deletion first', async () => {
    const older = await seedShip();
    const newer = await seedShip();
    await ops.softDelete(older.id);
    await db.ships.update(older.id, { deletedAt: '2020-01-01T00:00:00.000Z' });
    await ops.softDelete(newer.id);

    expect((await getDeleted('camp-1')).map(r => r.id)).toEqual([newer.id, older.id]);
  });
});

describe('createHardDelete', () => {
  const hardDelete = createHardDelete(PROBE);

  it('removes the row for good', async () => {
    const ship = await seedShip();

    await hardDelete(ship.id);

    expect(await db.ships.get(ship.id)).toBeUndefined();
  });

  it('reports a failed delete to the caller', async () => {
    // `db.table('ships')` again — see the note on the soft-delete spy above.
    const remove = vi.spyOn(db.table('ships'), 'delete').mockRejectedValue(new Error('disk gone'));

    await expect(hardDelete('anything')).rejects.toThrow(/probeRepository\.hardDelete failed/);
    expect(remove, 'the injection was never reached — the spy is inert').toHaveBeenCalled();
  });
});
