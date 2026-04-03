import { useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { PartyPicker } from '../../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../../components/fields/PartyPicker';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';

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

/** Shared inline styles for modifier toggle chips (Boon / Bane / Pushed). */
const chipStyle = {
  minHeight: '44px',
  padding: '0 14px',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '22px',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
  flexShrink: 0,
} as const;

/** Shared inline styles for skill-list row buttons. */
const listBtnStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left' as const,
  padding: '12px 0',
  minHeight: '44px',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--color-border)',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '16px',
};

/** Base styles for the result outcome buttons (Success / Failure / Dragon / Demon). */
const resultChipBase = {
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 16px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
} as const;

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
      style={{
        ...chipStyle,
        background: mods[key] ? activeColor : 'var(--color-surface-raised)',
        color: mods[key] ? '#fff' : 'var(--color-text)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        Modifiers
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {modChip('boon', 'Boon', '#27ae60')}
        {modChip('bane', 'Bane', '#c0392b')}
        {modChip('pushed', 'Pushed', '#8e44ad')}
      </div>
    </div>
  );
}

/**
 * Converts the active modifier flags to a parenthetical tag string.
 *
 * @param mods - Active modifier flags.
 * @returns A string like `" (Boon, Pushed)"` or an empty string when no modifiers are active.
 */
function formatModTags(mods: { boon: boolean; bane: boolean; pushed: boolean }): string {
  const tags: string[] = [];
  if (mods.boon) tags.push('Boon');
  if (mods.bane) tags.push('Bane');
  if (mods.pushed) tags.push('Pushed');
  return tags.length > 0 ? ` (${tags.join(', ')})` : '';
}

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
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [rollMods, setRollMods] = useState({ boon: false, bane: false, pushed: false });

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
    await createNote({
      title: fullTitle,
      type: 'skill-check',
      body: null,
      pinned: false,
      status: 'active',
      typeData,
    });
    showToast(`Logged: ${fullTitle}`);
    handleClose();
    onLogged();
  };

  /** Resets skill selection and modifier state, then closes the drawer. */
  const handleClose = () => {
    setSelectedSkill(null);
    setRollMods({ boon: false, bane: false, pushed: false });
    onClose();
  };

  /** Renders either the skill-list view or the result-entry view depending on selection state. */
  const renderContent = () => {
    if (selectedSkill) {
      const modTag = formatModTags(rollMods);
      return (
        <div>
          <PartyPicker members={members} selected={selectedMembers} onSelect={onSelectMembers} />
          <p style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: '12px', fontSize: '16px' }}>
            {selectedSkill}{modTag}
          </p>
          <RollModifiers mods={rollMods} onToggle={key => setRollMods(m => ({ ...m, [key]: !m[key] }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {RESULTS.map(result => (
              <button
                key={result}
                onClick={() => logEvent(`${selectedSkill}${formatModTags(rollMods)} — ${result}`, {
                  skill: selectedSkill,
                  result,
                  character: selectedNames(),
                })}
                style={{
                  ...resultChipBase,
                  background: result === 'dragon' ? 'var(--color-accent)'
                    : result === 'demon' ? '#c0392b'
                    : result === 'success' ? '#27ae60'
                    : 'var(--color-surface-raised)',
                  color: result === 'failure' ? 'var(--color-text)' : '#fff',
                }}
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
            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              {selectedNames()}'s Skills
            </p>
            {charSkills.map(skill => (
              <button key={`char-${skill}`} onClick={() => setSelectedSkill(skill)} style={listBtnStyle}>
                {skill}
              </button>
            ))}
            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 4px' }}>
              All Skills
            </p>
          </>
        )}
        {[...CORE_SKILLS, ...WEAPON_SKILLS].map(skill => (
          <button key={skill} onClick={() => setSelectedSkill(skill)} style={listBtnStyle}>
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
