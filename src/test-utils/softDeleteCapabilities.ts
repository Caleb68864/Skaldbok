import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What the repository layer can actually do to each table's tombstones, read
 * out of the code rather than out of a list.
 *
 * @remarks
 * The invariant is one sentence — *a row that can be soft-deleted and restored
 * must be listable, or say why not* — and it was recorded twice, by two tests
 * that did not know about each other and that detected it differently:
 *
 * | list | where | detection | blind to |
 * |---|---|---|---|
 * | `RESTORE_WITHOUT_LISTING` | `features/trash/trashRegistry.ts` | name **prefix** (`getDeleted[A-Za-z]*`) | `partyRepository` — `getDeletedMembers` is a listing for a *different entity* and satisfied it |
 * | `NO_GET_DELETED` | `storage/repositories/repositoryConventions.test.ts` | **exact** names `restore` / `getDeleted` | `attachmentRepository` — its methods are `softDeleteAttachmentsByNote` / `restoreAttachmentsForTxId` |
 *
 * Each list's blind spot was precisely the other list's entry, and both were
 * proved: removing `attachmentRepository` from the first turned its own guard
 * red while the second stayed 101/101 green, and removing `partyRepository`
 * from the second did the mirror image. Neither list was wrong on its own
 * terms. Two detectors with two blind spots is what made a single list
 * impossible.
 *
 * So the evidence is taken from outside both lists, the way
 * `softDeleteCoverage.test.ts` now checks its exemptions against the
 * repository layer's own writes. Two things change:
 *
 * - **Behaviour, not names.** A tombstone is a write of a `deletedAt`
 *   timestamp, a restore is a write clearing one, and a listing is a read that
 *   keeps rows *because* they are deleted. What the function is called does not
 *   enter into it, so `removePartyMember` and `referenceSectionRepository.remove`
 *   are as visible as anything named `softDelete`.
 * - **Per table, not per module.** `partyRepository` deletes and restores both
 *   `parties` and `partyMembers`, and lists only the second. At module
 *   granularity one listing covers the module; at table granularity the party
 *   row's missing listing is visible, which is the whole of finding §13.
 *
 * A listing idiom this cannot recognise is reported rather than skipped — see
 * {@link RepositoryTableCapabilities.unrecognisedListings}. A guard that
 * silently narrows its own domain when it meets something it cannot parse is
 * the failure mode every guard gap in this codebase has had.
 */

/** A write that sets `deletedAt` to a timestamp — a soft delete, whatever it is called. */
const TOMBSTONE_WRITE = /deletedAt:\s*(?!undefined\b|null\b)/;

/** A write that clears `deletedAt` — a restore, whatever it is called. */
const RESTORE_WRITE = /deletedAt:\s*(?:undefined|null)\b/;

/**
 * A read that keeps rows *because* they carry a tombstone.
 *
 * @remarks
 * Two idioms, both load-bearing: `onlyDeleted(...)` — the shared helper whose
 * own docstring calls itself "the shared body of every repository's
 * `getDeleted`" — and `.where('deletedAt').above('')`, the indexed form the
 * larger tables use so the Trash does not read every row in the table.
 */
