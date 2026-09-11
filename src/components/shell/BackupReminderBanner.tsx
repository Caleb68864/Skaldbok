import { useState } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useBackupReminderDays } from '../../hooks/useConfigurableDefaults';
import { classifyBackup, describeBackup } from '../../config/defaults/backup';

/**
 * Tells the user, anywhere in the app, that their only copy is getting old.
 *
 * @remarks
 * `H4`'s first half. The stale-backup warning existed, and it was mounted in
 * exactly one place: `StorageSafetyCard`, on the Settings screen. A player who
 * never opens Settings never saw it — and Settings is not where anyone spends
 * time. The information was correct and unreachable, which for a data-loss
 * warning is close to not having it.
 *
 * This is the shell, so it is on every route, above the outlet and below the
 * nav chrome. The Settings card stays: it carries storage persistence and the
 * usage figures, which are a different question and belong in a settings pane.
 * This carries the one sentence that has to reach someone who is not looking
 * for it.
 *
 * ## It deliberately does not export
 *
 * The obvious next step — a "Back up now" button — is the wrong one here, and
 * not for a small reason. `exportCampaign(id, includePrivate = false)` defaults
 * to *excluding private notes*, and it stamps `lastBackupAt` either way. A
 * one-tap export from a banner would therefore produce a partial copy and then
 * report the campaign as backed up, which is the exact shape the second scan
 * spent four findings on: an incomplete backup, marked successful, certified by
 * a check that cannot see what is missing. The privacy choice belongs where it
 * is made explicitly, in the campaign menu's export sheet, so the banner names
 * that route instead of taking a decision on the user's behalf.
 *
 * ## Dismissal lasts for the session, on purpose
 *
 * Nothing is persisted. A permanently dismissible warning about the only copy of
 * the user's data is a warning that can be switched off and then be wrong
 * forever — and a stale backup keeps getting staler. Dismissing clears it for
 * this run so it does not sit over the screen while someone is mid-session; it
 * returns next launch, which is the correct behaviour for a risk that has not
 * gone away. It also means no new settings field, and so nothing new to declare,
 * migrate or leave unread.
 */
export function BackupReminderBanner() {
  const { settings } = useAppState();
  const { activeCampaign } = useCampaignContext();
  const reminderDays = useBackupReminderDays();
  const [dismissed, setDismissed] = useState(false);

  // Nothing to lose and nothing to say: on a device with no campaign the export
  // that would reset this does not exist yet, and the empty-state prompts
  // already tell a new user what to do.
  if (!activeCampaign) return null;
  if (dismissed) return null;

  const backup = classifyBackup(settings.lastBackupAt, new Date(), reminderDays);
  if (backup.state === 'fresh') return null;

  const detail = backup.state === 'never'
    ? 'This campaign has never been exported from this device.'
    : `${describeBackup(backup)} — longer than ${reminderDays} days.`;

  return (
    <div
      role="status"
      className="flex items-start gap-[var(--space-sm)] border-b border-[var(--color-warning)] bg-[var(--color-surface-raised)] px-[var(--space-md)] py-[var(--space-sm)]"
    >
      <p className="m-0 flex-1 text-[length:var(--font-size-sm)] text-[var(--color-warning)]">
        {detail} A campaign export is the only copy that survives this device —
        make one from the menu, under Export Campaign.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss the backup reminder until next launch"
        className="min-h-11 min-w-11 shrink-0 cursor-pointer border-none bg-transparent text-[var(--color-warning)]"
      >
        ✕
      </button>
    </div>
  );
}
