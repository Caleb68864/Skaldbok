// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import * as metadataRepository from './metadataRepository';
import { bulkRebuildGraph } from '../../features/kb/linkSyncEngine';

/**
 * One logical metadata key, one row.
 *
 * @remarks
 * `metadata` is a key-value store whose primary key is `id`, not `key`, so
 * "one row per key" is a convention rather than a constraint — and
 * `metadataRepository.set` is the only thing that keeps it, by finding the
 * existing row before writing and generating an id only for a genuinely new
 * key.
 *
 * `linkSyncEngine.bulkRebuildGraph` bypassed it with
 * `db.table('metadata').put({ id: key, key, value })`, which is *self*-idempotent
 * — writing the same row twice is one row — and not idempotent against `set`,
 * which would have produced a row under a generated id. Two rows for one key,
 * and `metadataRepository.get` resolves with `.first()`, so which one wins is
 * whatever the index hands back. The key in question is
 * `migration_kb_graph_v1`, whose entire job is to answer "has the KB graph been
 * built?" — so the failure mode is a full graph rebuild on every mount, or none
 * ever, depending on the coin flip.
 *
 * The probe below is the interleaving that produces it: a write through the
 * repository followed by a rebuild. It is not hypothetical ordering — the
 * repository is how every other migration flag in the app is written.
 */

describe('the KB rebuild marker', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('is set by a rebuild even when the key already exists under another id', async () => {
    await metadataRepository.set('migration_kb_graph_v1', 'false');
    // Control: the fixture reached the subject. Without this a `set` that wrote
    // nothing would leave the assertion below testing an empty table.
    expect(await metadataRepository.get('migration_kb_graph_v1')).toBe('false');

    await bulkRebuildGraph('camp-1');

    expect(
      await metadataRepository.get('migration_kb_graph_v1'),
      'the rebuild ran and its completion marker was not recorded',
    ).toBe('true');
    const rows = await db.metadata.where('key').equals('migration_kb_graph_v1').toArray();
    expect(rows, `${rows.length} rows share one logical key`).toHaveLength(1);
  });

  it('is written by a rebuild that runs before anything else', async () => {
    await bulkRebuildGraph('camp-1');
    expect(await metadataRepository.get('migration_kb_graph_v1')).toBe('true');
    const rows = await db.metadata.where('key').equals('migration_kb_graph_v1').toArray();
    expect(rows).toHaveLength(1);
  });
});
