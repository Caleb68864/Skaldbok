import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { Button } from '../../../components/primitives/Button';
import { updateNote, softDelete as softDeleteNote } from '../../../storage/repositories/noteRepository';
import { useToast } from '../../../context/ToastContext';
import { cn } from '../../../lib/utils';
import type { Note } from '../../../types/note';
import {
  formatSkillCheckTitle,
  parseModsFromTitle,
  type SkillCheckMods,
  type SkillCheckResult,
  type SkillCheckTypeData,
} from './formatSkillCheckTitle';

const RESULTS: SkillCheckResult[] = ['success', 'failure', 'dragon', 'demon'];

export interface SkillCheckEditDrawerProps {
  open: boolean;
  onClose: () => void;
  note: Note | null;
  onSaved: () => void;
}

/**
 * Structural editor for a previously-logged skill-check note. Lets the user
 * fix the recorded result and modifier flags without ever touching the
 * Tiptap rich-text editor — which was useless for correcting a
 * mis-pressed outcome button during play.
 */
export function SkillCheckEditDrawer({ open, onClose, note, onSaved }: SkillCheckEditDrawerProps) {
  const { showToast } = useToast();
  const [skill, setSkill] = useState('');
  const [character, setCharacter] = useState('');
  const [result, setResult] = useState<SkillCheckResult>('success');
  const [mods, setMods] = useState<SkillCheckMods>({ boon: false, bane: false, pushed: false });

  useEffect(() => {
    if (!open || !note) return;
    const data = (note.typeData ?? {}) as Partial<SkillCheckTypeData>;
    const fallbackMods = parseModsFromTitle(note.title);
    setSkill(data.skill ?? '');
    setCharacter(data.character ?? '');
    setResult(data.result ?? 'success');
    setMods(data.mods ?? fallbackMods);
  }, [open, note]);

  if (!note) {
    return (
      <Drawer open={open} onClose={onClose} title="Edit skill check">
        <div />
      </Drawer>
    );
  }

  async function handleSave() {
    if (!note) return;
    const nextTypeData: SkillCheckTypeData = { skill, character, result, mods };
    const title = formatSkillCheckTitle(nextTypeData);
    try {
      await updateNote(note.id, { title, typeData: nextTypeData });
      showToast('Skill check updated', 'success', 2000);
      onSaved();
      onClose();
    } catch (e) {
      console.error('SkillCheckEditDrawer save failed', e);
      showToast('Could not save changes', 'error');
    }
  }

  async function handleDelete() {
    if (!note) return;
    if (!confirm('Delete this skill check entry?')) return;
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

  const modChip = (key: keyof SkillCheckMods, label: string, activeColor: string) => (
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
    <Drawer open={open} onClose={onClose} title="Edit skill check">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
            Who
          </div>
          <input
            type="text"
            className="w-full p-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-base"
            value={character}
            onChange={e => setCharacter(e.target.value)}
          />
        </div>

        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
            Skill
          </div>
          <input
            type="text"
            className="w-full p-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-base"
            value={skill}
            onChange={e => setSkill(e.target.value)}
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
            <Button variant="primary" onClick={handleSave} disabled={!skill.trim()}>Save</Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
