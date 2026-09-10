import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * No user-facing code may reach a permanent delete.
 *
 * @remarks
 * The soft-delete convention is the app's most consequential one, because this
 * is local-first: a destroyed row existed in exactly one browser and there is
 * no server copy to restore from. `CLAUDE.md` states the rule — `hardDelete` is
 * internal only, user deletes call `softDelete` — and until this file existed
 * the rule held by habit.
 *
 * It had already stopped holding in two places:
 *
 * 1. `referenceNoteRepository.remove` was a permanent `db.referenceNotes.delete`
 *    wired directly to a delete-confirmation dialog in `ReferenceScreen`, with
 *    no Trash entry. It survived review because it was not *named* `hardDelete`,
 *    which is what everyone greps for.
 * 2. `noteRepository.deleteNote` was a callerless second copy of `hardDelete`
 *    whose JSDoc `@example` read `await deleteNote('abc123')` — an invitation
 *    to a one-line import that permanently destroys a note.
 *
 * So the guard checks the *operation*, not the name: any repository function
 * that reaches `db.<table>.delete(...)` / `.bulkDelete(...)` must be named for
 * what it does, and no code outside `src/storage/` may call one.
 */

const SRC = join(process.cwd(), 'src');
const REPOS_DIR = join(SRC, 'storage/repositories');

/**
 * Permanent deletes of **domain** rows. Internal to `src/storage` without
 * exception.
 *
 * @remarks
 * Adding a name here is a deliberate act: it declares a new irreversible
 * operation on user content. Prefer extending an existing `hardDelete` over
 * inventing a name — the point of the convention is that one grep finds them
 * all. Each of these carries a `@remarks` in its own file explaining why it is
 * permanent; none has a caller today.
 */
const DOMAIN_HARD_DELETES = new Set([
  'hardDelete',
  'deleteAttachment',
  'deleteAttachmentsByNote',
  'removePartyMember',
]);

/**
 * Permanent deletes of **KB graph** rows.
 *
 * @remarks
 * `kb_nodes` / `kb_edges` are a derived projection of notes, rebuilt from them
 * by `syncNote`, and are two of the six tables deliberately outside the
 * soft-delete model — there is no user content to lose, and a stale node is the
 * actual bug. So `features/kb/linkSyncEngine.ts`, which owns that projection,
 * is allowed to call these; nothing else should need to.
 */
const GRAPH_MAINTENANCE = new Set([
  'deleteEdge',
  'deleteEdgesFromNode',
  'deleteEdgesToNode',
  'deleteNode',
  'deleteNodesBySource',
]);

/** Files outside `src/storage` allowed to call {@link GRAPH_MAINTENANCE}. */
const GRAPH_MAINTAINERS = ['features/kb/linkSyncEngine.ts'];

/** Every `.ts` file under `src`, excluding tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

interface RepoFunction {
  file: string;
  name: string;
  body: string;
}

/**
 * Every exported function in the repository layer, sliced from its declaration
 * to the start of the next one.
 */
function repositoryFunctions(): RepoFunction[] {
  const found: RepoFunction[] = [];
  for (const name of readdirSync(REPOS_DIR).sort()) {
    if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
    const source = readFileSync(join(REPOS_DIR, name), 'utf8');
    const parts = source.split(/\n(?=export\s+(?:async\s+)?function\s)/);
    for (const part of parts) {
      const match = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/.exec(part);
      if (!match) continue;
      found.push({ file: name, name: match[1], body: part });
    }
  }
  return found;
}

/**
 * Files outside `src/storage` allowed to wipe *every* table.
 *
 * @remarks
 * Two entries, and both are the demonstration rather than the bug. The
 * permission is deliberately for the whole-database wipe only: allowlisting a
 * *file* would let any later `db.notes.delete(...)` in it ride along on a
 * decision that was made about something else.
 */
const WHOLE_DATABASE_WIPES: Record<string, string> = {
  'screens/SettingsScreen.tsx':
    'The "Clear All Data" flow: `db.transaction("rw", db.tables, …)` clearing every '
    + 'table, behind two confirmations and a typed "DELETE". Deliberately not routed '
    + 'through a repository — it is defined as "every table", not as a list of them.',
  'test-utils/resetDatabase.ts':
    'Test-only. It sits outside a `.test.ts` file so suites can share it, and nothing '
    + 'in the app imports it; it exists precisely so no test hand-lists tables to clear.',
};

