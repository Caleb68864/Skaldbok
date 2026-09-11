import type { Table } from 'dexie';
import { db, type SkaldbokDatabase } from '../db/client';
import { nowISO } from '../../utils/dates';
import { generateSoftDeleteTxId, onlyDeleted } from '../../utils/softDelete';

/**
 * The soft-delete lifecycle, written once.
 *
 * @remarks
 * Twenty-four repositories hand-wrote the same four operations and diverged in
 * six measured ways — `repositoryConventions.test.ts` names them, one exception
 * list per divergence, each list self-checking so it cannot rot. This file is
 * the other half of that test: the test says what the convention is, and this
 * says it once so a new repository cannot re-decide it.
 *
 * The sequencing was deliberate and is worth keeping recorded. The convention
 * test was written **first**, ahead of any factory, because a factory written
 * first hardens whatever shape happens to exist — and this is the layer where a
 * mistake is unrecoverable: the app is local-first and the user's data exists in
 * exactly one browser. What is built here is built to what the test states, not
 * to what the files happened to do.
 *
 * ## What it covers, and what it deliberately does not
 *
 * It covers the **no-cascade** lifecycle: tombstone a row, clear the tombstone,
 * list a scope's tombstones, remove a row for good. Five repositories had
 * exactly that and three of them were wrong in three different ways.
 *
 * It does **not** cover cascades. `creatureTemplateRepository`, `noteRepository`
 * and `sessionRepository` take down entity links in the same transaction and
 * bring them back by `softDeletedBy`; folding that in would mean a hook that
 * four repositories pass and eleven leave empty. A capability declared for
 * callers that do not exist is the exact failure this codebase's own
 * `declaredCapabilities.test.ts` was written to catch, so a repository with a
 * cascade keeps its hand-written `softDelete` and stays covered by the test.
 *
 * ## Why the table arrives as a name and is re-read on every call
 *
 * `db.table(<name>)` rather than a `() => db.ships` accessor, and spelled out
 * inside each operation rather than lifted into a shared local. Both look like
 * things a tidy-up would remove, and both are load-bearing:
 *
 * - `hardDeleteReachability.test.ts` recognises a permanent delete by the
 *   *operation* reaching a table reference, and it already understands
 *   `db.table(<expr>)` — that is this codebase's own idiom, and teaching it that
 *   form was itself one of the second scan's findings. Hand the factory an
 *   opaque `() => Table` and {@link createHardDelete}'s body no longer mentions
 *   `db` at all, so the one guard standing between the user's data and an
 *   unnamed permanent delete stops seeing this file.
 * - Lifting `db.table(...)` into a module-level constant would move it out of
 *   the function body that the same guard slices and attributes.
 *
 * The name is typed as {@link SoftDeletableTableName}, so a table that does not
 * exist — or one with no `deletedAt` column — is a compile error rather than a
 * runtime `SchemaError` on the restore path, which is the least-exercised path
 * in the app.
 *
 * **One consequence, measured rather than assumed:** Dexie returns a *different
 * object* for the two accessors. `db.ships === db.table('ships')` is `false`;
 * `db.table('ships') === db.table('ships')` is `true`. They address the same
 * object store, so nothing about the data differs and transaction scoping — which
 * Dexie resolves by table *name* — is unaffected. What it changes is
 * instrumentation: a test spying `db.ships.update` will not see a write made
 * here, and will pass having tested nothing. `createRepository.test.ts` spies
 * `db.table('ships')` for exactly this reason, and says so at the call.
 */

/** The columns the soft-delete convention requires of every domain row. */
export interface SoftDeletableRow {
  id: string;
  updatedAt: string;
  deletedAt?: string;
  softDeletedBy?: string;
}

/**
 * A Dexie table name whose rows carry the soft-delete columns.
 *
 * @remarks
 * Derived from the database class, so it cannot drift from the schema: a table
 * added without `deletedAt` is simply not nameable here.
 */
export type SoftDeletableTableName = {
  [K in keyof SkaldbokDatabase]: SkaldbokDatabase[K] extends Table<infer R, string>
    ? R extends SoftDeletableRow
      ? K
      : never
    : never;
}[keyof SkaldbokDatabase];

/** What a repository tells the factory about itself. */
export interface SoftDeleteOpsConfig {
  /**
   * The repository module's own name, e.g. `'shipRepository'`.
   *
   * @remarks
   * Only ever used to build the error message. A thrown
   * `"ships.softDelete failed"` would name the table and leave the reader
   * grepping for which of several modules writes it.
   */
  repository: string;
  /** The Dexie table these rows live in. */
  table: SoftDeletableTableName;
}

/** The three writes every soft-deletable entity needs. */
export interface SoftDeleteOps {
  /**
   * Tombstones a row, or does nothing if it is absent or already tombstoned.
   *
   * @param id - Row to delete.
   * @param txId - Transaction id to join, when this delete is part of a parent's
   *   cascade. Omitted, one is minted for this row alone.
   */
  softDelete(id: string, txId?: string): Promise<void>;
  /** Clears a row's tombstone, or does nothing if it is absent or already live. */
  restore(id: string): Promise<void>;
}

