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
 *
 * ## The factory, and why it is checked rather than trusted
 *
 * `createRepository.ts` now writes the lifecycle once, built to what this file
 * states. Five repositories delegate to it and three whole exception lists
 * emptied as a result — which is also the moment a source-scanning guard is most
 * at risk: `export const softDelete = lifecycle.softDelete` is not
 * `export async function softDelete`, so a guard reading declarations would
 * simply stop seeing those five and report nothing.
 *
 * It does not. Three things keep that honest:
 *
 * 1. {@link exportedNames} reads `export const` as well as `export function`, so
 *    a factory-backed repository is still *counted* — the floor assertion in
 *    "found the repository layer" stays load-bearing.
 * 2. A repository is excused the pattern checks **only** if its `softDelete`
 *    demonstrably comes from the factory. Anything else — a repository that
 *    exports a `softDelete` this file cannot attribute to either route — is
 *    reported, not skipped.
 * 3. The factory itself is held to the same three patterns, in the same run. It
 *    is one file, so a divergence there is a divergence everywhere; checking it
 *    costs three assertions and closes the obvious laundering route, which is to
 *    move a non-compliant write behind a helper the guard does not read.
 */

const REPOS_DIR = join(process.cwd(), 'src/storage/repositories');

/**
 * The shared lifecycle factory. Not a repository: it owns no entity and names
 * no table.
 */
const FACTORY = 'createRepository';

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

/**
 * Names a module exports, by either route.
 *
 * @remarks
 * `export const softDelete = lifecycle.softDelete` is as much an export as
 * `export async function softDelete`. Reading only the second is how a guard
 * over a hand-written layer quietly stops covering a layer that has been
 * factored.
 */
function exportedNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/\bexport\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) {
    names.add(match[1]!);
  }
  for (const match of source.matchAll(/\bexport\s+const\s+([A-Za-z0-9_]+)\s*(?:[:=])/g)) {
    names.add(match[1]!);
  }
  return names;
}

/** The canonical single-row user-facing delete: `softDelete(id, txId?)`. */
const canonical = functions.filter(fn => fn.name === 'softDelete');

/**
 * Repositories whose `softDelete` is built by the factory, so the three
 * patterns below are satisfied by construction.
 *
 * @remarks
 * Detected from the two facts together — the module calls `createSoftDeleteOps`
 * *and* exports a `softDelete` — rather than from the call alone, so a file that
 * takes the factory and then exports something else of its own is not excused by
 * it.
 */
