import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { SpellCard } from '../components/fields/SpellCard';
import { AbilityCard } from '../components/fields/AbilityCard';
import { FilterBar } from '../components/fields/FilterBar';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { Drawer } from '../components/primitives/Drawer';
import type { Spell, HeroicAbility } from '../types/character';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { useIsEditMode } from '../utils/modeGuards';

type SpellFilter = 'all' | 'can-cast';

export default function MagicScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const isEditMode = useIsEditMode();
  const [spellFilter, setSpellFilter] = useState<SpellFilter>('all');
  const [spellDrawerOpen, setSpellDrawerOpen] = useState(false);
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const [abilityDrawerOpen, setAbilityDrawerOpen] = useState(false);
  const [editingAbility, setEditingAbility] = useState<HeroicAbility | null>(null);

  // Spell form state
  const [sName, setSName] = useState('');
  const [sSchool, setSSchool] = useState('');
  const [sPowerLevel, setSPowerLevel] = useState(1);
  const [sWpCost, setSWpCost] = useState(0);
  const [sRange, setSRange] = useState('');
  const [sDuration, setSDuration] = useState('');
  const [sSummary, setSSummary] = useState('');

  // Ability form state
  const [aName, setAName] = useState('');
  const [aSummary, setASummary] = useState('');

  useEffect(() => {
    if (spellDrawerOpen && editingSpell) {
      setSName(editingSpell.name); setSSchool(editingSpell.school); setSPowerLevel(editingSpell.powerLevel);
      setSWpCost(editingSpell.wpCost); setSRange(editingSpell.range); setSDuration(editingSpell.duration);
      setSSummary(editingSpell.summary);
    } else if (spellDrawerOpen && !editingSpell) {
      setSName(''); setSSchool(''); setSPowerLevel(1); setSWpCost(0); setSRange(''); setSDuration(''); setSSummary('');
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

  const currentWP = character.resources['wp']?.current ?? 0;
  const visibleSpells = spellFilter === 'can-cast'
    ? character.spells.filter(s => s.wpCost <= currentWP)
    : character.spells;

  function handleSpellSave() {
    if (!character) return;
    const spell: Spell = { id: editingSpell?.id ?? generateId(), name: sName, school: sSchool, powerLevel: sPowerLevel, wpCost: sWpCost, range: sRange, duration: sDuration, summary: sSummary };
    const spells = editingSpell ? character.spells.map(s => s.id === spell.id ? spell : s) : [...character.spells, spell];
    updateCharacter({ spells, updatedAt: nowISO() });
    setSpellDrawerOpen(false);
  }

  function handleSpellDelete(id: string) {
    if (!character) return;
    updateCharacter({ spells: character.spells.filter(s => s.id !== id), updatedAt: nowISO() });
  }

  function handleAbilitySave() {
    if (!character) return;
    const ability: HeroicAbility = { id: editingAbility?.id ?? generateId(), name: aName, summary: aSummary };
    const heroicAbilities = editingAbility ? character.heroicAbilities.map(a => a.id === ability.id ? ability : a) : [...character.heroicAbilities, ability];
    updateCharacter({ heroicAbilities, updatedAt: nowISO() });
    setAbilityDrawerOpen(false);
  }

  function handleAbilityDelete(id: string) {
    if (!character) return;
    updateCharacter({ heroicAbilities: character.heroicAbilities.filter(a => a.id !== id), updatedAt: nowISO() });
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 'var(--font-size-md)', fontFamily: 'inherit' };

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <h1 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)', marginBottom: 'var(--space-md)' }}>Magic</h1>

      <SectionPanel title="Spells" collapsible defaultOpen>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <FilterBar filters={[{ id: 'all', label: 'All Spells' }, { id: 'can-cast', label: 'Can Cast' }]} activeFilter={spellFilter} onFilterChange={id => setSpellFilter(id as SpellFilter)} />
          {isEditMode && <Button size="sm" variant="primary" onClick={() => { setEditingSpell(null); setSpellDrawerOpen(true); }}>+ Add Spell</Button>}
        </div>
        {visibleSpells.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No spells yet. {isEditMode ? 'Add a spell above.' : 'Switch to Edit Mode to add spells.'}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {visibleSpells.map(spell => <SpellCard key={spell.id} spell={spell} onEdit={() => { setEditingSpell(spell); setSpellDrawerOpen(true); }} onDelete={() => handleSpellDelete(spell.id)} isEditMode={isEditMode} />)}
        </div>
      </SectionPanel>

      <SectionPanel title="Heroic Abilities" collapsible defaultOpen>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-sm)' }}>
          {isEditMode && <Button size="sm" variant="primary" onClick={() => { setEditingAbility(null); setAbilityDrawerOpen(true); }}>+ Add Ability</Button>}
        </div>
        {character.heroicAbilities.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No heroic abilities yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {character.heroicAbilities.map(a => <AbilityCard key={a.id} ability={a} onEdit={() => { setEditingAbility(a); setAbilityDrawerOpen(true); }} onDelete={() => handleAbilityDelete(a.id)} isEditMode={isEditMode} />)}
        </div>
      </SectionPanel>

      <Drawer open={spellDrawerOpen} onClose={() => setSpellDrawerOpen(false)} title={editingSpell ? 'Edit Spell' : 'Add Spell'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {[['Name', sName, setSName], ['School', sSchool, setSSchool], ['Range', sRange, setSRange], ['Duration', sDuration, setSDuration]].map(([label, val, setter]) => (
            <div key={String(label)}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>{String(label)}</label>
              <input style={inputStyle} value={String(val)} onChange={e => (setter as (v: string) => void)(e.target.value)} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Power Level</label>
              <input type="number" style={inputStyle} value={sPowerLevel} min={1} onChange={e => setSPowerLevel(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>WP Cost</label>
              <input type="number" style={inputStyle} value={sWpCost} min={0} onChange={e => setSWpCost(Number(e.target.value))} />
            </div>
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
