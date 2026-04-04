import { useState, useCallback } from 'react';
import { Drawer } from '../../components/primitives/Drawer';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { useSessionLog } from './useSessionLog';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

const RESULTS = ['success', 'failure', 'dragon', 'demon'] as const;
type Result = typeof RESULTS[number];

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
      <p className="text-[var(--color-text)] font-semibold mb-2 text-base">
        {selectedItem}
      </p>
      <div className="flex gap-2 flex-wrap mb-3">
        <button onClick={() => setMods(m => ({ ...m, boon: !m.boon }))} className={cn('min-h-11 px-3.5 py-1 rounded-full border-none cursor-pointer text-sm font-semibold', mods.boon ? 'bg-[#27ae60] text-white' : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]')}>Boon</button>
        <button onClick={() => setMods(m => ({ ...m, bane: !m.bane }))} className={cn('min-h-11 px-3.5 py-1 rounded-full border-none cursor-pointer text-sm font-semibold', mods.bane ? 'bg-[#c0392b] text-white' : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]')}>Bane</button>
        <button onClick={() => setMods(m => ({ ...m, pushed: !m.pushed }))} className={cn('min-h-11 px-3.5 py-1 rounded-full border-none cursor-pointer text-sm font-semibold', mods.pushed ? 'bg-[#8e44ad] text-white' : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]')}>Pushed</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {RESULTS.map(result => (
          <button
            key={result}
            onClick={() => onSelect(result)}
            className={cn(
              'min-h-[50px] min-w-[50px] px-4 border-none rounded-lg cursor-pointer text-[15px] font-semibold',
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

  const renderSkillList = () => {
    if (selectedItem) return renderResultPicker(handleSkillResult);
    const skills = character.skills ? Object.entries(character.skills).map(([id]) => ({ id, name: id })) : [];
    return (
      <div>
        {skills.length > 0 ? skills.map(s => (
          <button key={s.id} onClick={() => setSelectedItem(s.name)} className="block w-full text-left py-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base">
            {s.name}
          </button>
        )) : (
          <p className="text-[var(--color-text-muted)]">No skills on this character.</p>
        )}
      </div>
    );
  };

  const renderSpellList = () => {
    if (selectedItem) return renderResultPicker(handleSpellResult);
    return (
      <div>
        {character.spells.length > 0 ? character.spells.map(spell => (
          <button key={spell.id} onClick={() => setSelectedItem(spell.name)} className="block w-full text-left py-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base">
            <span>{spell.name}</span>
            <span className="text-[var(--color-text-muted)] text-sm ml-2">({spell.wpCost} WP)</span>
          </button>
        )) : (
          <p className="text-[var(--color-text-muted)]">No spells on this character.</p>
        )}
      </div>
    );
  };

  const renderAbilityList = () => (
    <div>
      {character.heroicAbilities.length > 0 ? character.heroicAbilities.map(a => (
        <button key={a.id} onClick={() => handleAbilityUse(a.name)} className="block w-full text-left py-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base">
          <span>{a.name}</span>
          {a.wpCost !== undefined && (
            <span className="text-[var(--color-text-muted)] text-sm ml-2">({a.wpCost} WP)</span>
          )}
        </button>
      )) : (
        <p className="text-[var(--color-text-muted)]">No heroic abilities on this character.</p>
      )}
    </div>
  );

  return (
    <>
      {/* Floating action buttons */}
      <div
        className="fixed bottom-[140px] right-4 flex flex-col gap-2 z-[100]"
      >
        <button onClick={() => setActiveDrawer('skill')} className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white border-none cursor-pointer text-xl flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.3)]" title="Log Skill Check">
          🎲
        </button>
        {character.spells.length > 0 && (
          <button onClick={() => setActiveDrawer('spell')} className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white border-none cursor-pointer text-xl flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.3)]" title="Log Spell">
            ✨
          </button>
        )}
        {character.heroicAbilities.length > 0 && (
          <button onClick={() => setActiveDrawer('ability')} className="w-12 h-12 rounded-full bg-[var(--color-accent)] text-white border-none cursor-pointer text-xl flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.3)]" title="Log Ability">
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
