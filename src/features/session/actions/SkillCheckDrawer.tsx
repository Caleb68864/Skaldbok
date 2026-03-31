import { useState } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { PartyPicker } from '../../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../../components/fields/PartyPicker';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';

const CORE_SKILLS = [
  'ACROBATICS', 'AWARENESS', 'BARTERING', 'BEAST LORE', 'BLUFFING',
  'BUSHCRAFT', 'CRAFTING', 'EVADE', 'HEALING', 'HUNTING & FISHING',
  'LANGUAGES', 'MYTHS & LEGENDS', 'PERFORMANCE', 'PERSUASION',
  'RIDING', 'SEAMANSHIP', 'SLEIGHT OF HAND', 'SNEAKING',
  'SPOT HIDDEN', 'SWIMMING',
] as const;

const WEAPON_SKILLS = [
  'Axes', 'Bows', 'Brawling', 'Crossbows', 'Hammers',
  'Knives', 'Slings', 'Spears', 'Staves', 'Swords',
] as const;

const RESULTS = ['success', 'failure', 'dragon', 'demon'] as const;

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

function formatModTags(mods: { boon: boolean; bane: boolean; pushed: boolean }): string {
  const tags: string[] = [];
  if (mods.boon) tags.push('Boon');
  if (mods.bane) tags.push('Bane');
  if (mods.pushed) tags.push('Pushed');
  return tags.length > 0 ? ` (${tags.join(', ')})` : '';
}

export interface SkillCheckDrawerProps {
  open: boolean;
  onClose: () => void;
  members: ResolvedMember[];
  selectedMembers: string[];
  onSelectMembers: (ids: string[]) => void;
  onLogged: () => void;
}

export function SkillCheckDrawer({ open, onClose, members, selectedMembers, onSelectMembers, onLogged }: SkillCheckDrawerProps) {
  const { createNote } = useNoteActions();
  const { showToast } = useToast();
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [rollMods, setRollMods] = useState({ boon: false, bane: false, pushed: false });

  const selectedNames = () => {
    if (selectedMembers.length === 0) return 'Unknown';
    if (selectedMembers.length === members.length && members.length > 1) return 'Party';
    return selectedMembers.map(id => members.find(m => m.id === id)?.name ?? 'Unknown').join(', ');
  };

  const selectedCharacter = () => {
    if (selectedMembers.length === 0) return null;
    return members.find(m => m.id === selectedMembers[0])?.character ?? null;
  };

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

  const handleClose = () => {
    setSelectedSkill(null);
    setRollMods({ boon: false, bane: false, pushed: false });
    onClose();
  };

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