const DELETED_LISTING = /\bonlyDeleted\s*\(|\.where\(\s*(['"])deletedAt\1\s*\)\s*\.above\s*\(/;

/**
 * `db.notes` / `db.table('notes')` — the tables a function touches.
 *
 * @remarks
 * The `<…>` is optional because `db.table<Note, string>('notes')` is the same
 * accessor with its type arguments written out, and a `<` where the pattern
 * wants a `(` fails the whole match. `hardDeleteReachability.test.ts` carries
 * the same widening, for the same reason and proven the same way.
 */
const TABLE_REFERENCE = /\bdb\.(?:table(?:<[^<>]*>)?\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)|([A-Za-z0-9_]+))/g;

/** Dexie members that are not tables. */
const NOT_A_TABLE = new Set(['transaction', 'tables', 'open', 'close', 'delete', 'on', 'version', 'name', 'isOpen']);

/**
 * The repository factory, read through rather than read.
 *
 * @remarks
 * `createRepository.ts` writes tombstones and clears them for *every* table
 * that adopts it, and names none of them — its table arrives as a parameter.
 * Scanned like a repository it contributes one phantom table called `table`
 * (from `db.table<T, string>(table)`, where the pattern above happily reads the
 * identifier as a table name) and nothing useful.
 *
 * Measured, not assumed: with the first five repositories moved onto the factory
 * and this file unchanged, `ships`, `ledgerEntries`, `ledgerSplits`,
 * `recurringBills` and `routePlans` lost every tombstone, restore and listing
 * attribution they had, and `tablesRestorableButUnlistable` fell from seven
 * tables to five. `trashRegistry.test.ts` then reported two live exemptions as
 * *stale* — it would have invited the next reader to delete a permission that
 * was still doing its job.
 *
 * So the factory module is skipped and its **call sites** are read instead: a
 * repository that calls `createSoftDeleteOps({ table: 'ships' })` tombstones and
 * restores `ships`, as plainly as if it had written the two updates itself.
 */
const FACTORY_MODULE = 'createRepository';

/**
 * What each factory grants the table it is handed.
 *
 * @remarks
 * `createHardDelete` is deliberately absent: a permanent delete is not a
 * tombstone, a restore or a listing, and `hardDeleteReachability.test.ts` is
 * what guards it.
 */
const FACTORY_GRANTS: Record<string, ReadonlyArray<'tombstone' | 'restore' | 'listing'>> = {
  createSoftDeleteOps: ['tombstone', 'restore'],
  createDeletedListing: ['listing'],
};

/**
 * Every factory call in a module, with the table it names.
 *
 * @remarks
 * A call whose `table:` cannot be read is returned with `table: null` rather
 * than dropped — see {@link SoftDeleteCapabilityReport.unreadableFactoryCalls}.
 * Skipping it would silently narrow this file's domain, which is the failure
 * mode every guard gap in this codebase has had.
 */
function factoryCalls(source: string): { factory: string; table: string | null }[] {
  const calls: { factory: string; table: string | null }[] = [];
  const opener = new RegExp(String.raw`\b(${Object.keys(FACTORY_GRANTS).join('|')})\s*(?:<[^<>]*>\s*)?\(`, 'g');
  for (const match of source.matchAll(opener)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let args = '';
    for (let i = open; i < source.length; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') {
        depth--;
        if (depth === 0) {
          args = source.slice(open + 1, i);
          break;
        }
      }
    }
    const table = /\btable\s*:\s*['"]([A-Za-z0-9_]+)['"]/.exec(args);
    calls.push({ factory: match[1]!, table: table ? table[1]! : null });
  }
  return calls;
}

/** What the repository layer can do to one table's soft-deleted rows. */
export interface RepositoryTableCapabilities {
  /** Dexie table name. */
  table: string;
  /** `<module>.<function>` of every site that writes a tombstone onto it. */
  tombstonedBy: string[];
  /** `<module>.<function>` of every site that clears one. */
  restoredBy: string[];
  /** `<module>.<function>` of every site that lists its tombstoned rows. */
  listedBy: string[];
}

/** Result of reading the repository layer. */
export interface SoftDeleteCapabilityReport {
  /** One entry per table the repository layer tombstones, restores or lists. */
  tables: RepositoryTableCapabilities[];
  /**
   * `<module>.<function>` for every exported `getDeleted*` whose body this
   * could not recognise as a deleted-row listing.
   *
   * @remarks
   * A cross-check between two independent signals — the name says "listing",
   * the body has to agree. It exists so a *third* listing idiom appearing in
   * the codebase fails loudly here instead of quietly making a table look
   * unlistable, which would send the next reader to add an exemption for a
   * listing that already exists.
   */
  unrecognisedListings: string[];
  /**
   * `<module>.<factory>` for every repository-factory call whose `table:` this
   * could not read.
   *
   * @remarks
   * The same cross-check as {@link unrecognisedListings}, one level up. A
   * factory call is a tombstone-and-restore for whichever table it names; if the
   * name is spelled some way this cannot parse — a constant, a computed key —
   * the table silently looks untouched by the repository layer, and a live
   * exemption starts reading as stale. Reported so that fails loudly instead.
   */
  unreadableFactoryCalls: string[];
}

/** Strips line comments so prose about `deletedAt` is not read as code. */
function withoutComments(block: string): string {
  return block
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join('\n');
}

/**
 * Reads the repository layer and reports, per table, what it can do to
 * tombstoned rows.
 *
 * @param repoDir - The repository directory to read.
 * @returns Capabilities per table, plus any listing the classifier could not read.
 */
export function readSoftDeleteCapabilities(repoDir: string): SoftDeleteCapabilityReport {
  const tombstonedBy = new Map<string, Set<string>>();
  const restoredBy = new Map<string, Set<string>>();
  const listedBy = new Map<string, Set<string>>();
  const unrecognisedListings: string[] = [];
  const unreadableFactoryCalls: string[] = [];

  const note = (map: Map<string, Set<string>>, table: string, site: string): void => {
    const sites = map.get(table) ?? new Set<string>();
    sites.add(site);
    map.set(table, sites);
  };

  const files = readdirSync(repoDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort();

  for (const file of files) {
    const source = readFileSync(join(repoDir, file), 'utf8');
    const module = file.replace(/\.ts$/, '');
    if (module === FACTORY_MODULE) continue;

    // A repository that adopts the factory delegates its tombstone and its
    // restore to it, so the writes are attributed here, to the module that
    // named the table.
    for (const call of factoryCalls(withoutComments(source))) {
      const site = `${module}.${call.factory}`;
      if (call.table === null) {
        unreadableFactoryCalls.push(site);
        continue;
      }
      for (const grant of FACTORY_GRANTS[call.factory]!) {
        if (grant === 'tombstone') note(tombstonedBy, call.table, site);
        if (grant === 'restore') note(restoredBy, call.table, site);
        if (grant === 'listing') note(listedBy, call.table, site);
      }
    }

    // One block per top-level function, so a `deletedAt` write is attributed to
    // the tables that function touches rather than to every table the file
    // mentions. This is what separates `parties` from `partyMembers`.
    for (const block of source.split(/\n(?=(?:export\s+)?(?:async\s+)?function\s)/)) {
      const declared = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(block);
      const site = `${module}.${declared ? declared[1] : '<module>'}`;
      const body = withoutComments(block);

      const tables = new Set<string>();
      for (const match of body.matchAll(TABLE_REFERENCE)) {
        const table = match[1] ?? match[2]!;
        if (!NOT_A_TABLE.has(table)) tables.add(table);
      }

      const lists = DELETED_LISTING.test(body);
      if (declared && /^getDeleted/.test(declared[1]!) && /\bexport\b/.test(block) && !lists) {
        unrecognisedListings.push(site);
      }
      if (tables.size === 0) continue;

      for (const line of body.split('\n')) {
        if (RESTORE_WRITE.test(line)) {
          for (const table of tables) note(restoredBy, table, site);
        } else if (/deletedAt/.test(line) && TOMBSTONE_WRITE.test(line)) {
          for (const table of tables) note(tombstonedBy, table, site);
        }
      }
      if (lists) for (const table of tables) note(listedBy, table, site);
    }
  }

  const allTables = new Set([...tombstonedBy.keys(), ...restoredBy.keys(), ...listedBy.keys()]);
  const tables = [...allTables].sort().map((table) => ({
    table,
    tombstonedBy: [...(tombstonedBy.get(table) ?? [])].sort(),
    restoredBy: [...(restoredBy.get(table) ?? [])].sort(),
    listedBy: [...(listedBy.get(table) ?? [])].sort(),
  }));

  return { tables, unrecognisedListings, unreadableFactoryCalls };
}

/**
 * Tables the repository layer can tombstone and restore but cannot list.
 *
 * @param report - The result of {@link readSoftDeleteCapabilities}.
 * @returns Table names, sorted.
 */
export function tablesRestorableButUnlistable(report: SoftDeleteCapabilityReport): string[] {
  return report.tables
    .filter((t) => t.tombstonedBy.length > 0 && t.restoredBy.length > 0 && t.listedBy.length === 0)
    .map((t) => t.table);
}
