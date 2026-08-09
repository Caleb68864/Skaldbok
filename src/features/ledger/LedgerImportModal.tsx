import { useRef, useState } from 'react';
import { Button } from '../../components/primitives/Button';
import { parseLedgerImport } from '../../utils/ledger/parseLedgerImport';
import type { ParsedLedgerAccount, ParsedLedgerEntry } from '../../utils/ledger/parseLedgerImport';

/** Props for {@link LedgerImportModal}. */
export interface LedgerImportModalProps {
  formatMoney: (baseUnits: number) => string;
  onCancel: () => void;
  onImport: (parsed: {
    accounts: ParsedLedgerAccount[];
    entries: ParsedLedgerEntry[];
  }) => Promise<void>;
}

const textareaClass =
  'w-full min-h-[160px] p-2 font-mono text-xs border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

const EXAMPLE = `{
  "accounts": [
    { "name": "Cash", "kind": "asset", "opening": 0 },
    { "name": "Ship Loan", "kind": "debt", "opening": "Cr40,000,000" }
  ],
  "entries": [
    { "date": "2026-08-08", "description": "Monthly mortgage",
      "out": "Cr201,335", "account": "Cash", "counterAccount": "Ship Loan" }
  ]
}`;

/**
 * Imports a campaign's opening position and early transactions from JSON.
 *
 * @remarks
 * Built for lifting figures out of session notes rather than retyping them —
 * the ship's mortgage, what the crew started with, the first month's spending.
 *
 * The preview shows the **signed** amount for every entry, because that is the
 * thing most likely to be wrong and least likely to be noticed. An expense read
 * as income leaves a balance wrong by twice the figure and entirely plausible.
 */
export function LedgerImportModal({ formatMoney, onCancel, onImport }: LedgerImportModalProps) {
  const [text, setText] = useState('');
  const [accounts, setAccounts] = useState<ParsedLedgerAccount[]>([]);
  const [entries, setEntries] = useState<ParsedLedgerEntry[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleText(next: string) {
    setText(next);
    setError(null);
    setParsed(false);
    setAccounts([]);
    setEntries([]);
    setWarnings([]);
    if (next.trim() === '') return;

    const result = parseLedgerImport(next);
    if (result.ok) {
      setAccounts(result.accounts);
      setEntries(result.entries);
      setWarnings(result.warnings);
      setParsed(true);
    } else {
      setError(result.error);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    handleText(await file.text());
  }

  async function commit() {
    if (!parsed) return;
    setIsSaving(true);
    try {
      await onImport({ accounts, entries });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that ledger.');
      setIsSaving(false);
    }
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-[var(--space-md)]"
      role="dialog"
      aria-modal="true"
      aria-label="Import ledger"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-md)] flex flex-col gap-[var(--space-sm)]">
        <h2 className="text-lg font-semibold">Import into the ledger</h2>

        <p className="text-[var(--color-text-muted)] text-sm">
          Paste JSON or choose a file. Accounts, entries, or both. Amounts can be
          negative, marked <code>direction</code>, or split into <code>in</code> and{' '}
          <code>out</code>. A debt&apos;s opening balance may be written as a positive
          figure — it will be recorded as owed.
        </p>

        <div className="flex gap-[var(--space-sm)] flex-wrap">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Choose a file…
          </Button>
          <Button variant="secondary" onClick={() => handleText(EXAMPLE)}>
            Use the example
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,text/plain"
            className="hidden"
            onChange={e => void handleFile(e.target.files?.[0])}
          />
        </div>

        <textarea
          className={textareaClass}
          value={text}
          spellCheck={false}
          placeholder={EXAMPLE}
          aria-label="Ledger JSON"
          onChange={e => handleText(e.target.value)}
        />

        {error && <p style={{ color: 'var(--color-danger, #b3261e)' }}>{error}</p>}

        {warnings.length > 0 && (
          <div style={{ color: 'var(--color-warning, #8a6d00)' }} className="text-sm">
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}

        {parsed && accounts.length > 0 && (
          <div>
            <h3 className="font-semibold mb-1">
              {accounts.length} account{accounts.length === 1 ? '' : 's'}
            </h3>
            <ul className="text-sm">
              {accounts.map((a, i) => (
                <li key={i} className="flex justify-between gap-2 py-0.5">
                  <span>
                    {a.name}
                    <span className="text-[var(--color-text-muted)]">
                      {' '}· {a.kind === 'liability' ? 'money we owe' : 'money we have'}
                    </span>
                  </span>
                  {a.opening !== undefined && (
                    <span className="tabular-nums">
                      {a.kind === 'liability'
                        ? `${formatMoney(Math.abs(a.opening))} owed`
                        : formatMoney(a.opening)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {parsed && entries.length > 0 && (
          <div>
            <h3 className="font-semibold mb-1">
              {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-text-muted)]">
                    <th className="py-1 px-2">Date</th>
                    <th className="py-1 px-2">Description</th>
                    <th className="py-1 px-2">Account</th>
                    <th className="py-1 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="py-1 px-2 whitespace-nowrap">{e.date || '—'}</td>
                      <td className="py-1 px-2">{e.memo || '—'}</td>
                      <td className="py-1 px-2 text-[var(--color-text-muted)]">
                        {e.accountName ?? 'default'}
                        {e.counterAccountName && ` → ${e.counterAccountName}`}
                      </td>
                      <td
                        className="py-1 px-2 text-right tabular-nums whitespace-nowrap"
                        style={{
                          color:
                            e.amount < 0 ? 'var(--color-danger, #b3261e)' : 'var(--color-text)',
                        }}
                      >
                        {formatMoney(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Net movement {formatMoney(total)}
            </p>
          </div>
        )}

        <div className="flex gap-[var(--space-sm)] justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void commit()} disabled={!parsed || isSaving}>
            {isSaving ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}
