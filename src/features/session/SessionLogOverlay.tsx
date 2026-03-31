import { useState, useCallback } from 'react';
import { Drawer } from '../../components/primitives/Drawer';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { useSessionLog } from './useSessionLog';
import { useToast } from '../../context/ToastContext';

const RESULTS = ['success', 'failure', 'dragon', 'demon'] as const;
type Result = typeof RESULTS[number];

const resultChipBase = {
  minHeight: '50px',
  minWidth: '50px',
  padding: '0 16px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: 600,
} as const;

const modChipStyle = (active: boolean, color: string) => ({
  minHeight: '44px',
  padding: '0 14px',
  borderRadius: '22px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
  background: active ? color : 'var(--color-surface-raised)',
  color: active ? '#fff' : 'var(--color-text)',
});

/**
 * Floating overlay for character screens that provides quick session logging.
 * Shows a "Log Roll" button when a session is active.
 * Renders result pickers for skills, spells, and abilities.
 */
export function SessionLogOverlay() {
  const { character } = useActiveCharacter();
  const { hasActiveSession, logSkillCheck, logSpellCast, logAbilityUse } = useSessionLog();
  const { showToast } = useToast();

  const [activeDrawer, setActiveDrawer] = useState<'skill' | 'spell' | 'ability' | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [mods, setMods] = useState({ boon: false, bane: false, pushed: false });

  const close = useCallback(() => {
    setActiveDrawer(null);
    setSelectedItem(null);
    setMods({ boon: false, bane: false, pushed: false });
  }, []);

  if (!hasActiveSession || !character) return null;

  const charName = character.name;

  const handleSkillResult = async (result: Result) => {
    if (!selectedItem) return;
    await logSkillCheck(charName, selectedItem, result, mods);
    showToast(`Logged: ${selectedItem} — ${result}`);
    close();
  };

  const handleSpellResult = async (result: Result) => {
    if (!selectedItem) return;
    await logSpellCast(charName, selectedItem, result);
    showToast(`Logged: Cast ${selectedItem} — ${result}`);
    close();
  };

  const handleAbilityUse = async (abilityName: string) => {
    await logAbilityUse(charName, abilityName);
    showToast(`Logged: Used ${abilityName}`);
    close();
  };

  const renderResultPicker = (onSelect: (r: Result) => void) => (
    <div>
      <p style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: '8px', fontSize: '16px' }}>
        {selectedItem}
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button onClick={() => setMods(m => ({ ...m, boon: !m.boon }))} style={modChipStyle(mods.boon, '#27ae60')}>Boon</button>
        <button onClick={() => setMods(m => ({ ...m, bane: !m.bane }))} style={modChipStyle(mods.bane, '#c0392b')}>Bane</button>
        <button onClick={() => setMods(m => ({ ...m, pushed: !m.pushed }))} style={modChipStyle(mods.pushed, '#8e44ad')}>Pushed</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {RESULTS.map(result => (
          <button
            key={result}
            onClick={() => onSelect(result)}
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

  const renderSkillList = () => {
    if (selectedItem) return renderResultPicker(handleSkillResult);
    const skills = character.skills ? Object.entries(character.skills).map(([id]) => ({ id, name: id })) : [];
    return (
      <div>
        {skills.length > 0 ? skills.map(s => (
          <button key={s.id} onClick={() => setSelectedItem(s.name)} style={listItemStyle}>
            {s.name}
          </button>
        )) : (
          <p style={{ color: 'var(--color-text-muted)' }}>No skills on this character.</p>
        )}
      </div>
    );
  };

  const renderSpellList = () => {
    if (selectedItem) return renderResultPicker(handleSpellResult);
    return (
      <div>
        {character.spells.length > 0 ? character.spells.map(spell => (
          <button key={spell.id} onClick={() => setSelectedItem(spell.name)} style={listItemStyle}>
            <span>{spell.name}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginLeft: '8px' }}>({spell.wpCost} WP)</span>
          </button>
        )) : (
          <p style={{ color: 'var(--color-text-muted)' }}>No spells on this character.</p>
        )}
      </div>
    );
  };

  const renderAbilityList = () => (
    <div>
      {character.heroicAbilities.length > 0 ? character.heroicAbilities.map(a => (
        <button key={a.id} onClick={() => handleAbilityUse(a.name)} style={listItemStyle}>
          <span>{a.name}</span>
          {a.wpCost !== undefined && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginLeft: '8px' }}>({a.wpCost} WP)</span>
          )}
        </button>
      )) : (
        <p style={{ color: 'var(--color-text-muted)' }}>No heroic abilities on this character.</p>
      )}
    </div>
  );

  return (
    <>
      {/* Floating action buttons */}
      <div
        style={{
          position: 'fixed',
          bottom: '60px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 100,
        }}
      >
        <button onClick={() => setActiveDrawer('skill')} style={fabStyle} title="Log Skill Check">
          🎲
        </button>
        {character.spells.length > 0 && (
          <button onClick={() => setActiveDrawer('spell')} style={fabStyle} title="Log Spell">
            ✨
          </button>
        )}
        {character.heroicAbilities.length > 0 && (
          <button onClick={() => setActiveDrawer('ability')} style={fabStyle} title="Log Ability">
            ⚔️
          </button>
        )}
      </div>

      {activeDrawer === 'skill' && (
        <Drawer open onClose={close} title={`${charName}: Skill Check`}>
          {renderSkillList()}
        </Drawer>
      )}
      {activeDrawer === 'spell' && (
        <Drawer open onClose={close} title={`${charName}: Cast Spell`}>
          {renderSpellList()}
        </Drawer>
      )}
      {activeDrawer === 'ability' && (
        <Drawer open onClose={close} title={`${charName}: Heroic Ability`}>
          {renderAbilityList()}
        </Drawer>
      )}
    </>
  );
}

const listItemStyle = {
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

const fabStyle = {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  background: 'var(--color-accent)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
} as const;
