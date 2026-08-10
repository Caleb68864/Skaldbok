import { useRef, useState } from 'react';
import { Button } from '../../components/primitives/Button';
import { parseCreatureImport } from '../../utils/bestiary/parseCreatureImport';
import type { ParsedCreature } from '../../utils/bestiary/parseCreatureImport';
import type { CreatureStatField } from '../../types/system';
import { statAbbr } from './creatureStats';
import { useOverlayDismiss } from '../../components/primitives/useOverlayDismiss';

/** Props for {@link CreatureImportModal}. */
export interface CreatureImportModalProps {
  /** The active ruleset's declared creature stats — what the file is matched against. */
  statFields: CreatureStatField[];
  onCancel: () => void;
  onImport: (creatures: ParsedCreature[]) => Promise<void>;
}

const textareaClass =
  'w-full min-h-[160px] p-2 font-mono text-xs border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

/**
 * Imports creatures from JSON — typically animals or NPCs researched in a chat
 * and handed over as a file.
 *
 * @remarks
 * The sibling of `RouteImportModal`, down to the bargain it strikes with the
 * user: paste is offered alongside the file picker because that is how a stat
 * block usually arrives, and nothing is written until the parse has been shown.
 *
 * The preview lists what will be created and, more importantly, what was
 * **ignored** — a stat the ruleset does not declare is dropped, and finding that
 * out after the import rather than before is how a bestiary ends up quietly
 * missing half its numbers.
 *
 * Import is additive. There is no "replace all" here as there is for a route: a
 * route is one planned journey that a new file supersedes, while a bestiary is
 * an accumulating library and wiping it from an import dialog is not a mistake
 * worth making easy.
 */
export function CreatureImportModal({ statFields, onCancel, onImport }: CreatureImportModalProps) {
  // Escape, a focus trap and focus restore — this is a hand-rolled dialog, so
  // none of it comes for free. See useOverlayDismiss.
  const dialogRef = useOverlayDismiss<HTMLDivElement>(onCancel);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedCreature[] | null>(null);
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
    const result = parseCreatureImport(next, statFields);
    if (result.ok) {
      setParsed(result.creatures);
      setWarnings(result.warnings);
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
      await onImport(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import those creatures.');
      setIsSaving(false);
    }
  }

  const placeholder = `{
  "creatures": [
    {
      "name": "Grey Wolf",
      "category": "animal",
      "stats": { ${statFields.slice(0, 3).map(f => `"${f.id}": 0`).join(', ')} },
      "attacks": [{ "name": "Bite", "damage": "2d6" }],
      "abilities": [{ "name": "Pack hunter", "description": "+1 when flanking" }],
      "skills": [{ "name": "Survival", "value": 2 }],
      "tags": ["forest"]
    }
  ]
}`;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 p-[var(--space-md)]"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Import creatures"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-md)] flex flex-col gap-[var(--space-sm)]">
        <h2 className="text-lg font-semibold">Import creatures</h2>

        <p className="text-[var(--color-text-muted)] text-sm">
          Paste JSON below, or choose a file. A single creature, an array, or an
          object with a <code>creatures</code> array all work. Stats recognised
          for this ruleset: {statFields.map(f => f.label).join(', ')}.
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
          placeholder={placeholder}
          onChange={e => handleText(e.target.value)}
          aria-label="Creature JSON"
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
                  <th className="py-1 px-2">Name</th>
                  <th className="py-1 px-2">Category</th>
                  {statFields.map(f => (
                    <th key={f.id} className="py-1 px-2">
                      {statAbbr(f)}
                    </th>
                  ))}
                  <th className="py-1 px-2">Attacks</th>
                  <th className="py-1 px-2">Abilities</th>
                  <th className="py-1 px-2">Skills</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((creature, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="py-1 px-2 text-[var(--color-text-muted)]">{i + 1}</td>
                    <td className="py-1 px-2">{creature.name}</td>
                    <td className="py-1 px-2 capitalize">{creature.category}</td>
                    {statFields.map(f => (
                      <td key={f.id} className="py-1 px-2">
                        {creature.stats[f.id] ?? '—'}
                      </td>
                    ))}
                    <td className="py-1 px-2">{creature.attacks.length || '—'}</td>
                    <td className="py-1 px-2">{creature.abilities.length || '—'}</td>
                    <td className="py-1 px-2">{creature.skills.length || '—'}</td>
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
          <Button onClick={() => void commit()} disabled={!parsed || isSaving}>
            {parsed ? `Import ${parsed.length} creature${parsed.length === 1 ? '' : 's'}` : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}
