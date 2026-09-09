// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { db } from './client';

/**
 * Every table queried by `softDeletedBy` must be indexed on it.
 *
 * @remarks
 * `restore` finds a cascade's siblings with
 * `db.<table>.where('softDeletedBy').equals(txId)`. Dexie can only serve that
 * from an index: on a table without one it throws a `SchemaError` — not a slow
 * query, a hard failure.
 *
 * Three tables are indexed (`entityLinks` at v8, `referenceSections` at v19,
 * `attachments` at v20) and three repositories query it. They agree exactly, by
 * hand, with nothing checking. A fourth repository adding the query throws at
 * runtime **on the restore path**, which is the least-exercised path in the app
 * and the one a user only reaches when something has already gone wrong. That
 * is the same shape as the fault `version(19)` exists to repair:
 * `referenceSections` grew the query before it grew the index.
 *
 * The index side is read off the *opened database* rather than parsed out of
 * the `.stores(...)` strings, so it reflects the schema Dexie actually
 * assembles across all twenty version blocks.
 */

const SRC = join(process.cwd(), 'src');

/** Every `.ts`/`.tsx` file under `src`, excluding tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Table names the source queries with `where('softDeletedBy')`. */
function tablesQueriedBySoftDeletedBy(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const pattern = /db\.([A-Za-z0-9_]+)\s*\.where\(\s*['"]softDeletedBy['"]\s*\)/g;
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      const table = match[1];
      const at = found.get(table) ?? [];
      at.push(relative(SRC, file));
      found.set(table, at);
    }
  }
  return found;
}

describe('softDeletedBy is indexed wherever it is queried', () => {
  const queried = tablesQueriedBySoftDeletedBy();

  beforeAll(async () => {
    // Opening applies every version block, so `table.schema` is the assembled
    // schema rather than any one `.stores(...)` line.
    if (!db.isOpen()) await db.open();
  });

  it('finds the queries', () => {
    // A regex that stops matching would make the check below vacuous, and this
    // guard's whole value is that it fires for a query nobody has written yet.
    expect(queried.size).toBeGreaterThanOrEqual(3);
  });

  it.each([...queried.keys()].sort())('%s has a softDeletedBy index', tableName => {
    const table = db.tables.find(t => t.name === tableName);
    expect(table, `db.${tableName} is queried but is not a table on the database`).toBeDefined();
    const indexes = table!.schema.indexes.map(i => i.name);
    expect(
      indexes,
      `db.${tableName}.where('softDeletedBy') is called from ` +
      `${queried.get(tableName)!.join(', ')}, but ${tableName} has no softDeletedBy ` +
      'index — Dexie throws a SchemaError there, at runtime, on the restore path. ' +
      'Add the index in a NEW version(n) block (never edit a released one) and ' +
      'record its fingerprint in releasedSchemaVersions.test.ts.',
    ).toContain('softDeletedBy');
  });

  it('really does throw when the index is missing', async () => {
    // Pins the consequence, so the rule above is not folklore. `campaigns`
    // carries softDeletedBy on its rows and is not indexed on it — which is
    // fine, because campaignRepository.restore does not query by it.
    //
    // Note where the throw happens: not at `.where(...)` but when the query
    // runs. That is why this fault reaches production — it is invisible until
    // someone actually restores something.
    const campaigns = db.tables.find(t => t.name === 'campaigns');
    expect(campaigns!.schema.indexes.map(i => i.name)).not.toContain('softDeletedBy');
    await expect(
      db.campaigns.where('softDeletedBy').equals('tx-1').toArray(),
    ).rejects.toThrow(/softDeletedBy/);
  });
});
