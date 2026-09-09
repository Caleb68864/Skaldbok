import { db } from '../storage/db/client';

/**
 * Empties every table in the live Dexie schema.
 *
 * @remarks
 * Test-only. It lives outside a `.test.ts` file so the tests can share it, and
 * nothing in the app imports it.
 *
 * Fifteen test files reset the database in `beforeEach`, in four mutually
 * incompatible dialects. This replaces the fragile one: a hand-written list of
 * `db.notes.clear()`, `db.entityLinks.clear()`, … per file. That list is a
 * parallel copy of the schema, and it fails in the quietest possible way — a
 * table joins a repository's write path, no one adds it to that file's
 * `beforeEach`, and rows leak between tests until an unrelated assertion starts
 * failing for a reason that is nowhere near the change that caused it.
 *
 * Derived from `db.tables`, so a new table joins automatically.
 *
 * The other sanctioned dialect is `await db.delete(); await db.open();`, which
 * is not the same thing and is not replaced by this: it drops and rebuilds the
 * database, re-running the whole upgrade ladder. Use it when a test needs a
 * genuinely fresh install (`freshInstallRestore.test.ts`) and this when a test
 * only needs empty tables. Migration tests that construct an *old* schema
 * version use `Dexie.delete(DB_NAME)` for a third reason again — they need the
 * database gone before they can declare it at a lower version.
 */
export async function resetDatabase(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}
