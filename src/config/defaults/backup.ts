/**
 * How long a campaign may go un-exported before the app says something.
 *
 * @remarks
 * Skaldbok has no server. A campaign export IS the backup — the only copy of a
 * campaign that survives the browser losing its storage. Nothing else in the app
 * creates redundancy, so the reminder threshold is a real safety setting rather
 * than a nag preference.
 *
 * Configurable per the Configuration Over Hardcoding rule: read it through
 * `useBackupReminderDays()`, never by importing this constant into a component.
 */
export const DEFAULT_BACKUP_REMINDER_DAYS = 30;

/** How a campaign's backup currently stands. */
export type BackupStatus =
  /** No campaign export has ever completed on this device. */
  | { state: 'never' }
  /** Exported within the reminder window. */
  | { state: 'fresh'; daysAgo: number }
  /** Exported, but longer ago than the reminder window. */
  | { state: 'stale'; daysAgo: number };

/**
 * Classifies backup freshness.
 *
 * @remarks
 * Pure and separately tested — this decides whether the user is told their only
 * copy is at risk, and getting it wrong in either direction is bad: a false
 * "fresh" is silent risk, a false "stale" trains the user to ignore the warning.
 *
 * An unparseable or future-dated timestamp is treated as `never` rather than
 * trusted. A clock that has moved backwards must not be able to report a
 * campaign as freshly backed up when it is not.
 *
 * @param lastBackupAt - ISO timestamp of the last completed campaign export.
 * @param now - Current time, injected so this stays deterministic.
 * @param reminderDays - Age at which a backup is considered stale.
 */
export function classifyBackup(
  lastBackupAt: string | undefined | null,
  now: Date,
  reminderDays: number = DEFAULT_BACKUP_REMINDER_DAYS,
): BackupStatus {
  if (!lastBackupAt) return { state: 'never' };
  const then = new Date(lastBackupAt).getTime();
  if (!Number.isFinite(then)) return { state: 'never' };

  const elapsedMs = now.getTime() - then;
  if (elapsedMs < 0) return { state: 'never' };

  const daysAgo = Math.floor(elapsedMs / 86_400_000);
  return daysAgo >= reminderDays ? { state: 'stale', daysAgo } : { state: 'fresh', daysAgo };
}

/** Human-readable summary of a {@link BackupStatus}. */
export function describeBackup(status: BackupStatus): string {
  if (status.state === 'never') return 'Never backed up';
  if (status.daysAgo === 0) return 'Backed up today';
  if (status.daysAgo === 1) return 'Backed up yesterday';
  return `Backed up ${status.daysAgo} days ago`;
}
