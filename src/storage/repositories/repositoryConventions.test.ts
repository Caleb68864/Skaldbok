import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The soft-delete contract every repository is meant to implement, made
 * visible.
 *
 * @remarks
 * There are 24 hand-written repositories and no `createRepository` factory, so
 * each one re-decides the same handful of questions and roughly 1,200 lines are
 * copy. That is not, by itself, the problem. The problem is that the copies
 * have diverged, and the divergences are invisible: every one of them
 * type-checks, every one passes its own tests, and each is only wrong when read
 * next to a sibling.
 *
 * This file is deliberately the *first* step, ahead of any factory. The
 * repository layer is where a mistake in a local-first app is unrecoverable —
 * the user's data exists in one browser — so the divergences want to be visible
 * and pinned before anything large moves. A test also keeps guarding whatever a
 * factory does not end up covering.
 *
 * Each check carries its own exception list with a reason per entry, and each
 * list is self-checking: an entry that no longer diverges fails, so the lists
 * cannot rot into a record of things that were fixed years ago. The lists are
 * not permission. They are the backlog, written down where the next person to
 * touch this layer will read it.
 *
 * **A new repository is on none of them and must therefore comply.** That is
 * the point: this stops the drift widening while the existing entries are worked
 * off one at a time.
 */

const REPOS_DIR = join(process.cwd(), 'src/storage/repositories');

interface RepoFunction {
  repo: string;
  name: string;
  body: string;
}

/** Strips comments so prose about a convention does not read as the code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

/** Every exported function in the repository layer, with its body. */
function repositoryFunctions(): RepoFunction[] {
  const found: RepoFunction[] = [];
  for (const file of readdirSync(REPOS_DIR).sort()) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
    const repo = file.replace(/\.ts$/, '');
    const source = readFileSync(join(REPOS_DIR, file), 'utf8');
    for (const part of source.split(/\n(?=export\s+(?:async\s+)?function\s)/)) {
      const match = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)([\s\S]*)$/.exec(part);
      if (!match) continue;
      found.push({ repo, name: match[1], body: stripComments(match[2]) });
    }
  }
  return found;
}

const functions = repositoryFunctions();
const repoSources = new Map(
  readdirSync(REPOS_DIR)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map(f => [f.replace(/\.ts$/, ''), stripComments(readFileSync(join(REPOS_DIR, f), 'utf8'))]),
);

/** The canonical single-row user-facing delete: `softDelete(id, txId?)`. */
const canonical = functions.filter(fn => fn.name === 'softDelete');
/** Repositories exposing one. */
const softDeleting = [...new Set(canonical.map(fn => fn.repo))].sort();

/** Asserts a divergence list names only repositories that still diverge. */
function assertListIsCurrent(
  list: Record<string, string>,
  diverging: Set<string>,
  what: string,
): void {
  for (const [repo, reason] of Object.entries(list)) {
    expect(
      diverging.has(repo),
      `${repo} is listed as ${what} ("${reason}") but no longer is — remove the entry.`,
    ).toBe(true);
  }
}

