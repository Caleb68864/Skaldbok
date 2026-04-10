import { generateId } from './ids';

export function excludeDeleted<T extends { deletedAt?: string }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deletedAt);
}

export function generateSoftDeleteTxId(): string {
  return generateId();
}
