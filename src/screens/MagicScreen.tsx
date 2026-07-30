import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { MagicSpellCard } from '../components/fields/MagicSpellCard';
import { AbilityCard } from '../components/fields/AbilityCard';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { Drawer } from '../components/primitives/Drawer';
import { useAutosave } from '../hooks/useAutosave';
import type { Spell, HeroicAbility, TempModifier } from '../types/character';
import { generateId } from '../utils/ids';
import { nowISO } from '../utils/dates';
import { useToast } from '../context/ToastContext';
import { useIsEditMode } from '../utils/modeGuards';
import { computeMaxPreparedSpells } from '../utils/derivedValues';
import { isMetalEquipped } from '../utils/metalDetection';
import { compareSpellsByRankThenName, isMagicTrick } from '../utils/spells';
import { toSpells, toHeroicAbilities, withSpells, withHeroicAbilities } from '../utils/abilities';
import { useSystemEngine } from '../features/systems/engine';
import * as characterRepository from '../storage/repositories/characterRepository';

type PrepFilter = 'prepared' | 'grimoire';

const inputClasses = "w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] font-[family-name:inherit]";

/**
 * Spellcasting screen: the character's spells and heroic abilities, with a
 * prepared/known filter and per-spell power-level controls.
 *
 * @remarks
 * Only shown for magic-capable characters — gated on the `showCharacterMagic`
 * setting, which the engine drives. Power level is UI-only state (not persisted):
 * it scales a cast at render time without mutating the stored spell. Spell/ability
 * cards, casting cost, and the magic resource vocabulary all come from the engine so
 * the screen is ruleset-agnostic. Edits autosave on a 1s debounce.
 */