describe('repository soft-delete conventions', () => {
  it('found the repository layer', () => {
    // Every check below is a filter over these, so a broken walk passes them all.
    expect(repoSources.size).toBeGreaterThanOrEqual(20);
    expect(softDeleting.length).toBeGreaterThanOrEqual(15);
  });

  describe('softDelete can join a cascade', () => {
    /**
     * A `softDelete` with no `txId` parameter can never be enlisted by a
     * parent's cascade: whatever it deletes gets its own transaction id, so a
     * later `restore` of the parent leaves it behind.
     */
    const NO_TX_ID: Record<string, string> = {
      shipRepository:
        'takes only (id) — a ship cannot go down with its campaign or come back with it. ' +
        'ledgerRepository documents choosing the wider signature "rather than shipRepository\'s narrower one", ' +
        'so the drift is known; widening it is a signature change with call sites to follow.',
    };

    const missing = new Set(
      canonical.filter(fn => !/^\s*\([^)]*\btxId\b/.test(fn.body)).map(fn => fn.repo),
    );

    it('lists only repositories that still lack it', () => {
      assertListIsCurrent(NO_TX_ID, missing, 'lacking a txId parameter');
    });

    it.each(softDeleting)('%s.softDelete accepts a txId', repo => {
      if (NO_TX_ID[repo]) return;
      expect(
        missing.has(repo),
        `${repo}.softDelete takes no txId, so it can never be enlisted in a parent's ` +
        'cascade — restoring the parent would not bring it back. Add `txId?: string`.',
      ).toBe(false);
    });
  });

  describe('softDelete refuses to re-delete', () => {
    /**
     * Re-deleting an already-deleted row overwrites `softDeletedBy` with a
     * fresh transaction id, orphaning the first cascade: `restore` then brings
     * back the row and not its children.
     */
    const NO_GUARD: Record<string, string> = {
      ledgerRepository: 'no `if (row.deletedAt) return`; a re-delete re-stamps the txId',
      ledgerSplitRepository: 'same; splits are cascaded from the entry, so a re-stamp strands them',
      recurringBillRepository: 'same',
      routePlanRepository: 'same',
      shipRepository: 'same, and it has no txId either — see the list above',
    };

    const unguarded = new Set(
      canonical.filter(fn => !/\.deletedAt\s*\)\s*return/.test(fn.body)).map(fn => fn.repo),
    );

    it('lists only repositories that are still unguarded', () => {
      assertListIsCurrent(NO_GUARD, unguarded, 'missing the re-delete guard');
    });

    it.each(softDeleting)('%s.softDelete no-ops on an already-deleted row', repo => {
      if (NO_GUARD[repo]) return;
      expect(
        unguarded.has(repo),
        `${repo}.softDelete does not check \`if (row.deletedAt) return\`. Deleting ` +
        'twice overwrites softDeletedBy with a new transaction id, so restore ' +
        'brings back the row and orphans everything that went down with it.',
      ).toBe(false);
    });
  });

  describe('softDelete mints its transaction id through the shared helper', () => {
    /**
     * `generateSoftDeleteTxId` is a thin alias over `generateId` and exists
     * purely so the cascade sites are greppable. A bare `generateId()` in a
     * `softDelete` defeats the one thing the alias is for.
     */
    const BARE_GENERATE_ID: Record<string, string> = {
      ledgerAccountRepository: 'uses generateId() directly',
      ledgerRepository: 'uses generateId() directly',
      ledgerSplitRepository: 'uses generateId() directly',
      recurringBillRepository: 'uses generateId() directly',
      routePlanRepository: 'uses generateId() directly',
      routeRepository: 'uses generateId() directly',
      shipRepository: 'uses generateId() directly',
    };

    const bare = new Set(
      canonical.filter(fn => !fn.body.includes('generateSoftDeleteTxId()')).map(fn => fn.repo),
    );

    it('lists only repositories still using the bare generator', () => {
      assertListIsCurrent(BARE_GENERATE_ID, bare, 'using generateId() in softDelete');
    });

    it.each(softDeleting)('%s.softDelete uses generateSoftDeleteTxId', repo => {
      if (BARE_GENERATE_ID[repo]) return;
      expect(
        bare.has(repo),
        `${repo}.softDelete mints its transaction id with generateId() rather than ` +
        'generateSoftDeleteTxId(). The alias exists so every cascade site is ' +
        'findable with one grep; using the raw generator makes this one invisible.',
      ).toBe(false);
    });
  });

  describe('a soft-deleted row can be listed again', () => {
    /**
     * `restore` with no `getDeleted` is a row the Trash cannot show, so the
     * capability exists and nothing surfaces it — the exact bug the Trash
     * registry was built to fix. `trashRegistry.test.ts` enforces
     * `getDeleted → registry` and not the reverse, so these pass there.
     */
    const NO_GET_DELETED: Record<string, string> = {
      campaignRepository: 'a deleted campaign cannot be listed or restored; no UI deletes one today',
      encounterRepository: 'same — encounters are deleted only as part of a session cascade so far',
      ledgerSplitRepository: 'restored with its parent entry by txId, never on its own',
      routePlanRepository: 'no UI deletes a route plan today',
      entityLinkRepository: 'edges are restored with the entity they belong to, by txId, never listed',
      // Found by this test rather than by the scan that prompted it: the Trash
      // lists deleted party *members* (getDeletedMembers) and there is no
      // equivalent for the party itself, so partyRepository.restore has no way
      // to be reached.
      partyRepository: 'getDeletedMembers covers members; a deleted party itself cannot be listed',
    };

    const restorable = new Set(
      functions.filter(fn => fn.name === 'restore').map(fn => fn.repo),
    );
    const listable = new Set(functions.filter(fn => fn.name === 'getDeleted').map(fn => fn.repo));
    const unlistable = new Set([...restorable].filter(repo => !listable.has(repo)));

    it('lists only repositories that still cannot list their deleted rows', () => {
      assertListIsCurrent(NO_GET_DELETED, unlistable, 'having restore without getDeleted');
    });

    it.each([...restorable].sort())('%s can list what it deleted', repo => {
      if (NO_GET_DELETED[repo]) return;
      expect(
        unlistable.has(repo),
        `${repo} has restore() and no getDeleted(). The row is recoverable in ` +
        'principle and unreachable in practice: the Trash builds its sections ' +
        'from getDeleted, so the day this gains a delete button the row lands ' +
        'somewhere the user cannot see it.',
      ).toBe(false);
    });
  });

  describe('rows are validated on the way out of the database', () => {
    /**
     * Every one of these entities has a Zod schema — they are all validated on
     * import, in `types/bundle.ts`. A row is therefore checked when it arrives
     * from a file and never when it comes off disk, which is the direction that
     * matters after a partial migration.
     */
    const UNVALIDATED_READS: Record<string, string> = {
      characterRepository: 'upgrades on read instead (upgradeCharacter); deliberate — one malformed field must not stop the library loading',
      inventoryContainerRepository: 'no schema check on read',
      kbEdgeRepository: 'KB graph is a derived projection of notes, rebuilt by syncNote',
      kbNodeRepository: 'same — derived, not authored',
      ledgerAccountRepository: 'no schema check on read',
      ledgerRepository: 'no schema check on read',
      ledgerSplitRepository: 'no schema check on read',
      metadataRepository: 'opaque string values by design',
      recurringBillRepository: 'no schema check on read',
      referenceNoteRepository: 'legacy table, superseded at v7',
      referenceSectionRepository: 'no schema check on read',
      routePlanRepository: 'no schema check on read',
      routeRepository: 'no schema check on read',
      settingsRepository: 'merged over defaults on read rather than validated',
      shipRepository: 'no schema check on read',
      systemRepository: 'validated by systemDefinitionSchema at the import boundary instead',
    };

    const unvalidated = new Set(
      [...repoSources.entries()].filter(([, source]) => !source.includes('safeParse')).map(([repo]) => repo),
    );

    it('lists only repositories that still validate nothing', () => {
      assertListIsCurrent(UNVALIDATED_READS, unvalidated, 'validating nothing on read');
    });

    it.each([...repoSources.keys()].sort())('%s validates what it reads', repo => {
      if (UNVALIDATED_READS[repo]) return;
      expect(
        unvalidated.has(repo),
        `${repo} never calls safeParse. Its entity has a Zod schema — every one ` +
        'of these does, used for import validation — so a row is checked when it ' +
        'arrives from a file and never when it comes off disk.',
      ).toBe(false);
    });
  });
});