/** Source with comments removed, so prose describing a hard delete is not one. */
function stripComments(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

/** True if the code permanently removes rows from a *named* Dexie table. */
function removesNamedTableRows(body: string): boolean {
  const code = stripComments(body);
  // `clear` joins `delete`/`bulkDelete`: it is the most destructive of the
  // three and was in neither pattern, so `db.notes.clear()` in a repository
  // passed the guard that exists to name every permanent delete.
  return /\bdb\.[A-Za-z0-9_]+(?:\s*\.[A-Za-z0-9_]+\([^)]*\))*\s*\.(?:bulkDelete|delete|clear)\s*\(/.test(code)
    || /\bdb\.[A-Za-z0-9_]+\s*\.\s*where\([\s\S]*?\.delete\s*\(\s*\)/.test(code);
}

/**
 * True if the code empties every table at once.
 *
 * @remarks
 * `for (const table of db.tables) await table.clear()` names no table, so it
 * matches nothing in {@link removesNamedTableRows}. It is a separate operation
 * with a separate permission.
 */
function wipesEveryTable(body: string): boolean {
  const code = stripComments(body);
  return /\bdb\.tables\b/.test(code) && /\.\s*clear\s*\(\s*\)/.test(code);
}

/** True if the code performs an irreversible row removal on a Dexie table. */
function removesRows(body: string): boolean {
  return removesNamedTableRows(body) || wipesEveryTable(body);
}

describe('hard deletes are unreachable from the UI', () => {
  const functions = repositoryFunctions();

  it('finds the repository layer', () => {
    // Without this, an exports-shape change makes every assertion below vacuous.
    expect(functions.length).toBeGreaterThan(100);
  });

  it('declares every permanent delete under a name that says so', () => {
    const unsanctioned = functions
      .filter(
        fn =>
          removesRows(fn.body) &&
          !DOMAIN_HARD_DELETES.has(fn.name) &&
          !GRAPH_MAINTENANCE.has(fn.name),
      )
      .map(fn => `${fn.file}:${fn.name}`);
    expect(
      unsanctioned,
      `${unsanctioned.join(', ')} permanently removes rows but is not declared ` +
      'above. This is how `referenceNoteRepository.remove` ended up wired to a ' +
      'delete button: reviewers grep for `hardDelete` and a plain-sounding name ' +
      'passes. Either declare it here with a reason, or — if the user can reach ' +
      'it — make it a soft delete with a Trash entry instead.',
    ).toEqual([]);
  });

  it('never lets a domain hard delete be called outside src/storage', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file);
      if (rel.startsWith('storage/')) continue;
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|\s)\/\/[^\n]*/g, '$1');
      const forbidden = GRAPH_MAINTAINERS.includes(rel.split('\\').join('/'))
        ? DOMAIN_HARD_DELETES
        : new Set([...DOMAIN_HARD_DELETES, ...GRAPH_MAINTENANCE]);
      for (const name of forbidden) {
        // `.name(` catches `repo.hardDelete(id)`; a bare `name(` catches a
        // destructured import being called directly.
        if (new RegExp(`(?:\\.|\\b)${name}\\s*\\(`).test(code)) {
          offenders.push(`${rel} calls ${name}()`);
        }
      }
    }
    expect(
      offenders,
      `${offenders.join('; ')}. Permanent deletes are internal to the storage ` +
      'layer. A user-facing Delete calls softDelete, which the Trash can restore.',
    ).toEqual([]);
  });

  it('never lets a permanent delete be written outside the storage layer', () => {
    // The hole the two assertions above leave between them. `removesRows` — the
    // whole point of this file, the check that looks at the *operation* rather
    // than the name — was only ever applied to `repositoryFunctions()`, which
    // reads `src/storage/repositories` and nothing else. The assertion above
    // scans the rest of `src` for calls to repository functions *by name*, so a
    // delete written inline reaches no check at all.
    //
    // Proven: inserting `await db.notes.delete('probe-id');` into
    // `screens/SettingsScreen.tsx` — a non-storage file that already imports
    // `db` — left the whole suite green at 1931 tests.
    //
    // `sourceFiles(SRC)` was already here, walking every file; it simply was
    // never handed the operation check.
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file).split('\\').join('/');
      if (rel.startsWith('storage/')) continue;
      const source = readFileSync(file, 'utf8');
      // The permission is per-operation, not per-file: an allowlisted
      // whole-database wipe does not license a `db.notes.delete(...)` next to it.
      if (removesNamedTableRows(source)) offenders.push(`${rel} removes rows from a named table`);
      if (wipesEveryTable(source) && !(rel in WHOLE_DATABASE_WIPES)) {
        offenders.push(`${rel} empties every table`);
      }
    }
    expect(
      offenders,
      `${offenders.join('; ')}. This is local-first: a destroyed row existed in one `
      + 'browser and there is no server copy. Route it through a repository '
      + '`softDelete` with a Trash entry — or, for a whole-database wipe the user '
      + 'deliberately invokes, declare the file in WHOLE_DATABASE_WIPES with a reason.',
    ).toEqual([]);
  });

  it('keeps the whole-database-wipe allowlist honest', () => {
    // An entry that no longer describes anything is a permission left lying
    // around for the next person to inherit.
    for (const [rel, reason] of Object.entries(WHOLE_DATABASE_WIPES)) {
      const source = readFileSync(join(SRC, rel), 'utf8');
      expect(wipesEveryTable(source), `${rel} is allowlisted but wipes nothing`).toBe(true);
      expect(reason.length, `${rel} is allowlisted with no stated reason`).toBeGreaterThan(40);
    }
  });

  it('gives every soft-deletable table a way back out of the Trash', () => {
    // The registry is the only thing that turns a `getDeleted` into a restorable
    // row on screen; `trashRegistry.test.ts` enforces the mapping itself.
    const registry = readFileSync(join(SRC, 'features/trash/trashRegistry.ts'), 'utf8');
    const withGetDeleted = functions
      .filter(fn => fn.name === 'getDeleted')
      .map(fn => fn.file.replace(/\.ts$/, ''));
    expect(withGetDeleted).toContain('referenceNoteRepository');
    expect(registry).toContain('referenceNoteRepository');
  });
});
