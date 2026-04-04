import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { MagicSpellCard } from '../components/fields/MagicSpellCard';
import { AbilityCard } from '../components/fields/AbilityCard';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { Drawer } from '../components/primitives/Drawer';
import type { Spell, HeroicAbility, TempModifier } from '../types/character';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { useToast } from '../context/ToastContext';
import { useIsEditMode } from '../utils/modeGuards';
import { computeMaxPreparedSpells } from '../utils/derivedValues';
import { isMetalEquipped } from '../utils/metalDetection';

type PrepFilter = 'prepared' | 'grimoire';

function isMagicTrick(s: Spell): boolean {
  return s.school.toLowerCase().includes('trick');
}

const inputClasses = "w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] font-[family-name:inherit]";

export default function MagicScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const isEditMode = useIsEditMode();
  const { showToast } = useToast();

  // Preparation filter tab
  const [filter, setFilter] = useState<PrepFilter>('prepared');
  // Per-spell power level (UI-only, not persisted)
  const [powerLevels, setPowerLevels] = useState<Record<string, number>>({});

  // Spell drawer state
  const [spellDrawerOpen, setSpellDrawerOpen] = useState(false);
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const [abilityDrawerOpen, setAbilityDrawerOpen] = useState(false);
  const [editingAbility, setEditingAbility] = useState<HeroicAbility | null>(null);

  // Spell form state
  const [sName, setSName] = useState('');
  const [sSchool, setSSchool] = useState('');
  const [sRange, setSRange] = useState('');
  const [sDuration, setSDuration] = useState('');
  const [sSummary, setSSummary] = useState('');

  // Ability form state
  const [aName, setAName] = useState('');
  const [aSummary, setASummary] = useState('');

  useEffect(() => {
    if (spellDrawerOpen && editingSpell) {
      setSName(editingSpell.name); setSSchool(editingSpell.school);
      setSRange(editingSpell.range); setSDuration(editingSpell.duration);
      setSSummary(editingSpell.summary);
    } else if (spellDrawerOpen && !editingSpell) {
      setSName(''); setSSchool(''); setSRange(''); setSDuration(''); setSSummary('');
    }
  }, [spellDrawerOpen, editingSpell]);

  useEffect(() => {
    if (abilityDrawerOpen && editingAbility) {
      setAName(editingAbility.name); setASummary(editingAbility.summary);
    } else if (abilityDrawerOpen && !editingAbility) {
      setAName(''); setASummary('');
    }
  }, [abilityDrawerOpen, editingAbility]);

  useEffect(() => {
    if (!isLoading && !character) {
      navigate('/library');
    }
  }, [isLoading, character, navigate]);

  if (isLoading) return <div className="p-[var(--space-md)] text-[var(--color-text)]">Loading...</div>;
  if (!character) return null;

  // ── Derived values ────────────────────────────────────────────────
  const maxPrepared = computeMaxPreparedSpells(character);
  const preparedCount = character.spells?.filter(s => s.prepared && !isMagicTrick(s)).length ?? 0;
  const metalBlocked = isMetalEquipped(character);
  const currentWP = character.resources?.wp?.current ?? 0;
  const overLimit = preparedCount > maxPrepared;

  const visibleSpells = filter === 'prepared'
    ? character.spells.filter(s => s.prepared === true || isMagicTrick(s))
    : character.spells;

  // ── Handlers ──────────────────────────────────────────────────────
  function handleTogglePrepare(spell: Spell) {
    const spells = character!.spells.map(s =>
      s.id === spell.id ? { ...s, prepared: !s.prepared } : s
    );
    updateCharacter({ spells, updatedAt: nowISO() });
  }

  function handleSpellSave() {
    const spell: Spell = { id: editingSpell?.id ?? generateId(), name: sName, school: sSchool, powerLevel: 1, wpCost: 2, range: sRange, duration: sDuration, summary: sSummary };
    const spells = editingSpell ? character!.spells.map(s => s.id === spell.id ? spell : s) : [...character!.spells, spell];
    updateCharacter({ spells, updatedAt: nowISO() });
    setSpellDrawerOpen(false);
  }

  function handleSpellDelete(id: string) {
    updateCharacter({ spells: character!.spells.filter(s => s.id !== id), updatedAt: nowISO() });
  }

  function handleAbilitySave() {
    const ability: HeroicAbility = { id: editingAbility?.id ?? generateId(), name: aName, summary: aSummary };
    const heroicAbilities = editingAbility
      ? character!.heroicAbilities.map(a => a.id === ability.id ? ability : a)
      : [...character!.heroicAbilities, ability];
    updateCharacter({ heroicAbilities, updatedAt: nowISO() });
    setAbilityDrawerOpen(false);
  }

  function handleAbilityDelete(id: string) {
    updateCharacter({ heroicAbilities: character!.heroicAbilities.filter(a => a.id !== id), updatedAt: nowISO() });
  }

  function handleCastSpell(spell: Spell, wpCost: number) {
    if (!character) return;
    const wp = character.resources['wp'];
    if (!wp || wp.current < wpCost) {
      showToast('Not enough WP to cast this spell.', 'error');
      return;
    }
    // Deduct WP
    const updates: Record<string, unknown> = {
      resources: { ...character.resources, wp: { ...wp, current: wp.current - wpCost } },
      updatedAt: nowISO(),
    };
    // Create temp modifiers from spell effects if defined
    if (spell.effects && spell.effects.length > 0) {
      const byDuration = new Map<string, typeof spell.effects>();
      for (const eff of spell.effects) {
        const arr = byDuration.get(eff.duration) ?? [];
        arr.push(eff);
        byDuration.set(eff.duration, arr);
      }
      const newModifiers: TempModifier[] = Array.from(byDuration.entries()).map(([dur, effs]) => ({
        id: crypto.randomUUID(),
        label: spell.name,
        effects: effs.map(e => ({ stat: e.stat, delta: e.delta })),
        duration: dur as TempModifier['duration'],
        sourceSpellId: spell.id,
        createdAt: nowISO(),
      }));
      updates.tempModifiers = [...(character.tempModifiers ?? []), ...newModifiers];
      showToast(`Cast ${spell.name} (${wpCost} WP) — effects applied!`, 'success');
    } else {
      showToast(`Cast ${spell.name} (${wpCost} WP)`, 'success');
    }
    updateCharacter(updates);
  }

  return (
    <div className="p-[var(--space-md)]">
      {/* ── Page header with prepared counter ── */}
      <div className="flex items-center justify-between mb-[var(--space-sm)] flex-wrap gap-[var(--space-sm)]">
        <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)] m-0">Magic</h1>
        <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] font-bold">
          {preparedCount}/{maxPrepared} Prepared
        </span>
      </div>

      {/* ── Over-limit warning ── */}
      {overLimit && (
        <div className="bg-[color-mix(in_srgb,var(--color-warning,#e67e22)_15%,transparent)] border border-[var(--color-warning,#e67e22)] rounded-[var(--radius-sm)] px-[var(--space-md)] py-[var(--space-sm)] mb-[var(--space-sm)] text-[length:var(--font-size-sm)] text-[var(--color-text)]">
          ⚠ You have {preparedCount} prepared but can only hold {maxPrepared}. Please unprepare {preparedCount - maxPrepared} spell{preparedCount - maxPrepared !== 1 ? 's' : ''}.
        </div>
      )}

      {/* ── Metal warning banner ── */}
      {metalBlocked && (
        <div className="metal-warning-banner">
          ⚠ Metal equipment equipped — spellcasting is impaired!
        </div>
      )}

      {/* ── Filter tabs: Prepared | Grimoire ── */}
      <div className="magic-filter-tabs mb-[var(--space-md)]">
        <button
          type="button"
          className={['magic-filter-tab', filter === 'prepared' ? 'magic-filter-tab--active' : ''].filter(Boolean).join(' ')}
          onClick={() => setFilter('prepared')}
        >
          Prepared
        </button>
        <button
          type="button"
          className={['magic-filter-tab', filter === 'grimoire' ? 'magic-filter-tab--active' : ''].filter(Boolean).join(' ')}
          onClick={() => setFilter('grimoire')}
        >
          Grimoire
        </button>
      </div>

      {/* ── Spells section ── */}
      <SectionPanel title="Spells" subtitle="p. 63-64" collapsible defaultOpen>
        <div className="flex justify-end mb-[var(--space-sm)]">
          {isEditMode && <Button size="sm" variant="primary" onClick={() => { setEditingSpell(null); setSpellDrawerOpen(true); }}>+ Add Spell</Button>}
        </div>
        {visibleSpells.length === 0 && (
          <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            {filter === 'prepared' ? 'No prepared spells. Switch to Grimoire to prepare spells.' : isEditMode ? 'No spells yet. Add a spell above.' : 'No spells yet. Switch to Edit Mode to add spells.'}
          </p>
        )}
        <div className="flex flex-col gap-[var(--space-md)]">
          {visibleSpells.map(spell => (
            <MagicSpellCard
              key={spell.id}
              spell={spell}
              isTrick={isMagicTrick(spell)}
              isGrimoireView={filter === 'grimoire'}
              preparedCount={preparedCount}
              maxPrepared={maxPrepared}
              currentWP={currentWP}
              powerLevel={powerLevels[spell.id] ?? 1}
              onPowerLevelChange={(lvl) => setPowerLevels(prev => ({ ...prev, [spell.id]: lvl }))}
              onTogglePrepare={() => handleTogglePrepare(spell)}
              onCast={handleCastSpell}
              onEdit={isEditMode ? () => { setEditingSpell(spell); setSpellDrawerOpen(true); } : undefined}
              onDelete={isEditMode ? () => handleSpellDelete(spell.id) : undefined}
            />
          ))}
        </div>
      </SectionPanel>

      {/* ── Heroic Abilities section ── */}
      <SectionPanel title="Heroic Abilities" subtitle="p. 30-31" collapsible defaultOpen>
        <div className="flex justify-end mb-[var(--space-sm)]">
          {isEditMode && <Button size="sm" variant="primary" onClick={() => { setEditingAbility(null); setAbilityDrawerOpen(true); }}>+ Add Ability</Button>}
        </div>
        {character.heroicAbilities.length === 0 && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No heroic abilities yet.</p>}
        <div className="flex flex-col gap-[var(--space-md)]">
          {character.heroicAbilities.map(a => <AbilityCard key={a.id} ability={a} onEdit={() => { setEditingAbility(a); setAbilityDrawerOpen(true); }} onDelete={() => handleAbilityDelete(a.id)} isEditMode={isEditMode} />)}
        </div>
      </SectionPanel>

      {/* ── Spell edit drawer ── */}
      <Drawer open={spellDrawerOpen} onClose={() => setSpellDrawerOpen(false)} title={editingSpell ? 'Edit Spell' : 'Add Spell'}>
        <div className="flex flex-col gap-[var(--space-md)]">
          {[['Name', sName, setSName], ['School', sSchool, setSSchool], ['Range', sRange, setSRange], ['Duration', sDuration, setSDuration]].map(([label, val, setter]) => (
            <div key={String(label)}>
              <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">{String(label)}</label>
              <input className={inputClasses} value={String(val)} onChange={e => (setter as (v: string) => void)(e.target.value)} />
            </div>
          ))}
          <div>
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
              WP cost: 2 per power level (selected at cast time). Tricks always cost 1 WP.
            </p>
          </div>
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Summary</label>
            <textarea className={`${inputClasses} resize-y`} value={sSummary} rows={3} onChange={e => setSSummary(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setSpellDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSpellSave}>Save</Button>
          </div>
        </div>
      </Drawer>

      {/* ── Ability edit drawer ── */}
      <Drawer open={abilityDrawerOpen} onClose={() => setAbilityDrawerOpen(false)} title={editingAbility ? 'Edit Ability' : 'Add Ability'}>
        <div className="flex flex-col gap-[var(--space-md)]">
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Name</label>
            <input className={inputClasses} value={aName} onChange={e => setAName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Summary</label>
            <textarea className={`${inputClasses} resize-y`} value={aSummary} rows={3} onChange={e => setASummary(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setAbilityDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAbilitySave}>Save</Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
