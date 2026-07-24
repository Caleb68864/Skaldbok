/**
 * Generates a fresh UUID.
 *
 * @remarks
 * The single id source for the whole app — used both for entity primary keys and
 * for soft-delete transaction ids (see {@link generateSoftDeleteTxId}). Relies on
 * the platform `crypto.randomUUID`, which is available in every browser the PWA
 * targets, so there is no dependency on a uuid library.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