export default function MagicScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { isLoading: settingsLoading, settings, updateSettings } = useAppState();
  const engine = useSystemEngine();
  const showMagic = settings.showCharacterMagic === true;
  const isEditMode = useIsEditMode();
  const { showToast } = useToast();
  useAutosave(character, characterRepository.save, 1000);

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
  const [sRank, setSRank] = useState('1');
  const [sRequirements, setSRequirements] = useState('');
  const [sCastingTime, setSCastingTime] = useState<NonNullable<Spell['castingTime']>>('action');
  const [sRange, setSRange] = useState('');
  const [sDuration, setSDuration] = useState('');
  const [sSummary, setSSummary] = useState('');
  const [sPowerScaling, setSPowerScaling] = useState<[string, string, string]>(['', '', '']);

  // Ability form state
  const [aName, setAName] = useState('');
  const [aSummary, setASummary] = useState('');

  useEffect(() => {
    if (spellDrawerOpen && editingSpell) {
      setSName(editingSpell.name); setSSchool(editingSpell.school);
      setSRank(String(editingSpell.rank ?? (isMagicTrick(editingSpell) ? 0 : editingSpell.powerLevel ?? 1)));
      setSRequirements(editingSpell.requirements?.join(', ') ?? '');
      setSCastingTime(editingSpell.castingTime ?? 'action');
      setSRange(editingSpell.range); setSDuration(editingSpell.duration);
      setSSummary(editingSpell.summary);
      setSPowerScaling(editingSpell.powerScaling ?? ['', '', '']);
    } else if (spellDrawerOpen && !editingSpell) {
      setSName(''); setSSchool(''); setSRank('1'); setSRequirements(''); setSCastingTime('action'); setSRange(''); setSDuration(''); setSSummary(''); setSPowerScaling(['', '', '']);
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
    const stillLoading = settingsLoading || isLoading;
    const waitingForCharacter = !settingsLoading && !isLoading && !!settings.activeCharacterId && !character;
    if (!stillLoading && !waitingForCharacter && !character) {
      navigate('/library');
    }
  }, [settingsLoading, isLoading, settings.activeCharacterId, character, navigate]);

  const stillLoading = settingsLoading || isLoading;
  const waitingForCharacter = !settingsLoading && !isLoading && !!settings.activeCharacterId && !character;

  if (stillLoading || waitingForCharacter) return <div className="p-[var(--space-md)] text-[var(--color-text)]">Loading...</div>;
  if (!character) return null;

  // User-facing vocabulary comes from the active system's engine. Systems
  // without a dedicated abilities screen label fall back to their term for
  // abilities so the heading is never blank.
  const screenTitle = engine.labels.abilitiesScreen ?? engine.terms.abilities;
  const abilitiesTerm = engine.terms.abilities;
  const spellsTerm = engine.terms.spells;
  const magicResourceTerm = engine.terms.magicResource;

  if (!engine.hasMagic) {
    return (
      <div className="p-[var(--space-md)]">
        <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)] mb-[var(--space-md)]">
          {screenTitle}
        </h1>
        <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-md)]">
          Magic is not available in this system.
        </p>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────
  // Storage is one unified `abilities` collection; this screen still thinks in
  // spells and heroic abilities, so it reads through the typed projections.
  const allSpells = toSpells(character.abilities);
  const heroicAbilities = toHeroicAbilities(character.abilities);
  const maxPrepared = computeMaxPreparedSpells(character);
  const preparedCount = allSpells.filter(s => s.prepared && !isMagicTrick(s)).length;
  const metalBlocked = isMetalEquipped(character);
  // The pool spent on casting comes from `engine.magic.resourceId`; it is not
  // assumed to be `wp`. Reading `resources.wp` directly meant any system whose
  // magic resource is named anything else showed 0 available and could never
  // cast. `engine.hasMagic` is already true here, so `magic` is non-null, but
  // the fallback keeps this honest if the two ever disagree.
  const magicResourceId = engine.magic?.resourceId ?? 'wp';
  const currentMagicResource = character.resources?.[magicResourceId]?.current ?? 0;
  // Dragonbane's economy is the fallback, matching what the screen hardcoded
  // before, so a system that declares `hasMagic` without a `magic` model keeps
  // working rather than rendering a card with no power levels.
  const magicModel = engine.magic ?? { powerLevels: [1, 2, 3], costPerLevel: 2, trickCost: 1 };
  const overLimit = preparedCount > maxPrepared;

  const visibleSpells = (filter === 'prepared'
    ? allSpells.filter(s => s.prepared === true || isMagicTrick(s))
    : allSpells
  ).slice().sort(compareSpellsByRankThenName);

  // ── Handlers ──────────────────────────────────────────────────────
  function handleTogglePrepare(spell: Spell) {
    const spells = toSpells(character!.abilities).map(s =>
      s.id === spell.id ? { ...s, prepared: !s.prepared } : s
    );
    updateCharacter({ abilities: withSpells(character!.abilities, spells), updatedAt: nowISO() });
  }

  function handleSpellSave() {
    const rank = Number.parseInt(sRank, 10);
    const normalizedRank = Number.isFinite(rank) ? Math.max(0, rank) : undefined;
    const requirements = sRequirements
      .split(/[\n,]/)
      .map(req => req.trim())
      .filter(Boolean);
    const powerScaling = sPowerScaling.some(text => text.trim())
      ? sPowerScaling.map(text => text.trim()) as [string, string, string]
      : undefined;
    const spell: Spell = editingSpell
      ? {
          ...editingSpell,
          name: sName,
          school: sSchool,
          rank: normalizedRank,
          requirements,
          castingTime: sCastingTime,
          range: sRange,
          duration: sDuration,
          summary: sSummary,
          powerScaling,
        }
      : {
          id: generateId(),
          name: sName,
          school: sSchool,
          powerLevel: 1,
          rank: normalizedRank ?? 1,
          requirements,
          castingTime: sCastingTime,
          // One power level's worth in this system, not a hardcoded 2 (which
          // was Dragonbane's cost for a level-1 spell).
          wpCost: magicModel.costPerLevel,
          range: sRange,
          duration: sDuration,
          summary: sSummary,
          powerScaling,
        };
    const current = toSpells(character!.abilities);
    const spells = editingSpell ? current.map(s => s.id === spell.id ? spell : s) : [...current, spell];
    updateCharacter({ abilities: withSpells(character!.abilities, spells), updatedAt: nowISO() });
    setSpellDrawerOpen(false);
  }

  function handleSpellDelete(id: string) {
    const spells = toSpells(character!.abilities).filter(s => s.id !== id);
    updateCharacter({ abilities: withSpells(character!.abilities, spells), updatedAt: nowISO() });
  }

  function handleAbilitySave() {
    const ability: HeroicAbility = editingAbility
      ? {
          ...editingAbility,
          name: aName,
          summary: aSummary,
        }
      : {
          id: generateId(),
          name: aName,
          summary: aSummary,
        };
    const current = toHeroicAbilities(character!.abilities);
    const nextHeroic = editingAbility
      ? current.map(a => a.id === ability.id ? ability : a)
      : [...current, ability];
    updateCharacter({
      abilities: withHeroicAbilities(character!.abilities, nextHeroic),
      updatedAt: nowISO(),
    });
    setAbilityDrawerOpen(false);
  }

  function handleAbilityDelete(id: string) {
    const nextHeroic = toHeroicAbilities(character!.abilities).filter(a => a.id !== id);
    updateCharacter({
      abilities: withHeroicAbilities(character!.abilities, nextHeroic),
      updatedAt: nowISO(),
    });
  }

  function handleCastSpell(spell: Spell, cost: number) {
    if (!character) return;
    // Spend from the engine's declared magic pool rather than a literal `wp`,
    // so a system that names its pool anything else can actually cast.
    const pool = character.resources[magicResourceId];
    if (!pool || pool.current < cost) {
      showToast(`Not enough ${magicResourceTerm} to cast this spell.`, 'error');
      return;
    }
    const updates: Record<string, unknown> = {
      resources: {
        ...character.resources,
        [magicResourceId]: { ...pool, current: pool.current - cost },
      },
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
      showToast(`Cast ${spell.name} (${cost} ${magicResourceTerm}) — effects applied!`, 'success');
    } else {
      showToast(`Cast ${spell.name} (${cost} ${magicResourceTerm})`, 'success');
    }
    updateCharacter(updates);
  }

  return (
    <div className="p-[var(--space-md)]">
      {/* ── Page header with prepared counter + show-magic toggle ── */}
      <div className="flex items-center justify-between mb-[var(--space-sm)] flex-wrap gap-[var(--space-sm)]">
        <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)] m-0">
          {screenTitle}
        </h1>
        <div className="flex items-center gap-[var(--space-md)]">
          {showMagic && (
            <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] font-bold">
              {preparedCount}/{maxPrepared} Prepared
            </span>
          )}
          <label className="flex items-center gap-2 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMagic}
              onChange={e => updateSettings({ showCharacterMagic: e.target.checked }).catch(console.error)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Show Magic
          </label>
        </div>
      </div>

      {/* ── Over-limit warning (spells only) ── */}
      {showMagic && overLimit && (
        <div className="bg-[color-mix(in_srgb,var(--color-warning,#e67e22)_15%,transparent)] border border-[var(--color-warning,#e67e22)] rounded-[var(--radius-sm)] px-[var(--space-md)] py-[var(--space-sm)] mb-[var(--space-sm)] text-[length:var(--font-size-sm)] text-[var(--color-text)]">
          ⚠ You have {preparedCount} prepared but can only hold {maxPrepared}. Please unprepare {preparedCount - maxPrepared} spell{preparedCount - maxPrepared !== 1 ? 's' : ''}.
        </div>
      )}

      {/* ── Metal warning banner (spells only) ── */}
      {showMagic && metalBlocked && (
        <div className="bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] border border-[var(--color-danger)] rounded-[var(--radius-sm)] px-[var(--space-md)] py-[var(--space-sm)] mb-[var(--space-sm)] text-[length:var(--font-size-sm)] text-[var(--color-text)]">
          ⚠ Metal equipment equipped — spellcasting is impaired!
        </div>
      )}

      {/* ── Filter tabs: Prepared | Grimoire (spells only) ── */}
      {showMagic && (
        <div className="flex gap-[var(--space-1)] mb-[var(--space-md)]">
          {(['prepared', 'grimoire'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "px-4 py-1.5 rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] font-semibold transition-colors",
                filter === tab
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              )}
              onClick={() => setFilter(tab)}
            >
              {tab === 'prepared' ? 'Prepared' : 'Grimoire'}
            </button>
          ))}
        </div>
      )}

      {/* ── Abilities section (always shown — this is the primary
             content for non-casters and the default view) ── */}
      <SectionPanel title={abilitiesTerm} collapsible defaultOpen>
        <div className="flex justify-end mb-[var(--space-sm)]">
          {isEditMode && <Button size="sm" variant="primary" onClick={() => { setEditingAbility(null); setAbilityDrawerOpen(true); }}>+ Add Ability</Button>}
        </div>
        {heroicAbilities.length === 0 && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No heroic abilities yet.</p>}
        <div className="flex flex-col gap-[var(--space-md)]">
          {heroicAbilities.map(a => <AbilityCard key={a.id} ability={a} onEdit={() => { setEditingAbility(a); setAbilityDrawerOpen(true); }} onDelete={() => handleAbilityDelete(a.id)} isEditMode={isEditMode} />)}
        </div>
      </SectionPanel>

      {/* ── Spells section (hidden unless "Show Magic" is toggled on) ── */}
      {showMagic && (
      <SectionPanel title={spellsTerm} collapsible defaultOpen>
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
              currentResource={currentMagicResource}
              magic={magicModel}
              resourceTerm={magicResourceTerm}
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
      )}

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
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Rank</label>
            <input className={inputClasses} type="number" min={0} step={1} value={sRank} onChange={e => setSRank(e.target.value)} />
          </div>
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Prerequisites</label>
            <input className={inputClasses} value={sRequirements} onChange={e => setSRequirements(e.target.value)} placeholder="Any School of Magic" />
          </div>
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Casting Time</label>
            <select className={inputClasses} value={sCastingTime} onChange={e => setSCastingTime(e.target.value as NonNullable<Spell['castingTime']>)}>
              <option value="action">Action</option>
              <option value="reaction">Reaction</option>
              <option value="ritual">Ritual</option>
            </select>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
              {magicResourceTerm} cost: 2 per power level (selected at cast time). Tricks always cost 1 {magicResourceTerm}.
            </p>
          </div>
          <div>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Power Level Effects</label>
            <div className="flex flex-col gap-[var(--space-sm)]">
              {([0, 1, 2] as const).map(index => (
                <input
                  key={index}
                  className={inputClasses}
                  value={sPowerScaling[index]}
                  onChange={e => setSPowerScaling(prev => {
                    const next: [string, string, string] = [...prev];
                    next[index] = e.target.value;
                    return next;
                  })}
                  placeholder={`Power level ${index + 1} effect`}
                />
              ))}
            </div>
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
