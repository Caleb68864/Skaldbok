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

/** `db.notes` / `db.table('notes')` — the tables a function touches. */
const TABLE_REFERENCE = /\bdb\.(?:table\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)|([A-Za-z0-9_]+))/g;

/** Dexie members that are not tables. */
const NOT_A_TABLE = new Set(['transaction', 'tables', 'open', 'close', 'delete', 'on', 'version', 'name', 'isOpen']);

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

  return { tables, unrecognisedListings };
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