const factoryBacked = new Set(
  [...repoSources.entries()]
    .filter(
      ([repo, source]) =>
        repo !== FACTORY
        && /\bcreateSoftDeleteOps\s*\(/.test(source)
        && exportedNames(source).has('softDelete'),
    )
    .map(([repo]) => repo),
);

/** Repositories exposing a single-row `softDelete`, by either route. */
const softDeleting = [
  ...new Set([...canonical.map(fn => fn.repo), ...factoryBacked]),
].filter(repo => repo !== FACTORY).sort();

/** Every repository exporting a `softDelete` this file can attribute to neither route. */
const unattributedSoftDeletes = [...repoSources.entries()]
  .filter(([repo, source]) => repo !== FACTORY && exportedNames(source).has('softDelete'))
  .map(([repo]) => repo)
  .filter(repo => !factoryBacked.has(repo) && !canonical.some(fn => fn.repo === repo))
  .sort();

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
    // And the factory has to be reachable, or "factory-backed" excuses nothing
    // because nothing is.
    expect(repoSources.has(FACTORY), 'the lifecycle factory is missing').toBe(true);
    expect(factoryBacked.size, 'no repository uses the factory').toBeGreaterThan(0);
  });

  it('can account for every softDelete in the layer', () => {
    // The branch that would let the checks below go quiet. A `softDelete` this
    // file can attribute to neither a declaration it can read nor the factory
    // is excused by *default* — which is the shape of every guard gap in this
    // codebase. Report it instead.
    expect(
      unattributedSoftDeletes,
      `${unattributedSoftDeletes.join(', ')} exports a softDelete that is neither an ` +
      '`export async function` this file can read nor built by `createSoftDeleteOps`. ' +
      'It is therefore checked by nothing. Declare it, or build it from the factory.',
    ).toEqual([]);
  });

  describe('softDelete can join a cascade', () => {
    /**
     * A `softDelete` with no `txId` parameter can never be enlisted by a
     * parent's cascade: whatever it deletes gets its own transaction id, so a
     * later `restore` of the parent leaves it behind.
     *
     * @remarks
     * Empty. `shipRepository` was the only entry — its `softDelete` took `(id)`
     * alone, so a ship could not go down with its campaign or come back with
     * it, and `ledgerRepository` documented choosing the wider signature
     * "rather than `shipRepository`'s narrower one", which recorded the drift
     * without closing it. Both come from the factory now, whose signature is
     * `(id, txId?)`.
     */
    const NO_TX_ID: Record<string, string> = {};

    const missing = new Set(
      canonical.filter(fn => !/^\s*\([^)]*\btxId\b/.test(fn.body)).map(fn => fn.repo),
    );

    it('lists only repositories that still lack it', () => {
      assertListIsCurrent(NO_TX_ID, missing, 'lacking a txId parameter');
    });

    it.each(softDeleting)('%s.softDelete accepts a txId', repo => {
      if (NO_TX_ID[repo] || factoryBacked.has(repo)) return;
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
     *
     * @remarks
     * Empty. All five entries — ledger, ledgerSplit, recurringBill, routePlan
     * and ship — were the same missing line, and all five now take the guard
     * from the factory. `ledgerSplitRepository`'s entry was the one that said
     * what the cost is: splits are cascaded from their entry, so a re-stamp
     * strands them, and restoring the entry brings back the row without them.
     */
    const NO_GUARD: Record<string, string> = {};

    const unguarded = new Set(
      canonical.filter(fn => !/\.deletedAt\s*\)\s*return/.test(fn.body)).map(fn => fn.repo),
    );

    it('lists only repositories that are still unguarded', () => {
      assertListIsCurrent(NO_GUARD, unguarded, 'missing the re-delete guard');
    });

    it.each(softDeleting)('%s.softDelete no-ops on an already-deleted row', repo => {
      if (NO_GUARD[repo] || factoryBacked.has(repo)) return;
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
     *
     * @remarks
     * Empty. Five of the seven entries moved onto the factory, which mints
     * through the alias; the two that keep a hand-written `softDelete` because
     * it does more than tombstone a row — `ledgerAccountRepository`, which
     * refuses the delete when entries or bills still name the account, and
     * `routeRepository`, which closes the gap in the stop order — were changed
     * to call the alias directly. The two duplicate-collapsing soft deletes in
     * `ledgerSplitRepository.getOrCreateForCampaign` and
     * `routePlanRepository.getOrCreateForCampaign` were switched with them: they
     * are cascade sites too, and the grep the alias exists for should find them.
     */
    const BARE_GENERATE_ID: Record<string, string> = {};

    const bare = new Set(
      canonical.filter(fn => !fn.body.includes('generateSoftDeleteTxId()')).map(fn => fn.repo),
    );

    it('lists only repositories still using the bare generator', () => {
      assertListIsCurrent(BARE_GENERATE_ID, bare, 'using generateId() in softDelete');
    });

    it.each(softDeleting)('%s.softDelete uses generateSoftDeleteTxId', repo => {
      if (BARE_GENERATE_ID[repo] || factoryBacked.has(repo)) return;
      expect(
        bare.has(repo),
        `${repo}.softDelete mints its transaction id with generateId() rather than ` +
        'generateSoftDeleteTxId(). The alias exists so every cascade site is ' +
        'findable with one grep; using the raw generator makes this one invisible.',
      ).toBe(false);
    });
  });

  describe('the factory is held to the same three patterns', () => {
    /**
     * The laundering route, closed.
     *
     * @remarks
     * Every check above excuses a factory-backed repository on the grounds that
     * the factory complies. That is only worth anything if something says so.
     * These read `createRepository.ts` with the *same* three patterns the
     * hand-written repositories are read with, so "move it behind the factory"
     * cannot become a way to stop being checked — and because it is one file,
     * a divergence here would be a divergence in every repository at once.
     *
     * **The slice below is the load-bearing part, and the first version of it
     * was wrong.** The `SoftDeleteOps` interface declares
     * `softDelete(id: string, txId?: string)` a few lines above the
     * implementation, so a pattern searching the whole file matched the
     * *declaration*: a probe that removed `txId` from the implementation left
     * all four assertions green, because the file still contained the words —
     * in the type. The search therefore starts past the interface, at
     * `export function createSoftDeleteOps`, and the implementation is told
     * apart by its `async`, which an interface member cannot carry.
     */
    const factory = repoSources.get(FACTORY) ?? '';
    const implementation = factory.slice(factory.indexOf('export function createSoftDeleteOps'));
    const softDeleteImpl = /async softDelete\([^)]*\)[\s\S]*?\n {4}\},/.exec(implementation)?.[0] ?? '';

    it('reached the implementation, not the interface describing it', () => {
      // Without the first line the assertions below pass on an empty string;
      // without the second they pass on the interface.
      expect(softDeleteImpl, 'could not find the factory softDelete').toContain('rows.update(');
      expect(softDeleteImpl, 'matched a declaration rather than a body').toContain('async softDelete(');
    });

    it('takes a txId', () => {
      expect(/async softDelete\(id: string, txId\?: string\)/.test(softDeleteImpl)).toBe(true);
    });

    it('refuses to re-delete', () => {
      expect(/\.deletedAt\s*\)\s*return/.test(softDeleteImpl)).toBe(true);
    });

    it('mints through the shared helper', () => {
      expect(softDeleteImpl).toContain('generateSoftDeleteTxId()');
    });
  });

  /*
   * "A row that can be restored must be listable, or say why not" used to be
   * enforced *here too*, by a `NO_GET_DELETED` map keyed by repository module
   * and detected on the exact names `restore` / `getDeleted`. The same
   * invariant, with a different detector, lived in `RESTORE_WITHOUT_LISTING`
   * (`features/trash/trashRegistry.ts`), keyed by module and detected on the
   * name *prefix* `getDeleted[A-Za-z]*`.
   *
   * Each was blind exactly where the other had an entry, and both were proved:
   * removing `attachmentRepository` from the trash list turned its own guard
   * red while every one of the 101 tests in this file stayed green, because
   * `restoreAttachmentsForTxId` is not exactly `restore`; removing
   * `partyRepository` from `NO_GET_DELETED` turned this file red while the
   * trash guard stayed green, because `getDeletedMembers` matches the prefix.
   *
   * The parallel list is deleted rather than corrected. The invariant is
   * enforced once, in `trashRegistry.test.ts`, from the repository layer's own
   * writes per Dexie table — see `test-utils/softDeleteCapabilities.ts`, which
   * also records why merging the two lists as they stood was not possible.
   */

  describe('rows are validated on the way out of the database', () => {
    /**
     * Every one of these entities has a Zod schema — they are all validated on
     * import, in `types/bundle.ts`. A row is therefore checked when it arrives
     * from a file and never when it comes off disk, which is the direction that
     * matters after a partial migration.
     */
    const UNVALIDATED_READS: Record<string, string> = {
      createRepository:
        'not a repository — it owns no entity and no schema. It reads only the four soft-delete '
        + 'columns, through `Table<SoftDeletableRow>`, so there is nothing entity-shaped to parse.',
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

/**
 * A Dexie write — the operations that can fail on a full disk.
 *
 * @remarks
 * The table is `db.notes` **or** `db.table(<expr>)`. The second form was
 * missing, and it is not exotic: it is this codebase's own idiom, it is what the
 * lifecycle factory writes through, and `hardDeleteReachability.test.ts` had
 * already been widened for exactly this — its `db.notes.delete` pattern could
 * not see `db.table('notes').delete`, because the `('notes')` call sits where
 * the pattern expects a `.`. The same hole was here, in the census that decides
 * whether a failed write reaches the caller.
 *
 * A binding is allowed between the accessor and the operation
 * (`const rows = db.table(...); await rows.update(...)`), since that is how the
 * factory reads: matching the two halves separately would be a pattern that
 * cannot see a wrapped chain.
 */
const WRITES_A_ROW = /\bdb\s*\.\s*(?:table\s*(?:<[^<>]*>\s*)?\([^()]*\)|[A-Za-z0-9_]+)[\s\S]{0,200}?\.\s*(?:add|put|update|bulkAdd|bulkPut|bulkUpdate|bulkDelete|delete|clear)\s*\(/;

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
