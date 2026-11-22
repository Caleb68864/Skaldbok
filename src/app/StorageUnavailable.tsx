import { useState } from 'react';
import { Button } from '../components/primitives/Button';
import { dumpRawDatabase } from '../storage/db/rawDump';
import { shareFile } from '../utils/export/delivery';

export interface StorageUnavailableProps {
  /** The error IndexedDB reported, shown verbatim so it can be searched. */
  error: string;
}

/**
 * Rendered instead of the app when IndexedDB refuses to open.
 *
 * @remarks
 * IndexedDB is the only place a campaign exists, so an app that cannot open it
 * has nothing to show and nothing safe to do. It used to render anyway: the
 * settings load swallowed the error, every screen came up on defaults, and
 * every save failed quietly. The common causes are listed because each has a
 * different fix and none of them is "keep tapping".
 */
export function StorageUnavailable({ error }: StorageUnavailableProps) {
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  // A failed upgrade leaves the data at its old version; Reload alone runs the
  // same upgrade again. This keeps a copy first. See `rawDump.ts`.
  async function saveRawCopy() {
    setSaving(true);
    setSaveResult(null);
    try {
      const dump = await dumpRawDatabase();
      const count = Object.values(dump.stores).reduce((n, rows) => n + rows.length, 0);
      const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
      const stamp = dump.exportedAt.slice(0, 10);
      const outcome = await shareFile(blob, `skaldbok-raw-copy-${stamp}.json`);
      setSaveResult(
        outcome === 'cancelled'
          ? 'Not saved — the share was cancelled.'
          : `Saved a raw copy of ${count} rows. Keep it before trying anything else.`,
      );
    } catch (e) {
      setSaveResult(`Could not read the database either — ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-text flex items-center justify-center p-[var(--space-md)]">
      <div role="alert" className="max-w-xl border border-border rounded-[var(--radius-md)] bg-surface p-[var(--space-md)]">
        <h1 className="text-[length:var(--font-size-xl)] font-bold mb-2">Storage is unavailable</h1>
        <p className="text-[var(--color-text-muted)] mb-[var(--space-sm)]">
          Skaldbok keeps everything on this device in the browser's database, and the browser would not open it.
          Nothing has been lost, but nothing can be saved until this is resolved.
        </p>
        <ul className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] list-disc pl-5 mb-[var(--space-md)] flex flex-col gap-1">
          <li>Private or incognito windows often block site data — open Skaldbok in a normal window.</li>
          <li>Another tab may have updated the app to a newer version — close the other tabs, then reload.</li>
          <li>Site data for this address may be blocked in the browser's settings.</li>
        </ul>
        <pre className="max-h-40 overflow-auto rounded-[var(--radius-sm)] bg-surface-alt p-[var(--space-sm)] text-xs text-danger">{error}</pre>
        <div className="mt-[var(--space-md)] flex gap-3">
          <Button variant="primary" onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="secondary" disabled={saving} onClick={() => void saveRawCopy()}>
            {saving ? 'Reading…' : 'Save a raw copy of my data'}
          </Button>
        </div>
        {saveResult && (
          <p role="status" className="mt-[var(--space-sm)] text-[length:var(--font-size-sm)]">{saveResult}</p>
        )}
        <p className="mt-[var(--space-sm)] text-[var(--color-text-muted)] text-[length:var(--font-size-xs)]">
          The raw copy is every row as the browser stores it, for safekeeping or support. It is not a
          campaign backup and cannot be imported as one.
        </p>
      </div>
    </div>
  );
}
