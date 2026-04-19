import { useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { PartyPicker } from '../../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../../components/fields/PartyPicker';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';
import { useSessionEncounterContextSafe } from '../SessionEncounterContext';
import { AttachToControl, resolveAttach, type AttachToValue } from '../quickActions/AttachToControl';
import { formatModTags as sharedFormatModTags } from './formatSkillCheckTitle';
import { cn } from '../../../lib/utils';

/**
 * Dragonbane core skills (non-weapon) available for selection in the skill-check flow.
 * @internal
 */
const CORE_SKILLS = [
  'ACROBATICS', 'AWARENESS', 'BARTERING', 'BEAST LORE', 'BLUFFING',
  'BUSHCRAFT', 'CRAFTING', 'EVADE', 'HEALING', 'HUNTING & FISHING',
  'LANGUAGES', 'MYTHS & LEGENDS', 'PERFORMANCE', 'PERSUASION',
  'RIDING', 'SEAMANSHIP', 'SLEIGHT OF HAND', 'SNEAKING',
  'SPOT HIDDEN', 'SWIMMING',
] as const;

/**
 * Dragonbane weapon skills available for selection in the skill-check flow.
 * @internal
 */
const WEAPON_SKILLS = [
  'Axes', 'Bows', 'Brawling', 'Crossbows', 'Hammers',
  'Knives', 'Slings', 'Spears', 'Staves', 'Swords',
] as const;

/**
 * All possible outcomes for a Dragonbane skill check roll.
 * @internal
 */
const RESULTS = ['success', 'failure', 'dragon', 'demon'] as const;

/**
 * Internal sub-component that renders the Boon / Bane / Pushed modifier toggles.
 *
 * @param props.mods - Current active state of each modifier.
 * @param props.onToggle - Called with the modifier key when a chip is tapped.
 */
function RollModifiers({
  mods,
  onToggle,
}: {
  mods: { boon: boolean; bane: boolean; pushed: boolean };
  onToggle: (key: 'boon' | 'bane' | 'pushed') => void;
}) {
  const modChip = (key: 'boon' | 'bane' | 'pushed', label: string, activeColor: string) => (
    <button
      key={key}
      onClick={() => onToggle(key)}
      className={cn(
        'min-h-11 px-3.5 rounded-full border-none cursor-pointer text-sm font-semibold shrink-0',
        mods[key]
          ? `bg-[${activeColor}] text-white`
          : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-3">
      <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
        Modifiers
      </p>
      <div className="flex gap-2 flex-wrap">
        {modChip('boon', 'Boon', '#27ae60')}
        {modChip('bane', 'Bane', '#c0392b')}
        {modChip('pushed', 'Pushed', '#8e44ad')}
      </div>
    </div>
  );
}

const formatModTags = sharedFormatModTags;

/**
 * Props for the {@link SkillCheckDrawer} component.
 */
export interface SkillCheckDrawerProps {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Called when the drawer should be closed. */
  onClose: () => void;
  /** All available party members for the {@link PartyPicker}. */
  members: ResolvedMember[];
  /** IDs of the currently selected party members. */
  selectedMembers: string[];
  /** Called when the member selection changes. */
  onSelectMembers: (ids: string[]) => void;
  /** Called after a skill check result has been logged as a note. */
  onLogged: () => void;
}

/**
 * Two-step drawer for logging a Dragonbane skill check result as a session note.
 *
 * @remarks
 * **Step 1 — skill selection**: displays the character's own skills (if a single
 * member is selected and has a linked character record with skills), followed by
 * the full list of core and weapon skills.
 *
 * **Step 2 — result entry**: shows the selected skill name, {@link RollModifiers}
 * toggles (Boon / Bane / Pushed), and four outcome buttons (Success, Failure,
 * Dragon, Demon). Tapping an outcome creates a `skill-check` note and fires
 * `onLogged`.
 *
 * Closing or logging resets both steps back to their initial state.
 *
 * @param props - {@link SkillCheckDrawerProps}
 *
 * @example
 * ```tsx
 * <SkillCheckDrawer
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   members={resolvedMembers}
 *   selectedMembers={selectedIds}
 *   onSelectMembers={setSelectedIds}
 *   onLogged={refreshNotes}
 * />
 * ```
 */
export function SkillCheckDrawer({ open, onClose, members, selectedMembers, onSelectMembers, onLogged }: SkillCheckDrawerProps) {
  const { createNote } = useNoteActions();
  const { showToast } = useToast();
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [rollMods, setRollMods] = useState({ boon: false, bane: false, pushed: false });
  const [attachTo, setAttachTo] = useState<AttachToValue>('auto');

  /** Returns the display label for the current member selection (single name, "Party", or "Unknown"). */
  const selectedNames = () => {
    if (selectedMembers.length === 0) return 'Unknown';
    if (selectedMembers.length === members.length && members.length > 1) return 'Party';
    return selectedMembers.map(id => members.find(m => m.id === id)?.name ?? 'Unknown').join(', ');
  };

  /** Returns the character record for the first selected member, if any. */
  const selectedCharacter = () => {
    if (selectedMembers.length === 0) return null;
    return members.find(m => m.id === selectedMembers[0])?.character ?? null;
  };

  /**
   * Creates the skill-check note with the given title and type data, then
   * shows a toast, resets state, and calls `onLogged`.
   *
   * @param title - Formatted title string (e.g. `"Aldric: Axes (Boon) — success"`).
   * @param typeData - Structured metadata stored on the note's `typeData` field.
   */
  const logEvent = async (title: string, typeData: Record<string, unknown>) => {
    const who = selectedNames();
    const fullTitle = who ? `${who}: ${title}` : title;
    const currentAttach = attachTo;
    await createNote(
      {
        title: fullTitle,
        type: 'skill-check',
        body: null,
        pinned: false,
        status: 'active',
        typeData,
      },
      { targetEncounterId: resolveAttach(currentAttach) },
    );
    let encounterTitle: string | null = null;
    if (currentAttach === 'auto') {
      encounterTitle = sessionEncounterCtx?.activeEncounter?.title ?? null;
    } else if (typeof currentAttach === 'string') {
      encounterTitle = 'encounter';
    }
    if (encounterTitle) {
      showToast(`Logged to ${encounterTitle}`, 'success', 2000);
    } else {
      showToast('Logged to session', 'success', 2000);
    }
    handleClose();
    onLogged();
  };

  /** Resets skill selection and modifier state, then closes the drawer. */
  const handleClose = () => {
    setSelectedSkill(null);
    setRollMods({ boon: false, bane: false, pushed: false });
    setAttachTo('auto');
    onClose();
  };

  /** Renders either the skill-list view or the result-entry view depending on selection state. */
  const renderContent = () => {
    if (selectedSkill) {
      const modTag = formatModTags(rollMods);
      return (
        <div>
          <PartyPicker members={members} selected={selectedMembers} onSelect={onSelectMembers} />
          <p className="text-[var(--color-text)] font-semibold mb-3 text-base">
            {selectedSkill}{modTag}
          </p>
          <RollModifiers mods={rollMods} onToggle={key => setRollMods(m => ({ ...m, [key]: !m[key] }))} />
          <AttachToControl value={attachTo} onChange={setAttachTo} />
          <div className="grid grid-cols-2 gap-2">
            {RESULTS.map(result => (
              <button
                key={result}
                onClick={() => logEvent(`${selectedSkill}${formatModTags(rollMods)} — ${result}`, {
                  skill: selectedSkill,
                  result,
                  character: selectedNames(),
                  mods: { ...rollMods },
                })}
                className={cn(
                  'min-h-11 min-w-11 px-4 border-none rounded-lg cursor-pointer text-sm font-semibold',
                  result === 'dragon' ? 'bg-[var(--color-accent)] text-white'
                    : result === 'demon' ? 'bg-[#c0392b] text-white'
                    : result === 'success' ? 'bg-[#27ae60] text-white'
                    : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
                )}
              >
                {result === 'dragon' ? 'Dragon (1)' : result === 'demon' ? 'Demon (20)' : result.charAt(0).toUpperCase() + result.slice(1)}
              </button>
            ))}
          </div>
        </div>
      );
    }

    const char = selectedCharacter();
    const charSkills = char?.skills ? Object.keys(char.skills) : [];

    return (
      <div>
        <PartyPicker members={members} selected={selectedMembers} onSelect={onSelectMembers} />
        {charSkills.length > 0 && (
          <>
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
              {selectedNames()}'s Skills
            </p>
            {charSkills.map(skill => (
              <button key={`char-${skill}`} onClick={() => setSelectedSkill(skill)} className="block w-full text-left py-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base">
                {skill}
              </button>
            ))}
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mt-3 mb-1">
              All Skills
            </p>
          </>
        )}
        {[...CORE_SKILLS, ...WEAPON_SKILLS].map(skill => (
          <button key={skill} onClick={() => setSelectedSkill(skill)} className="block w-full text-left py-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base">
            {skill}
          </button>
        ))}
      </div>
    );
  };

  return (
    <Drawer open={open} onClose={handleClose} title="Skill Check">
      {renderContent()}
    </Drawer>
  );
}
