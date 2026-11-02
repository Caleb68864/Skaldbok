import { useState } from 'react';
import { Card } from '../../components/primitives/Card';
import { Button } from '../../components/primitives/Button';
import { useToast } from '../../context/ToastContext';
import { databaseSchemaVersion } from '../../storage/persistence';
import { buildDiagnosticsReport } from '../../utils/diagnostics';

/** Settings card that copies recent errors and app details for a bug report. */
export function DiagnosticsCard() {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function copy() {
    setBusy(true);
    try {
      const report = await buildDiagnosticsReport({
        appVersion: __APP_VERSION__,
        schemaVersion: databaseSchemaVersion(),
        estimateStorage: () => navigator.storage.estimate(),
      });
      await navigator.clipboard.writeText(report);
      showToast('Diagnostics copied', 'success');
    } catch (e) {
      console.error('DiagnosticsCard: copy failed', e);
      showToast('Could not copy to the clipboard', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-[length:var(--font-size-lg)] text-[var(--color-text)] mb-[var(--space-sm)]">Diagnostics</h2>
      <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-sm)]">
        Copy recent errors, the app version and storage use, to paste into a bug report. Nothing is sent anywhere.
      </p>
      <Button variant="secondary" disabled={busy} onClick={() => { void copy(); }}>Copy diagnostics</Button>
    </Card>
  );
}