/**
 * Builds a repository's `softDelete` and `restore` to the convention.
 *
 * @remarks
 * Every clause below is one of `repositoryConventions.test.ts`'s exception
 * lists, closed by construction:
 *
 * - **`txId` is a parameter.** A `softDelete` that cannot be handed a
 *   transaction id can never be enlisted in a parent's cascade: whatever it
 *   deletes gets an id of its own, so restoring the parent leaves it behind.
 *   `shipRepository.softDelete` took only `(id)` and a ship could not go down
 *   with its campaign or come back with it.
 * - **A re-delete is refused.** Deleting an already-deleted row overwrites
 *   `softDeletedBy` with a fresh id and orphans the first cascade — `restore`
 *   then returns the row and not its children. Five repositories skipped this.
 * - **The id comes from `generateSoftDeleteTxId`.** It is a thin alias over
 *   `generateId` and exists so every cascade site is findable with one grep;
 *   seven repositories used the raw generator and were invisible to it.
 * - **`updatedAt` is stamped.** A tombstone is a change to the row. Leaving the
 *   timestamp alone makes a deleted row lose to its own pre-delete copy when two
 *   devices' bundles merge, which restores the thing the user deleted.
 * - **A failed write reaches the caller.** Local-first: a write that does not
 *   land has no server copy and no later retry, so it either succeeds or throws.
 *
 * @param config - Which repository this is and which table it owns.
 * @returns The two lifecycle writes, ready to re-export.
 */
export function createSoftDeleteOps(config: SoftDeleteOpsConfig): SoftDeleteOps {
  const { repository, table } = config;

  return {
    async softDelete(id: string, txId?: string): Promise<void> {
      try {
        const rows = db.table<SoftDeletableRow, string>(table);
        const row = await rows.get(id);
        if (!row) return;
        if (row.deletedAt) return;
        const now = nowISO();
        await rows.update(id, {
          deletedAt: now,
          softDeletedBy: txId ?? generateSoftDeleteTxId(),
          updatedAt: now,
        });
      } catch (e) {
        throw new Error(`${repository}.softDelete failed: ${e}`, { cause: e });
      }
    },

    async restore(id: string): Promise<void> {
      try {
        const rows = db.table<SoftDeletableRow, string>(table);
        const row = await rows.get(id);
        if (!row) return;
        if (!row.deletedAt) return;
        await rows.update(id, {
          deletedAt: undefined,
          softDeletedBy: undefined,
          updatedAt: nowISO(),
        });
      } catch (e) {
        throw new Error(`${repository}.restore failed: ${e}`, { cause: e });
      }
    },
  };
}

/** What a scoped tombstone listing needs to know. */
export interface DeletedListingConfig extends SoftDeleteOpsConfig {
  /**
   * The index the listing is scoped by — `'campaignId'` everywhere so far.
   *
   * @remarks
   * There is no unscoped variant on purpose. `creatureTemplateRepository`'s
   * listing was once database-wide, so a creature deleted while running one
   * game appeared in another game's Trash, and restoring it there put it back
   * in the campaign the GM was not looking at.
   */
  scopeIndex: string;
}

/**
 * Builds a repository's `getDeleted` to the convention.
 *
 * @remarks
 * Opt-in rather than part of {@link createSoftDeleteOps}, because a listing is
 * not free: `trashRegistry.test.ts` requires every table the layer can list to
 * be registered in the Trash, and two of these tables are cascade children a
 * user restores through their parent. Handing every repository a `getDeleted`
 * would put rows on a screen that has no way to restore them sensibly.
 *
 * @param config - Repository, table and the index to scope the listing by.
 * @returns A listing of that scope's tombstoned rows, newest deletion first.
 */
export function createDeletedListing<T extends SoftDeletableRow>(
  config: DeletedListingConfig,
): (scope: string) => Promise<T[]> {
  const { repository, table, scopeIndex } = config;

  return async function getDeleted(scope: string): Promise<T[]> {
    try {
      const rows = await db.table<T, string>(table).where(scopeIndex).equals(scope).toArray();
      return onlyDeleted(rows);
    } catch (e) {
      throw new Error(`${repository}.getDeleted failed: ${e}`, { cause: e });
    }
  };
}

/**
 * Builds a repository's permanent delete.
 *
 * @remarks
 * Named `createHardDelete`, and declared in `hardDeleteReachability.test.ts`'s
 * `DOMAIN_HARD_DELETES`, so calling it from outside `src/storage` fails the
 * suite exactly as calling a `hardDelete` does. That is the whole reason this is
 * a separate export rather than a third member of {@link SoftDeleteOps}: the
 * guard attributes an operation to the function it is written in, so folding the
 * `.delete(` into `createSoftDeleteOps` would make *that* name the sanctioned
 * permanent delete and every repository's lifecycle would inherit the
 * permission.
 *
 * @param config - Which repository this is and which table it owns.
 * @returns A permanent single-row delete. Internal to the storage layer.
 */
export function createHardDelete(config: SoftDeleteOpsConfig): (id: string) => Promise<void> {
  const { repository, table } = config;

  return async function hardDelete(id: string): Promise<void> {
    try {
      await db.table<SoftDeletableRow, string>(table).delete(id);
    } catch (e) {
      throw new Error(`${repository}.hardDelete failed: ${e}`, { cause: e });
    }
  };
}
