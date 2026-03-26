import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { MagicSpellCard } from '../components/fields/MagicSpellCard';
import { AbilityCard } from '../components/fields/AbilityCard';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { Drawer } from '../components/primitives/Drawer';
import type { Spell, HeroicAbility } from '../types/character';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { useIsEditMode } from '../utils/modeGuards';
import { computeMaxPreparedSpells } from '../utils/derivedValues';
import { isMetalEquipped } from '../utils/metalDetection';

type PrepFilter = 'prepared' | 'grimoire';

function isMagicTrick(s: Spell): boolean {
  return s.school.toLowerCase().includes('trick');
}

export default function MagicScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const isEditMode = useIsEditMode();

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

  if (isLoading) return <div style={{ padding: 'var(--space-md)', color: 'var(--color-text)' }}>Loading...</div>;
  if (!character) { navigate('/library'); return null; }

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

  const inputStyle: React.CSSProperties = { width: '100%', padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 'var(--font-size-md)', fontFamily: 'inherit' };

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      {/* ── Page header with prepared counter ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)', margin: 0 }}>Magic</h1>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
          {preparedCount}/{maxPrepared} Prepared
        </span>
      </div>

      {/* ── Over-limit warning ── */}
      {overLimit && (
        <div style={{ background: 'color-mix(in srgb, var(--color-warning, #e67e22) 15%, transparent)', border: '1px solid var(--color-warning, #e67e22)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
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
      <div className="magic-filter-tabs" style={{ marginBottom: 'var(--space-md)' }}>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-sm)' }}>
          {isEditMode && <Button size="sm" variant="primary" onClick={() => { setEditingSpell(null); setSpellDrawerOpen(true); }}>+ Add Spell</Button>}
        </div>
        {visibleSpells.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            {filter === 'prepared' ? 'No prepared spells. Switch to Grimoire to prepare spells.' : isEditMode ? 'No spells yet. Add a spell above.' : 'No spells yet. Switch to Edit Mode to add spells.'}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
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
              onEdit={isEditMode ? () => { setEditingSpell(spell); setSpellDrawerOpen(true); } : undefined}
              onDelete={isEditMode ? () => handleSpellDelete(spell.id) : undefined}
            />
          ))}
        </div>
      </SectionPanel>

      {/* ── Heroic Abilities section ── */}
      <SectionPanel title="Heroic Abilities" subtitle="p. 30-31" collapsible defaultOpen>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-sm)' }}>
          {isEditMode && <Button size="sm" variant="primary" onClick={() => { setEditingAbility(null); setAbilityDrawerOpen(true); }}>+ Add Ability</Button>}
        </div>
        {character.heroicAbilities.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No heroic abilities yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {character.heroicAbilities.map(a => <AbilityCard key={a.id} ability={a} onEdit={() => { setEditingAbility(a); setAbilityDrawerOpen(true); }} onDelete={() => handleAbilityDelete(a.id)} isEditMode={isEditMode} />)}
        </div>
      </SectionPanel>

      {/* ── Spell edit drawer ── */}
      <Drawer open={spellDrawerOpen} onClose={() => setSpellDrawerOpen(false)} title={editingSpell ? 'Edit Spell' : 'Add Spell'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {[['Name', sName, setSName], ['School', sSchool, setSSchool], ['Range', sRange, setSRange], ['Duration', sDuration, setSDuration]].map(([label, val, setter]) => (
            <div key={String(label)}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>{String(label)}</label>
              <input style={inputStyle} value={String(val)} onChange={e => (setter as (v: string) => void)(e.target.value)} />
            </div>
          ))}
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              WP cost: 2 per power level (selected at cast time). Tricks always cost 1 WP.
            </p>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Summary</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} value={sSummary} rows={3} onChange={e => setSSummary(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setSpellDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSpellSave}>Save</Button>
          </div>
        </div>
      </Drawer>

      {/* ── Ability edit drawer ── */}
      <Drawer open={abilityDrawerOpen} onClose={() => setAbilityDrawerOpen(false)} title={editingAbility ? 'Edit Ability' : 'Add Ability'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Name</label>
            <input style={inputStyle} value={aName} onChange={e => setAName(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Summary</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} value={aSummary} rows={3} onChange={e => setASummary(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setAbilityDrawerOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAbilitySave}>Save</Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
