import { db } from '../db/client';
import type { ReferenceNote } from '../db/client';
import { excludeDeleted, onlyDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';

/**
 * Every live reference note.
 *
 * @remarks
 * Reference content has since moved to user-owned reference sections and to
 * shared-scope notes; this repository serves the older `referenceNotes` table
 * that predates that move. The table is still written to — the Reference
 * screen's Notes tab creates rows here — so it follows the project-wide
 * soft-delete convention like any other user content.
 */
export async function getAll(): Promise<ReferenceNote[]> {
  return excludeDeleted(await db.referenceNotes.toArray());
}

/** Soft-deleted reference notes, newest deletion first. Backs the Trash listing. */
export async function getDeleted(): Promise<ReferenceNote[]> {
  return onlyDeleted(await db.referenceNotes.toArray());
}

/** Upserts a reference note, mapping a storage-quota failure to a user-friendly message. */
export async function save(note: ReferenceNote): Promise<void> {
  try {
    await db.referenceNotes.put(note);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save reference note: ${String(err)}`);
  }
}

/**
 * Soft-deletes a reference note (the user-facing delete). No-op if missing or
 * already deleted.
 *
 * @remarks
 * Re-deleting an already-deleted row would overwrite `softDeletedBy` with a
 * fresh transaction id, orphaning whatever cascade first took it down, so the
 * guard is load-bearing rather than an optimisation.
 */
export async function softDelete(id: string, txId?: string): Promise<void> {
  try {
    const row = await db.referenceNotes.get(id);
    if (!row) return;
    if (row.deletedAt) return;
    const now = nowISO();
    await db.referenceNotes.update(id, {
      deletedAt: now,
      softDeletedBy: txId ?? generateSoftDeleteTxId(),
      updatedAt: now,
    });
  } catch (err) {
    throw new Error(`Failed to delete reference note: ${String(err)}`);
  }
}

/** Restores a soft-deleted reference note. No-op if missing or not deleted. */
export async function restore(id: string): Promise<void> {
  try {
    const row = await db.referenceNotes.get(id);
    if (!row?.deletedAt) return;
    await db.referenceNotes.update(id, {
      deletedAt: undefined,
      softDeletedBy: undefined,
      updatedAt: nowISO(),
    });
  } catch (err) {
    throw new Error(`Failed to restore reference note: ${String(err)}`);
  }
}

/**
 * Permanently removes a reference note.
 *
 * @remarks
 * **Internal only** — purge jobs and data cleanup. User-facing deletes call
 * {@link softDelete}, which is restorable from the Trash. The `hardDelete` name
 * is the project-wide marker for an irreversible delete and is what makes this
 * greppable; this function used to be called `remove` and was wired straight to
 * a delete-confirmation dialog.
 */
export async function hardDelete(id: string): Promise<void> {
  try {
    await db.referenceNotes.delete(id);
  } catch (err) {
    throw new Error(`Failed to hard-delete reference note: ${String(err)}`);
  }
}
