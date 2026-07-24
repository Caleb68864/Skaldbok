import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Ellipsis, Plus } from 'lucide-react';
import { Drawer } from '../../components/primitives/Drawer';
import { useNoteActions } from '../notes/useNoteActions';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import { useSessionEncounterContextSafe } from './SessionEncounterContext';
import { AttachToControl, resolveAttach, type AttachToValue } from './quickActions/AttachToControl';
import { QuickNoteAction } from './quickActions/QuickNoteAction';
import { QuickNpcAction } from './quickActions/QuickNpcAction';
import { QuickLogPCTray } from './quickLog/QuickLogPCTray';
import { getById as getCharacterById, save as saveCharacter } from '../../storage/repositories/characterRepository';
import { useSystemEngine } from '../systems/engine';
import type { OutcomeOption, RollModifierOption } from '../systems/engine/types';
import { useSystemDefinition } from '../systems/useSystemDefinition';
import { DEFAULT_SYSTEM_ID } from '../../systems/registry';
import type { CharacterRecord } from '../../types/character';
import { toSpells, toHeroicAbilities } from '../../utils/abilities';
import type { PartyMember } from '../../types/party';
import { getNotesByCampaign } from '../../storage/repositories/noteRepository';
import type { Note } from '../../types/note';
import { PartyPicker } from '../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../components/fields/PartyPicker';
import { CounterControl } from '../../components/primitives/CounterControl';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

// ── System Data ──────────────────────────────────────────────
//
// Skills and conditions are read from the active `SystemDefinition` (see the
// `skillNames` / `conditions` memos below) rather than hardcoded here, so a
// non-Dragonbane ruleset shows its own vocabulary.

const REST_TYPES = [
  { name: 'Round Rest', effect: 'Recover D6 WP' },
  { name: 'Stretch Rest', effect: 'Heal D6 HP, D6 WP, heal one condition' },
  { name: 'Shift Rest', effect: 'Recover all HP, WP, and conditions' },
] as const;

const TAG_OPTIONS = [
  'combat', 'exploration', 'social', 'mystery',
  'tense', 'funny', 'dramatic', 'sad', 'victorious',
  'important',
] as const;

// ── Styles (now Tailwind classes) ──────────────────────────────

const chipClasses = 'min-h-11 px-4 py-1.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-full text-[var(--color-text)] cursor-pointer text-sm font-semibold shrink-0';

const listBtnClasses = 'block w-full text-left py-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base';

const resultChipClasses = 'min-h-11 min-w-11 px-4 border-none rounded-lg cursor-pointer text-sm font-semibold';

// ── Outcome / modifier presentation ─────────────────────────────
//
// Which outcomes and modifiers exist is engine data; only how a tone is
// painted lives here.

const NEUTRAL_RESULT_CLASSES = 'bg-[var(--color-surface-raised)] text-[var(--color-text)]';

const OUTCOME_TONE_CLASSES: Record<string, string> = {
  success: 'bg-[#27ae60] text-white',
  failure: NEUTRAL_RESULT_CLASSES,
  critical: 'bg-[var(--color-accent)] text-white',
  fumble: 'bg-[#c0392b] text-white',
};

function outcomeToneClasses(outcome: OutcomeOption): string {
  return (outcome.tone && OUTCOME_TONE_CLASSES[outcome.tone]) || NEUTRAL_RESULT_CLASSES;
}

const MODIFIER_ACTIVE_COLORS: Record<string, string> = {
  boon: '#27ae60',
  bane: '#c0392b',
  pushed: '#8e44ad',
};

/**
 * Modifiers that only make sense when the system has a boon/bane advantage
 * axis; dropped when `engine.skill.supportsBoonBane` is false.
 */
const BOON_BANE_MODIFIER_IDS = new Set(['boon', 'bane']);

// ── Roll Modifiers ──────────────────────────────────────────────

