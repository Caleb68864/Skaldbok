import { useRef, useState } from 'react';
import { Button } from '../../components/primitives/Button';
import { parseRouteImport } from '../../utils/route/parseRouteImport';
import type { ParsedRouteStop } from '../../utils/route/parseRouteImport';
import type { RouteFieldSpec } from '../../utils/export/renderRoute';

/** Props for {@link RouteImportModal}. */
export interface RouteImportModalProps {
  /** The active ruleset's declared route fields — what the file is matched against. */
  fields: RouteFieldSpec[];
  /** How many stops the route already has, so the choice of action is concrete. */
  existingCount: number;
  onCancel: () => void;
  onImport: (stops: ParsedRouteStop[], replace: boolean) => Promise<void>;
}

const textareaClass =
  'w-full min-h-[160px] p-2 font-mono text-xs border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

/**
 * Imports a route from JSON — typically one planned in a chat and handed over
 * as a file, or pasted straight in.
 *
 * @remarks
 * Paste is offered alongside the file picker because that is how the route
 * usually arrives: as text in a conversation, not as a file somebody has already
 * saved. Making them save it first would add a step for no reason.
 *
 * Nothing is written until the parse has been shown. The preview lists what will
 * be created and, more importantly, what was **ignored** — a field the ruleset
 * does not declare is dropped, and finding that out after the import rather than
 * before is how a route ends up quietly missing half its data.
 */
export function RouteImportModal({
  fields,
  existingCount,
  onCancel,
  onImport,
}: RouteImportModalProps) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedRouteStop[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleText(next: string) {
    setText(next);
    setError(null);
    setParsed(null);
    setWarnings([]);
    if (next.trim() === '') return;
    const result = parseRouteImport(next, fields);
    if (result.ok) {
      setParsed(result.stops);
      setWarnings(result.warnings);
    } else {
      setError(result.error);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    handleText(await file.text());
  }

  async function commit(replace: boolean) {
    if (!parsed) return;
    setIsSaving(true);
    try {
      await onImport(parsed, replace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that route.');
      setIsSaving(false);
    }
  }

  const nameField = fields.find(f => f.id === 'name');
  const columnFields = fields.filter(f => f.id !== 'name');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-[var(--space-md)]"
      role="dialog"
      aria-modal="true"
      aria-label="Import route"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-md)] flex flex-col gap-[var(--space-sm)]">
        <h2 className="text-lg font-semibold">Import a route</h2>

        <p className="text-[var(--color-text-muted)] text-sm">
          Paste JSON below, or choose a file. A list of stops is enough — an array,
          or an object with a <code>stops</code> array. Recognised fields for this
          ruleset: {fields.map(f => f.label).join(', ')}.
        </p>

        <div className="flex gap-[var(--space-sm)] flex-wrap">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Choose a file…
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
          placeholder={'[\n  { "name": "Regina", "uwp": "A788899-C", "hex": "1910", "jump": 0 }\n]'}
          onChange={e => handleText(e.target.value)}
          aria-label="Route JSON"
        />

        {error && <p style={{ color: 'var(--color-danger, #b3261e)' }}>{error}</p>}

        {warnings.length > 0 && (
          <div style={{ color: 'var(--color-warning, #8a6d00)' }} className="text-sm">
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}

        {parsed && (
          <div className="border border-[var(--color-border)] rounded-[var(--radius-sm)] overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)]">
                  <th className="py-1 px-2">#</th>
                  <th className="py-1 px-2">{nameField?.label ?? 'Name'}</th>
                  {columnFields.map(f => (
                    <th key={f.id} className="py-1 px-2">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.map((stop, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="py-1 px-2 text-[var(--color-text-muted)]">{i + 1}</td>
                    <td className="py-1 px-2">{stop.name}</td>
                    {columnFields.map(f => (
                      <td key={f.id} className="py-1 px-2">
                        {stop.values[f.id] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-[var(--space-sm)] justify-end flex-wrap">
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          {existingCount > 0 && (
            <Button variant="secondary" onClick={() => void commit(false)} disabled={!parsed || isSaving}>
              Add to the end
            </Button>
          )}
          <Button onClick={() => void commit(true)} disabled={!parsed || isSaving}>
            {existingCount > 0
              ? `Replace all ${existingCount}`
              : parsed
                ? `Import ${parsed.length} stop${parsed.length === 1 ? '' : 's'}`
                : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}
