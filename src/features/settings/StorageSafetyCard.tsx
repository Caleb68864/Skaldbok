import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/primitives/Card';
import { Button } from '../../components/primitives/Button';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { useBackupReminderDays } from '../../hooks/useConfigurableDefaults';
import { classifyBackup, describeBackup } from '../../config/defaults/backup';
import {
  ensurePersistentStorage,
  formatBytes,
  readStorageEstimate,
  readStoragePersistence,
  type StorageEstimate,
  type StoragePersistence,
} from '../../storage/persistence';

/**
 * Data-safety readout: whether the browser may evict this app's storage, how
 * much it occupies, and how long since the campaign was last exported.
 *
 * @remarks
 * Skaldbok has no server, so these two facts together are the entire story of
 * whether a campaign survives. Neither was visible anywhere before: persistence
 * was never requested at all, and nothing recorded when the last export
 * happened. A local-first app that cannot answer "is my data safe?" is asking
 * the user to take it on faith.
 */
export function StorageSafetyCard() {
  const { settings } = useAppState();
  const { showToast } = useToast();
  const reminderDays = useBackupReminderDays();
  const [persistence, setPersistence] = useState<StoragePersistence | null>(null);
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([readStoragePersistence(), readStorageEstimate()]).then(([p, e]) => {
      if (!mounted) return;
      setPersistence(p);
      setEstimate(e);
    });
    return () => { mounted = false; };
  }, []);

  const requestPersistence = useCallback(async () => {
    const result = await ensurePersistentStorage();
    setPersistence(result);
    showToast(
      result.persisted
        ? 'Storage is now protected from automatic cleanup'
        : 'The browser declined for now — it may grant this later as you use the app',
      result.persisted ? 'success' : 'warning',
      6000,
    );
  }, [showToast]);

  const backup = classifyBackup(settings.lastBackupAt, new Date(), reminderDays);
  const backupAtRisk = backup.state !== 'fresh';

  return (
    <Card>
      <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-md)]">
        Data Safety
      </h2>

      <div className="mb-[var(--space-md)]">
        <p className="m-0 text-[length:var(--font-size-sm)] text-[var(--color-text)]">
          {persistence === null
            ? 'Checking storage…'
            : !persistence.supported
              ? 'This browser cannot report storage protection.'
              : persistence.persisted
                ? 'Storage is protected from automatic cleanup.'
                : 'Storage is not protected — the browser may clear it if the device runs low on space.'}
        </p>
        {estimate && (
          <p className="m-0 mt-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Using {formatBytes(estimate.usage)} of about {formatBytes(estimate.quota)} available.
          </p>
        )}
        {persistence?.supported && !persistence.persisted && (
          <div className="mt-[var(--space-sm)]">
            <Button variant="secondary" onClick={() => void requestPersistence()}>
              Protect my data
            </Button>
          </div>
        )}
      </div>

      <div>
        <p
          className={`m-0 text-[length:var(--font-size-sm)] ${
            backupAtRisk ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'
          }`}
        >
          {describeBackup(backup)}
          {backup.state === 'stale' && ` — longer than ${reminderDays} days.`}
        </p>
        <p className="m-0 mt-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
          {/* Said plainly on purpose: there is no cloud copy, and a user who
              assumes there is one will not export until it is too late. */}
          Exporting a campaign is the only copy that survives this device. Export from the
          campaign menu.
        </p>
      </div>
    </Card>
  );
}
