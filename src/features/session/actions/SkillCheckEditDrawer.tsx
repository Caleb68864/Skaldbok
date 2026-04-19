import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { Button } from '../../../components/primitives/Button';
import { updateNote, softDelete as softDeleteNote } from '../../../storage/repositories/noteRepository';
import { useToast } from '../../../context/ToastContext';
import { cn } from '../../../lib/utils';
import type { Note } from '../../../types/note';
import {
  formatOutcomeTitle,
  readOutcomeTypeData,
  type OutcomeMods,
  type OutcomeResult,
} from './formatSkillCheckTitle';

const RESULTS: OutcomeResult[] = ['success', 'failure', 'dragon', 'demon'];

export interface SkillCheckEditDrawerProps {
  open: boolean;
  onClose: () => void;
  note: Note | null;
  onSaved: () => void;
}

function drawerTitle(noteType: string | undefined): string {
  if (noteType === 'spell-cast') return 'Edit spell cast';
  if (noteType === 'ability-use') return 'Edit ability use';
  return 'Edit skill check';
}

function subjectLabel(noteType: string | undefined): string {
  if (noteType === 'spell-cast') return 'Spell';
  if (noteType === 'ability-use') return 'Ability';
  return 'Skill';
}

/**
 * Structural editor for any previously-logged "outcome" note
 * (`skill-check`, `spell-cast`, `ability-use`). Lets the user fix the
 * recorded result and modifier flags without ever touching the Tiptap
 * rich-text editor — which was useless for correcting a mis-pressed
 * outcome button during play.
 */
export function SkillCheckEditDrawer({ open, onClose, note, onSaved }: SkillCheckEditDrawerProps) {
  const { showToast } = useToast();
  const [subject, setSubject] = useState('');
  const [actor, setActor] = useState('');
  const [result, setResult] = useState<OutcomeResult>('success');
  const [mods, setMods] = useState<OutcomeMods>({ boon: false, bane: false, pushed: false });

  useEffect(() => {
    if (!open || !note) return;
    const data = readOutcomeTypeData(note.typeData, note.title);
    setSubject(data.subject);
    setActor(data.actor);
    setResult(data.result);
    setMods(data.mods ?? { boon: false, bane: false, pushed: false });
  }, [open, note]);

  if (!note) {
    return (
      <Drawer open={open} onClose={onClose} title="Edit">
        <div />
      </Drawer>
    );
  }

  async function handleSave() {
    if (!note) return;
    const title = formatOutcomeTitle({ actor, subject, result, mods });
    const nextTypeData = { subject, actor, result, mods };
    try {
      await updateNote(note.id, { title, typeData: nextTypeData });
      showToast('Updated', 'success', 2000);
      onSaved();
      onClose();
    } catch (e) {
      console.error('SkillCheckEditDrawer save failed', e);
      showToast('Could not save changes', 'error');
    }
  }

  async function handleDelete() {
    if (!note) return;
    if (!confirm('Delete this entry?')) return;
    try {
      await softDeleteNote(note.id);
      showToast('Entry deleted', 'success', 2000);
      onSaved();
      onClose();
    } catch (e) {
      console.error('SkillCheckEditDrawer delete failed', e);
      showToast('Could not delete entry', 'error');
    }
  }

  const modChip = (key: keyof OutcomeMods, label: string, activeColor: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setMods(m => ({ ...m, [key]: !m[key] }))}
      className={cn(
        'min-h-11 px-3.5 rounded-full border-none cursor-pointer text-sm font-semibold shrink-0',
        mods[key]
          ? `bg-[${activeColor}] text-white`
          : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]',
      )}
    >
      {label}
    </button>
  );

  return (
    <Drawer open={open} onClose={onClose} title={drawerTitle(note.type)}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
            Who
          </div>
          <input
            type="text"
            className="w-full p-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-base"
            value={actor}
            onChange={e => setActor(e.target.value)}
          />
        </div>

        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
            {subjectLabel(note.type)}
          </div>
          <input
            type="text"
            className="w-full p-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-base"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>

        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
            Modifiers
          </div>
          <div className="flex gap-2 flex-wrap">
            {modChip('boon', 'Boon', '#27ae60')}
            {modChip('bane', 'Bane', '#c0392b')}
            {modChip('pushed', 'Pushed', '#8e44ad')}
          </div>
        </div>

        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
            Result
          </div>
          <div className="grid grid-cols-2 gap-2">
            {RESULTS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setResult(r)}
                className={cn(
                  'min-h-11 px-4 border rounded-lg cursor-pointer text-sm font-semibold',
                  result === r
                    ? r === 'dragon'
                      ? 'bg-[var(--color-accent)] text-white border-transparent'
                      : r === 'demon'
                        ? 'bg-[#c0392b] text-white border-transparent'
                        : r === 'success'
                          ? 'bg-[#27ae60] text-white border-transparent'
                          : 'bg-[var(--color-surface-raised)] text-[var(--color-text)] border-[var(--color-accent)]'
                    : 'bg-transparent text-[var(--color-text)] border-[var(--color-border)]',
                )}
              >
                {r === 'dragon' ? 'Dragon (1)' : r === 'demon' ? 'Demon (20)' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-between mt-2">
          <Button variant="danger" onClick={handleDelete}>Delete entry</Button>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={!subject.trim()}>Save</Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