/**
 * Every catch block, by brace balancing so a nested block cannot end one early.
 */
function catchBlocks(body: string): string[] {
  const blocks: string[] = [];
  const opener = /catch\s*(?:\([^)]*\))?\s*\{/g;
  for (const match of body.matchAll(opener)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = open; i < body.length; i++) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}') {
        depth--;
        if (depth === 0) {
          blocks.push(body.slice(open, i + 1));
          break;
        }
      }
    }
  }
  return blocks;
}

/** A Dexie write — the operations that can fail on a full disk. */
const WRITES_A_ROW = /\bdb\.[A-Za-z0-9_]+\s*\.\s*(?:add|put|update|bulkAdd|bulkPut|bulkUpdate|bulkDelete|delete|clear)\s*\(/;

describe('a failed write reaches the caller', () => {
  /**
   * @remarks
   * This is local-first: a write that does not land has no server copy to fall
   * back on, and no later retry. So a repository write either succeeds or says
   * so — every one of the ~130 write functions in this layer propagates, except
   * two that caught *everything* from `db.<table>.add(record)`, `console.warn`ed
   * and returned `undefined`.
   *
   * `creatureTemplateRepository.create` and `encounterRepository.create` were
   * the two. `useBestiary.ts:43-46` ignored the return value and
   * `BestiaryScreen.tsx:99-102` called `setShowForm(false)` unconditionally, so
   * on a quota failure the user watched the form close and the creature was
   * gone with no message. `BestiaryScreen.handleImport`'s docstring claimed "a
   * failure part-way leaves the creatures already written intact" — there was no
   * failure to observe, because `create` never threw.
   *
   * The `preserve-caught-error` lint rule cannot find this. It is structurally
   * blind to a `catch` that never constructs an error at all: there is nothing
   * for a `cause` to be attached to.
   */
  const swallowing = functions.filter(
    fn => WRITES_A_ROW.test(fn.body) && catchBlocks(fn.body).some(block => !/\bthrow\b/.test(block)),
  );

  it('found write functions to check', () => {
    // Without this a broken walk makes the assertion below vacuous.
    expect(functions.filter(fn => WRITES_A_ROW.test(fn.body)).length).toBeGreaterThan(50);
  });

  it('has no repository write that catches a failure and returns anyway', () => {
    const names = swallowing.map(fn => `${fn.repo}.${fn.name}`).sort();
    expect(
      names,
      `${names.join(', ')} catches every error from a Dexie write — QuotaExceededError ` +
      'included — and returns as though it succeeded. The caller cannot tell a saved ' +
      'record from a lost one, and on a local-first app a lost record is lost for good. ' +
      'Throw, the way the rest of this layer does.',
    ).toEqual([]);
  });
});
