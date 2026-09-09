/**
 * Generates a fresh UUID.
 *
 * @remarks
 * The single id source for the whole app — used both for entity primary keys and
 * for soft-delete transaction ids (see {@link utils/softDelete!generateSoftDeleteTxId | generateSoftDeleteTxId}). Relies on
 * the platform `crypto.randomUUID` where it exists. That function is gated to
 * secure contexts, and the documented tablet-testing flow (`npm run preview`
 * over plain `http://<lan-ip>:4173`) is not one — there `randomUUID` is
 * `undefined` and every entity creation threw a TypeError. `getRandomValues`
 * is not gated, so the fallback builds the same v4 UUID from it.
 */
export function generateId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