function RollModifiers({
  options,
  mods,
  onToggle,
}: {
  options: RollModifierOption[];
  mods: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
        Modifiers
      </p>
      <div className="flex gap-2 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => onToggle(opt.id)}
            className={cn(
              chipClasses,
              mods[opt.id]
                ? `bg-[${MODIFIER_ACTIVE_COLORS[opt.id] ?? 'var(--color-accent)'}] text-white`
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div className="mb-2.5">
      <p className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-wide mb-1">
        Tags
      </p>
      <div className="flex gap-2 flex-wrap">
        {TAG_OPTIONS.map(tag => (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className={cn(
              'min-h-11 min-w-11 px-2.5 py-1 rounded-2xl border-none cursor-pointer text-xs font-semibold',
              selected.includes(tag)
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
            )}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

/** ` (Boon, Pushed)` — labels and order come from the engine's modifier list. */
function formatModTags(mods: Record<string, boolean>, options: RollModifierOption[]): string {
  const tags = options.filter(opt => mods[opt.id]).map(opt => opt.label);
  return tags.length > 0 ? ` (${tags.join(', ')})` : '';
}

// ── Main Component ──────────────────────────────────────────────

interface SessionQuickActionsProps {
  onLogComplete?: () => void;
  preferredAttachTo?: AttachToValue;
  contextLabel?: string | null;
  requestedAction?: string | null;
  requestNonce?: number;
}

export function SessionQuickActions({
  onLogComplete,
  preferredAttachTo = 'auto',
  contextLabel,
  requestedAction,
  requestNonce,
}: SessionQuickActionsProps) {
  const { createNote } = useNoteActions();
  const { character } = useActiveCharacter();
  const { activeCampaign, activeParty, activeCharacterInCampaign } = useCampaignContext();
  const { showToast } = useToast();
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const engine = useSystemEngine();
  const { system } = useSystemDefinition(character?.systemId ?? DEFAULT_SYSTEM_ID);

  /** Flat list of every skill the active system defines. */
  const skillNames = useMemo(
    () => system?.skillCategories.flatMap(c => c.skills.map(s => s.name)) ?? [],
    [system],
  );

  /** Conditions the active system defines, with their linked-attribute badge. */
  const conditions = useMemo(
    () =>
      (system?.conditions ?? []).map(c => ({
        name: c.name,
        attr:
          system?.attributes.find(a => a.id === c.linkedAttributeId)?.abbreviation
          ?? c.linkedAttributeId.toUpperCase(),
      })),
    [system],
  );

  /** Outcome buttons offered for any roll, in engine-declared order. */
  const outcomeOptions = engine.outcomes;

  /**
   * Modifier chips for this system. Boon/Bane are dropped when the system has
   * no advantage axis; everything else the engine declares is shown as-is.
   */
  const modifierOptions = useMemo(
    () =>
      engine.skill.supportsBoonBane
        ? engine.rollModifiers
        : engine.rollModifiers.filter(m => !BOON_BANE_MODIFIER_IDS.has(m.id)),
    [engine],
  );

  const supportsRest = engine.panels.includes('rest');
  const supportsDeathRoll = engine.panels.includes('death');
  const healthResourceId = engine.primaryHealthResourceId;
  const healthLabel = engine.terms.healthResource;

  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);
  const [attachTo, setAttachTo] = useState<AttachToValue>('auto');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedSpell, setSelectedSpell] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [resolvedMembers, setResolvedMembers] = useState<ResolvedMember[]>([]);
  const [lootName, setLootName] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [rumorText, setRumorText] = useState('');
  const [rumorSource, setRumorSource] = useState('');
  const [npcNotes, setNpcNotes] = useState<Note[]>([]);
  /** Active roll modifiers, keyed by `RollModifierOption.id`. */
  const [rollMods, setRollMods] = useState<Record<string, boolean>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [shopItem, setShopItem] = useState('');
  const [shopAction, setShopAction] = useState<'buy' | 'sell'>('buy');
  const [shopGold, setShopGold] = useState(0);
  const [shopSilver, setShopSilver] = useState(0);
  const [shopCopper, setShopCopper] = useState(0);
  const [shopQuantity, setShopQuantity] = useState(1);

  const openAction = useCallback((actionId: string) => {
    setAttachTo(actionId === 'loot' ? null : preferredAttachTo);
    setActiveDrawer(actionId);
  }, [preferredAttachTo]);

  // Resolve party member names from linked characters
  useEffect(() => {
    const members = activeParty?.members ?? [];
    if (members.length === 0) {
      // Fallback: use active character if available
      if (character) {
        setResolvedMembers([{ id: '__self__', name: character.name, character }]);
        setSelectedMembers(['__self__']);
      }
      return;
    }

    let mounted = true;
    Promise.all(
      members.map(async (m: PartyMember) => {
        if (m.linkedCharacterId) {
          const char = await getCharacterById(m.linkedCharacterId);
          if (char) return { id: m.id, name: char.name, character: char };
        }
        return { id: m.id, name: m.name ?? 'Unknown', character: null };
      })
    ).then(results => {
      if (!mounted) return;
      setResolvedMembers(results);
      // Default: select active character's member, or first member
      const activeId = activeCharacterInCampaign?.id;
      if (activeId && results.some(r => r.id === activeId)) {
        setSelectedMembers([activeId]);
      } else if (results.length > 0) {
        setSelectedMembers([results[0].id]);
      }
    });
    return () => { mounted = false; };
  }, [activeParty, character, activeCharacterInCampaign]);

  // Load NPC notes for rumor source picker
  useEffect(() => {
    if (activeDrawer !== 'rumor' || !activeCampaign) return;
    let mounted = true;
    getNotesByCampaign(activeCampaign.id).then(notes => {
      if (mounted) setNpcNotes(notes.filter(n => n && n.type === 'npc') as Note[]);
    });
    return () => { mounted = false; };
  }, [activeDrawer, activeCampaign]);

  // Re-select active character when a drawer opens (AC2.2)
  useEffect(() => {
    if (!activeDrawer) return;
    const activeId = activeCharacterInCampaign?.id;
    if (activeId && resolvedMembers.some(r => r.id === activeId)) {
      setSelectedMembers([activeId]);
    } else if (character && resolvedMembers.length === 0) {
      setSelectedMembers(['__self__']);
    } else if (resolvedMembers.length > 0) {
      setSelectedMembers([resolvedMembers[0].id]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDrawer]);

  const close = () => {
    setActiveDrawer(null);
    setSelectedSkill(null);
    setSelectedSpell(null);
    setLootName('');
    setQuoteText('');
    setRumorText('');
    setRumorSource('');
    setRollMods({});
    setSelectedTags([]);
    setShopItem('');
    setShopAction('buy');
    setShopGold(0);
    setShopSilver(0);
    setShopCopper(0);
    setShopQuantity(1);
    setAttachTo(preferredAttachTo);
  };

  useEffect(() => {
    setAttachTo(preferredAttachTo);
  }, [preferredAttachTo]);

  useEffect(() => {
    if (!requestedAction) {
      return;
    }

    openAction(requestedAction);
  }, [openAction, requestNonce, requestedAction]);

  /**
   * Fires the Sub-Spec 8 success toast: "Logged to {encounter}" when attached
   * to a specific encounter (auto + active, or explicit id), or "Logged to
   * session" when session-only.
   */
  const fireQuickLogToast = (currentAttach: AttachToValue) => {
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
  };

  // Get display name for selected members
  const selectedNames = (): string => {
    if (selectedMembers.length === 0) return character?.name ?? 'Unknown';
    if (selectedMembers.length === resolvedMembers.length && resolvedMembers.length > 1) return 'Party';
    return selectedMembers
      .map(id => resolvedMembers.find(m => m.id === id)?.name ?? 'Unknown')
      .join(', ');
  };

  // Get character record for first selected member (for spells/abilities)
  const selectedCharacter = (): CharacterRecord | null => {
    if (selectedMembers.length === 0) return character ?? null;
    const member = resolvedMembers.find(m => m.id === selectedMembers[0]);
    return member?.character ?? character ?? null;
  };

  const logEvent = async (type: string, title: string, typeData: Record<string, unknown>) => {
    const who = selectedNames();
    const fullTitle = who ? `${who}: ${title}` : title;
    const currentAttach = attachTo;
    const createdNote = await createNote(
      {
        title: fullTitle,
        type: type as 'skill-check' | 'generic' | 'loot' | 'quote' | 'rumor',
        body: null,
        pinned: false,
        status: 'active',
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        typeData,
      },
      { targetEncounterId: resolveAttach(currentAttach) },
    );
    if (!createdNote) {
      return;
    }
    fireQuickLogToast(currentAttach);
    onLogComplete?.();
    close();
  };

  // ── Skill Check Flow ──────────────────────────────────────────

  const renderSkillPicker = () => {
    if (selectedSkill) {
      const modTag = formatModTags(rollMods, modifierOptions);
      return (
        <div>
          <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
          <p className="text-[var(--color-text)] font-semibold mb-3 text-base">
            {selectedSkill}{modTag}
          </p>
          <RollModifiers
            options={modifierOptions}
            mods={rollMods}
            onToggle={id => setRollMods(m => ({ ...m, [id]: !m[id] }))}
          />
          <div className="grid grid-cols-2 gap-2">
            {outcomeOptions.map(outcome => (
              <button
                key={outcome.id}
                onClick={() => logEvent('skill-check', `${selectedSkill}${formatModTags(rollMods, modifierOptions)} — ${outcome.id}`, {
                  skill: selectedSkill,
                  result: outcome.id,
                  character: selectedNames(),
                })}
                className={cn(resultChipClasses, outcomeToneClasses(outcome))}
              >
                {outcome.label}
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
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        {charSkills.length > 0 && (
          <>
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
              {selectedNames()}'s Skills
            </p>
            {charSkills.map(skill => (
              <button key={`char-${skill}`} onClick={() => setSelectedSkill(skill)} className={listBtnClasses}>
                {skill}
              </button>
            ))}
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mt-3 mb-1">
              All Skills
            </p>
          </>
        )}
        {skillNames.map(skill => (
          <button key={skill} onClick={() => setSelectedSkill(skill)} className={listBtnClasses}>
            {skill}
          </button>
        ))}
      </div>
    );
  };

  // ── Spell Cast Flow ───────────────────────────────────────────

  const renderSpellPicker = () => {
    if (!engine.hasMagic) {
      return (
        <p className="text-[var(--color-text-muted)] text-sm">
          This system has no {engine.terms.spells.toLowerCase()}.
        </p>
      );
    }
    if (selectedSpell) {
      const modTag = formatModTags(rollMods, modifierOptions);
      return (
        <div>
          <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
          <p className="text-[var(--color-text)] font-semibold mb-3 text-base">
            Cast: {selectedSpell}{modTag}
          </p>
          <RollModifiers
            options={modifierOptions}
            mods={rollMods}
            onToggle={id => setRollMods(m => ({ ...m, [id]: !m[id] }))}
          />
          <div className="grid grid-cols-2 gap-2">
            {outcomeOptions.map(outcome => (
              <button
                key={outcome.id}
                onClick={() => logEvent('generic', `Cast ${selectedSpell}${formatModTags(rollMods, modifierOptions)} — ${outcome.id}`, {})}
                className={cn(resultChipClasses, outcomeToneClasses(outcome))}
              >
                {outcome.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    const char = selectedCharacter();
    const spells = toSpells(char?.abilities);
    return (
      <div>
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        {spells.length > 0 ? (
          spells.map(spell => (
            <button key={spell.id} onClick={() => setSelectedSpell(spell.name)} className={listBtnClasses}>
              <span>{spell.name}</span>
              <span className="text-[var(--color-text-muted)] text-sm ml-2">
                ({spell.wpCost} {engine.terms.magicResource})
              </span>
            </button>
          ))
        ) : (
          <p className="text-[var(--color-text-muted)] text-sm">
            No {engine.terms.spells.toLowerCase()} on {selectedNames() || 'active character'}.
          </p>
        )}
        <button
          onClick={() => {
            const name = prompt('Spell name:');
            if (name?.trim()) setSelectedSpell(name.trim());
          }}
          className={cn(listBtnClasses, 'text-[var(--color-accent)] font-semibold !border-b-0')}
        >
          + Quick-add spell
        </button>
      </div>
    );
  };

  // ── Heroic Ability Flow ───────────────────────────────────────

  const renderAbilityPicker = () => {
    if (!engine.hasMagic) {
      return (
        <p className="text-[var(--color-text-muted)] text-sm">
          This system has no {engine.terms.abilities.toLowerCase()}.
        </p>
      );
    }
    const char = selectedCharacter();
    const abilities = toHeroicAbilities(char?.abilities);
    return (
      <div>
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        {abilities.length > 0 ? (
          abilities.map(a => (
            <button
              key={a.id}
              onClick={() => logEvent('generic', `Used ${a.name}`, {})}
              className={listBtnClasses}
            >
              <span>{a.name}</span>
              {a.wpCost !== undefined && (
                <span className="text-[var(--color-text-muted)] text-sm ml-2">
                  ({a.wpCost} {engine.terms.magicResource})
                </span>
              )}
            </button>
          ))
        ) : (
          <p className="text-[var(--color-text-muted)] text-sm">
            No {engine.terms.abilities.toLowerCase()} on {selectedNames() || 'active character'}.
          </p>
        )}
      </div>
    );
  };

  // ── Condition Flow ────────────────────────────────────────────

  const renderConditionPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} multiSelect />
      {conditions.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-sm">
          This system defines no conditions.
        </p>
      )}
      {conditions.map(c => (
        <div key={c.name} className="flex gap-3 mb-2">
          <button
            onClick={() => logEvent('generic', `Gained ${c.name}`, {})}
            className={cn(listBtnClasses, 'flex-1 text-[#c0392b] !border-b-0 !py-2 font-semibold')}
          >
            + {c.name} ({c.attr})
          </button>
          <button
            onClick={() => logEvent('generic', `Healed ${c.name}`, {})}
            className={cn(listBtnClasses, 'flex-1 text-[#27ae60] !border-b-0 !py-2 font-semibold')}
          >
            - {c.name}
          </button>
        </div>
      ))}
    </div>
  );

  // ── Rest Flow ─────────────────────────────────────────────────

  const renderRestPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} multiSelect />
      {REST_TYPES.map(r => (
        <button
          key={r.name}
          onClick={() => logEvent('generic', r.name, {})}
          className={listBtnClasses}
        >
          <span className="font-semibold">{r.name}</span>
          <br />
          <span className="text-[var(--color-text-muted)] text-[13px]">{r.effect}</span>
        </button>
      ))}
    </div>
  );

  // ── Damage Flow ───────────────────────────────────────────────

  /**
   * Applies `delta` to the system's primary health resource on every selected
   * character, returning how many sheets were actually updated.
   *
   * @remarks
   * `delta` is expressed in **health terms** (negative = took damage, positive =
   * healed), independent of how the underlying resource stores it. For a depleting
   * pool (Dragonbane HP) that maps straight through: damage lowers `current`. For
   * an accumulating damage track (Traveller END, where 0 = healthy and `max` =
   * incapacitated) the storage runs the other way, so the delta is inverted — a
   * damaging delta raises the counter and healing lowers it. Without this, party
   * "Damage" would heal a Traveller and "Heal" would wound them.
   *
   * Returns 0 when the system declares no single health pool
   * (`primaryHealthResourceId === null`) or none of the selected characters
   * carry that resource — callers must not claim success in that case.
   */
  const adjustHealth = async (delta: number): Promise<number> => {
    if (!healthResourceId) return 0;
    const accumulates = engine.damageTrack != null;
    const resourceDelta = accumulates ? -delta : delta;
    let updated = 0;
    for (const memberId of selectedMembers) {
      const member = resolvedMembers.find(m => m.id === memberId);
      if (!member?.character) continue;
      const fresh = await getCharacterById(member.character.id);
      if (!fresh) continue;
      const pool = fresh.resources[healthResourceId];
      if (!pool) continue;
      const newCurrent = Math.max(0, Math.min(pool.max, pool.current + resourceDelta));
      await saveCharacter({
        ...fresh,
        resources: { ...fresh.resources, [healthResourceId]: { ...pool, current: newCurrent } },
        updatedAt: new Date().toISOString(),
      });
      updated += 1;
    }
    return updated;
  };

  const applyDamage = async (amount: number) => {
    const updated = await adjustHealth(-amount);
    if (updated === 0) {
      showToast(
        healthResourceId
          ? `No ${healthLabel} on the selected character — logged as a note only.`
          : `This system has no single ${healthLabel} pool — logged as a note only.`,
        'warning',
        3000,
      );
    }
    await logEvent('generic', `Took ${amount} damage`, { damage: amount });
  };

  const applyHealing = async (amount: number) => {
    const updated = await adjustHealth(amount);
    if (updated === 0) {
      showToast(
        healthResourceId
          ? `No ${healthLabel} on the selected character — logged as a note only.`
          : `This system has no single ${healthLabel} pool — logged as a note only.`,
        'warning',
        3000,
      );
      await logEvent('generic', `Healing ${amount} (not applied)`, { healing: amount, applied: false });
      return;
    }
    await logEvent('generic', `Healed ${amount} ${healthLabel}`, { healing: amount });
  };

  const renderDamagePicker = () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
    return (
      <div>
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        <p className="text-[var(--color-text-muted)] text-[13px] mb-2">
          Damage taken {healthResourceId ? `(updates ${healthLabel})` : '(log only)'}:
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          {values.map(v => (
            <button
              key={`t${v}`}
              onClick={() => applyDamage(v)}
              className={cn(chipClasses, 'bg-[#c0392b] text-white min-w-[50px]')}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="text-[var(--color-text-muted)] text-[13px] mb-2">
          Healing {healthResourceId ? `(updates ${healthLabel})` : '(log only)'}:
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          {values.map(v => (
            <button
              key={`h${v}`}
              onClick={() => applyHealing(v)}
              className={cn(chipClasses, 'bg-[#27ae60] text-white min-w-[50px]')}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="text-[var(--color-text-muted)] text-[13px] mb-2">Damage dealt (log only):</p>
        <div className="flex flex-wrap gap-3">
          {values.map(v => (
            <button
              key={`d${v}`}
              onClick={() => logEvent('generic', `Dealt ${v} damage`, {})}
              className={cn(chipClasses, 'bg-[var(--color-surface-raised)] text-[var(--color-text)] min-w-[50px]')}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── Loot Flow ─────────────────────────────────────────────────

  const renderLootPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
      <input
        type="text"
        placeholder="What did you find?"
        value={lootName}
        onChange={e => setLootName(e.target.value)}
        autoFocus
        className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border"
      />
      <button
        onClick={() => {
          if (lootName.trim()) {
            logEvent('loot', `Loot: ${lootName.trim()}`, { holder: selectedNames() });
            setLootName('');
          }
        }}
        disabled={!lootName.trim()}
        className={cn(
          'w-full min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer',
          !lootName.trim() ? 'opacity-60' : 'opacity-100'
        )}
      >
        Log Loot
      </button>
    </div>
  );

  // ── Camp Flow ──────────────────────────────────────────────────

  const renderCampPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} multiSelect />
      <p className="text-[var(--color-text-muted)] text-[13px] mb-2">
        What kind of camp?
      </p>
      {[
        { name: 'Make Camp', desc: 'Set up camp for the shift' },
        { name: 'Forage', desc: 'Hunt or gather food' },
        { name: 'Keep Watch', desc: 'Stand guard during rest' },
        { name: 'Cook Meal', desc: 'Prepare food for the party' },
      ].map(item => (
        <button
          key={item.name}
          onClick={() => logEvent('generic', item.name, {})}
          className={listBtnClasses}
        >
          <span className="font-semibold">{item.name}</span>
          <br />
          <span className="text-[var(--color-text-muted)] text-[13px]">{item.desc}</span>
        </button>
      ))}
    </div>
  );

  // ── Travel Flow ───────────────────────────────────────────────

  const [travelNote, setTravelNote] = useState('');

  const renderTravelPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} multiSelect />
      <p className="text-[var(--color-text-muted)] text-[13px] mb-2">
        Shifts traveled:
      </p>
      <div className="flex gap-3 flex-wrap mb-3">
        {[1, 2, 3, 4].map(shifts => (
          <button
            key={shifts}
            onClick={() => logEvent('generic', `Traveled ${shifts} shift${shifts > 1 ? 's' : ''}`, {})}
            className={cn(chipClasses, 'min-w-[70px]')}
          >
            {shifts} shift{shifts > 1 ? 's' : ''}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Destination or route (optional)"
        value={travelNote}
        onChange={e => setTravelNote(e.target.value)}
        className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-2 box-border"
      />
      {travelNote.trim() && (
        <button
          onClick={() => { logEvent('generic', `Traveled to ${travelNote.trim()}`, {}); setTravelNote(''); }}
          className="w-full min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer"
        >
          Log Travel
        </button>
      )}
    </div>
  );

  // ── Random Encounter Flow ─────────────────────────────────────

  const [encounterDesc, setEncounterDesc] = useState('');

  const renderEncounterPicker = () => (
    <div>
      <button
        onClick={() => logEvent('generic', 'Random Encounter!', {})}
        className="w-full min-h-11 bg-[#c0392b] text-white border-none rounded-lg text-base font-semibold cursor-pointer mb-3"
      >
        Log Random Encounter
      </button>
      <input
        type="text"
        placeholder="What was it? (optional)"
        value={encounterDesc}
        onChange={e => setEncounterDesc(e.target.value)}
        className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-2 box-border"
      />
      {encounterDesc.trim() && (
        <button
          onClick={() => { logEvent('generic', `Encounter: ${encounterDesc.trim()}`, {}); setEncounterDesc(''); }}
          className="w-full min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer"
        >
          Log with Description
        </button>
      )}
    </div>
  );

  // ── Death Roll Flow ───────────────────────────────────────────

  const renderDeathRollPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
      <p className="text-[var(--color-text-muted)] text-[13px] mb-2">
        Death Roll result:
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => logEvent('generic', 'Death Roll — Survived', {})}
          className={cn(resultChipClasses, 'bg-[#27ae60] text-white')}
        >
          Survived
        </button>
        <button
          onClick={() => logEvent('generic', 'Death Roll — Failed', {})}
          className={cn(resultChipClasses, 'bg-[#c0392b] text-white')}
        >
          Failed
        </button>
        <button
          onClick={() => logEvent('generic', 'Death Roll — Dragon (1)', {})}
          className={cn(resultChipClasses, 'bg-[var(--color-accent)] text-white')}
        >
          Dragon (1)
        </button>
        <button
          onClick={() => logEvent('generic', 'Death Roll — Dead', {})}
          className={cn(resultChipClasses, 'bg-[#2c3e50] text-white')}
        >
          Dead
        </button>
      </div>
    </div>
  );

  // ── Quick Quote Flow ───────────────────────────────────────────

  const renderQuotePicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
      <p className="text-[var(--color-text-muted)] text-[13px] mb-2">
        Who said it? (selected above) — or type an NPC name:
      </p>
      <input
        type="text"
        placeholder="What did they say?"
        value={quoteText}
        onChange={e => setQuoteText(e.target.value)}
        autoFocus
        className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border italic"
      />
      <button
        onClick={() => {
          if (quoteText.trim()) {
            logEvent('quote', `"${quoteText.trim()}"`, { speaker: selectedNames() });
            setQuoteText('');
          }
        }}
        disabled={!quoteText.trim()}
        className={cn(
          'w-full min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer',
          !quoteText.trim() ? 'opacity-60' : 'opacity-100'
        )}
      >
        Log Quote
      </button>
    </div>
  );

  // ── Rumor Flow ────────────────────────────────────────────────

  const renderRumorPicker = () => (
    <div>
      <input
        type="text"
        placeholder="What's the rumor?"
        value={rumorText}
        onChange={e => setRumorText(e.target.value)}
        autoFocus
        className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border"
      />
      <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
        Source (optional)
      </p>
      <div className="flex gap-3 flex-wrap mb-3">
        <button
          onClick={() => setRumorSource('')}
          className={cn(
            chipClasses,
            rumorSource === ''
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
              : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
          )}
        >
          Unknown
        </button>
        {npcNotes.map(npc => (
          <button
            key={npc.id}
            onClick={() => setRumorSource(npc.title)}
            className={cn(
              chipClasses,
              rumorSource === npc.title
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
            )}
          >
            {npc.title}
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          if (rumorText.trim()) {
            const src = rumorSource || undefined;
            logEvent('rumor', `Rumor: ${rumorText.trim()}`, { source: src, threadStatus: 'open' });
            setRumorText('');
            setRumorSource('');
          }
        }}
        disabled={!rumorText.trim()}
        className={cn(
          'w-full min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer',
          !rumorText.trim() ? 'opacity-60' : 'opacity-100'
        )}
      >
        Log Rumor
      </button>
    </div>
  );

  // ── Shopping Flow ──────────────────────────────────────────────

  const renderShoppingPicker = () => {
    const totalGold = shopGold * shopQuantity;
    const totalSilver = shopSilver * shopQuantity;
    const totalCopper = shopCopper * shopQuantity;
    const hasAnyCoin = shopGold > 0 || shopSilver > 0 || shopCopper > 0;
    const totalStr = hasAnyCoin
      ? [
          totalGold > 0 ? `${totalGold}g` : '',
          totalSilver > 0 ? `${totalSilver}s` : '',
          totalCopper > 0 ? `${totalCopper}c` : '',
        ].filter(Boolean).join(' ')
      : '';

    return (
      <div>
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        <div className="flex gap-3 mb-3">
          <button
            onClick={() => setShopAction('buy')}
            className={cn(
              chipClasses, 'flex-1',
              shopAction === 'buy'
                ? 'bg-[#27ae60] text-white'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setShopAction('sell')}
            className={cn(
              chipClasses, 'flex-1',
              shopAction === 'sell'
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
            )}
          >
            Sell
          </button>
        </div>
        <input
          type="text"
          placeholder="Item name (optional)"
          value={shopItem}
          onChange={e => setShopItem(e.target.value)}
          autoFocus
          className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border"
        />
        <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
          Cost per item
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <CounterControl label="Gold" value={shopGold} min={0} onChange={setShopGold} />
          <CounterControl label="Silver" value={shopSilver} min={0} onChange={setShopSilver} />
          <CounterControl label="Copper" value={shopCopper} min={0} onChange={setShopCopper} />
          <CounterControl label="Qty" value={shopQuantity} min={1} onChange={setShopQuantity} />
        </div>
        {hasAnyCoin && shopQuantity > 1 && (
          <p className="text-[var(--color-text-muted)] text-sm mb-3">
            Total: {totalStr}
          </p>
        )}
        <button
          onClick={() => {
            const verb = shopAction === 'buy' ? 'Bought' : 'Sold';
            const itemPart = shopItem.trim() ? ` ${shopItem.trim()}` : '';
            const coinPart = totalStr ? ` for ${totalStr}` : '';
            const qtyPart = shopQuantity > 1 ? ` ×${shopQuantity}` : '';
            logEvent('generic', `${verb}${itemPart}${qtyPart}${coinPart}`, {
              action: shopAction,
              item: shopItem.trim() || undefined,
              quantity: shopQuantity,
              costGold: shopGold,
              costSilver: shopSilver,
              costCopper: shopCopper,
              totalGold,
              totalSilver,
              totalCopper,
            });
            setShopItem('');
            setShopGold(0);
            setShopSilver(0);
            setShopCopper(0);
            setShopQuantity(1);
          }}
          className={cn(
            'w-full min-h-11 border-none rounded-lg text-base font-semibold cursor-pointer text-white',
            shopAction === 'buy' ? 'bg-[#27ae60]' : 'bg-[var(--color-accent)]'
          )}
        >
          Log {shopAction === 'buy' ? 'Purchase' : 'Sale'}
        </button>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────

  // Rest and Death Roll only exist for systems whose engine declares those
  // panels — they are dropped entirely (chips + drawers) otherwise.
  const actions = useMemo(
    () =>
      [
        { id: 'quickLog', label: 'Quick Log' },
        { id: 'note', label: 'Note' },
        { id: 'npc', label: 'NPC / Monster' },
        { id: 'encounter', label: 'Encounter' },
        { id: 'damage', label: 'Damage' },
        { id: 'quote', label: 'Quote' },
        { id: 'condition', label: 'Condition' },
        ...(supportsDeathRoll ? [{ id: 'death', label: 'Death Roll' }] : []),
        ...(supportsRest ? [{ id: 'rest', label: 'Rest' }] : []),
        { id: 'camp', label: 'Camp' },
        { id: 'travel', label: 'Travel' },
        { id: 'rumor', label: 'Rumor' },
        { id: 'shopping', label: 'Shopping' },
        { id: 'loot', label: 'Loot' },
      ],
    [supportsDeathRoll, supportsRest],
  );

  const primaryActionIds = ['quickLog', 'note', 'encounter', 'damage', 'quote', 'npc'];
  const primaryActions = useMemo(
    () => actions.filter((action) => primaryActionIds.includes(action.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions],
  );
  const secondaryActions = useMemo(
    () => actions.filter((action) => !primaryActionIds.includes(action.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions],
  );

  const renderQuickLog = () => (
    <QuickLogPCTray
      onLogged={() => onLogComplete?.()}
      onClose={() => close()}
    />
  );

  // Legacy render functions retained for possible future re-wiring — the
  // PC-tray flow supersedes the old per-action drawers for skill / spell /
  // ability. Silence "unused" by referencing them here.
  void renderSkillPicker;
  void renderSpellPicker;
  void renderAbilityPicker;

  const drawerContent: Record<string, { title: string; render: () => React.JSX.Element }> = {
    quickLog: { title: 'Quick Log', render: renderQuickLog },
    condition: { title: 'Condition', render: renderConditionPicker },
    ...(supportsRest ? { rest: { title: 'Rest', render: renderRestPicker } } : {}),
    damage: { title: 'Damage', render: renderDamagePicker },
    ...(supportsDeathRoll ? { death: { title: 'Death Roll', render: renderDeathRollPicker } } : {}),
    camp: { title: 'Camp', render: renderCampPicker },
    travel: { title: 'Travel', render: renderTravelPicker },
    quote: { title: 'Quick Quote', render: renderQuotePicker },
    rumor: { title: 'Rumor Heard', render: renderRumorPicker },
    shopping: { title: 'Shopping', render: renderShoppingPicker },
    encounter: { title: 'Random Encounter', render: renderEncounterPicker },
    loot: { title: 'Loot Found', render: renderLootPicker },
  };

  // The Note / NPC drawers render their own self-contained forms (including
  // AttachToControl and the save/cancel footer) so they are routed separately
  // from the shared drawer content above.
  const isNpcDrawer = activeDrawer === 'npc';

  if (activeDrawer === 'note') {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
            Quick Log
          </p>
          <p className="text-sm font-semibold text-[var(--color-text)]">
            New Timeline Entry
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Capture a session-level note without opening another sheet on top of Quick Log.
          </p>
        </div>
        <QuickNoteAction
          campaignId={activeCampaign?.id ?? null}
          onClose={() => setActiveDrawer(null)}
          onSaved={() => {
            onLogComplete?.();
            close();
          }}
          initialAttachTo={preferredAttachTo}
        />
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
            Quick Log
          </p>
          {contextLabel ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Adding to <span className="font-semibold text-[var(--color-text)]">{contextLabel}</span>
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => openAction('note')}>
          <Plus className="h-4 w-4" />
          Add Note
        </Button>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap items-center">
        {primaryActions.map((action) => (
          <button key={action.id} onClick={() => openAction(action.id)} className={chipClasses}>
            {action.label}
          </button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={chipClasses}>
              <Ellipsis className="h-4 w-4" />
              More
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {secondaryActions.map((action) => (
              <DropdownMenuItem key={action.id} onSelect={() => openAction(action.id)}>
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {activeDrawer && drawerContent[activeDrawer] && (
        <Drawer
          open={true}
          onClose={close}
          title={drawerContent[activeDrawer].title}
        >
          {drawerContent[activeDrawer].render()}
          <AttachToControl
            value={attachTo}
            onChange={setAttachTo}
            defaultValue={activeDrawer === 'loot' ? null : preferredAttachTo}
          />
          <TagPicker
            selected={selectedTags}
            onToggle={tag => setSelectedTags(prev =>
              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
            )}
          />
        </Drawer>
      )}

      {isNpcDrawer && (
        <Drawer
          open={true}
          onClose={close}
          title="NPC / Monster"
        >
          <QuickNpcAction onClose={close} onSaved={onLogComplete} initialAttachTo={preferredAttachTo} />
        </Drawer>
      )}
    </>
  );
}
