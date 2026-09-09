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

/** True if the body performs an irreversible row removal on a Dexie table. */
function removesRows(body: string): boolean {
  // Strip comments first, so prose describing a hard delete does not read as one.
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  return /\bdb\.[A-Za-z0-9_]+(?:\s*\.[A-Za-z0-9_]+\([^)]*\))*\s*\.(?:bulkDelete|delete)\s*\(/.test(code)
    || /\bdb\.[A-Za-z0-9_]+\s*\.\s*where\([\s\S]*?\.delete\s*\(\s*\)/.test(code);
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
