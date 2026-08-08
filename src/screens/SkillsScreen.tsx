import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useFieldEditable, FIELD_PATHS } from '../utils/modeGuards';
import { useAutosave } from '../hooks/useAutosave';
import { SkillList } from '../components/fields/SkillList';
import { Chip } from '../components/primitives/Chip';
import { GameIcon } from '../components/primitives/GameIcon';
import { AddCustomSkillForm, type CustomSkillDraft } from '../components/fields/AddCustomSkillForm';
import { SkillGroupHeader } from '../components/fields/SkillGroupHeader';
import {
  resolveEffectiveBoonBane,
  formatProb,
} from '../utils/boonBane';
import type { BoonBaneState } from '../types/settings';
import type { CharacterSkill } from '../types/character';
import type { AttributeDefinition } from '../types/system';
import { nowISO } from '../utils/dates';
import { conditionImposesBane } from '../utils/conditionEffects';
import * as characterRepository from '../storage/repositories/characterRepository';
import { getEngine } from '../features/systems/engine';
import { buildSkillCategoryViews, countVisibleSkills } from '../features/characters/skillCategoryViews';
import { groupMembers, groupFor, trainGroupAtZero, groupHasEveryMember } from '../features/characters/skillGroups';
import {
  resolveSkillCategories,
  isCustomSkill,
  removeCustomSkill,
  isSkillNameAvailable,
} from '../features/characters/customSkills';
import { generateId } from '../utils/ids';
import { resolveSkillValue } from '../utils/derivedValues';

function clampSkillValue(value: number, range: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

/**
 * The Skills screen — lists all skills for the active character with roll-under
 * probability display and boon/bane modifiers.
 *
 * @remarks
 * Skills are grouped by category as defined by the active game-system definition.
 * The screen provides the following interactive controls:
 *
 * - **Filter chips** — toggle between "Relevant" (per the active system engine's
 *   {@link features/systems/engine/types!SkillEngineConfig.isRelevant | SkillEngineConfig.isRelevant} predicate) and "All" skills.
 * - **Global Boon/Bane selector** — sets a campaign-wide modifier applied to
 *   every skill's probability calculation.
 * - **Per-skill boon/bane override** — cycles through inherit → boon → bane → inherit
 *   for individual skills, taking precedence over the global setting.
 * - **Trained checkbox / trained indicator** — editable in Edit Mode; shows a
 *   shield icon in Play Mode.
 * - **Skill value input** — numeric roll-under target, editable in Edit Mode.
 * - **Dragon / Demon mark toggle** — cycles unmarked → dragon-marked → demon-marked →
 *   unmarked in Play Mode to track session advancement .
 *
 * Probability strings come from the active engine's `probability.chance`, with the
 * boon/bane state resolved through {@link resolveEffectiveBoonBane}.
 *
 * Conditions with a `linkedAttributeId` automatically impose a bane on skills
 * that share that attribute (reflected in the probability display).
 *
 * Navigates to `/library` if no character is loaded.
 *
 * @returns The skills list UI, or a loading indicator, or `null` while redirecting.
 */
export default function SkillsScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'classic-fantasy');
  const {
    sessionState,
    setGlobalBoonBane,
    setSkillOverride,
    setSkillAttributeOverride,
    setRollTarget,
    isLoading: settingsLoading,
    settings,
  } = useAppState();
  const skillsEditable = useFieldEditable(FIELD_PATHS.skills);
  const [filter, setFilter] = useState<'all' | 'relevant'>('relevant');
  const [search, setSearch] = useState('');
  /**
   * Per-category open state the user has explicitly set, overriding the default.
   * Sparse on purpose: a category the user has not touched follows the default,
   * so the list keeps re-deciding sensibly as skills are trained or searched.
   */
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  /** Draft for the "add a skill" form; `null` when the form is closed. */
  const [draft, setDraft] = useState<CustomSkillDraft | null>(null);
  useAutosave(character, characterRepository.save, 1000);
  const engine = getEngine(system);
  const skillRange = engine.skill.range;

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

  function handleSkillChange(skillId: string, value: CharacterSkill) {
    if (!character) return;
    // Snap to the die ladder (Savage Worlds) so a skill can't land on a d5/d7;
    // otherwise clamp to the numeric range. The length check guards a malformed
    // empty ladder, whose reduce seed would be `undefined` and corrupt the save.
    const ladder = engine.skill.ladder;
    const snapped = ladder && ladder.length > 0
      ? ladder.reduce((best, rung) => (Math.abs(rung - value.value) < Math.abs(best - value.value) ? rung : best), ladder[0])
      : clampSkillValue(value.value, skillRange);
    updateCharacter({ skills: { ...character.skills, [skillId]: { ...value, value: snapped } }, updatedAt: nowISO() });
  }

  function cycleSkillMark(skillId: string) {
    if (!character || skillsEditable || !engine.skill.supportsMarks) return;
    const cs = character.skills[skillId];
    // Merged categories, not the system's own: a player-authored skill has no
    // entry in `system.skillCategories`, so looking it up there returned
    // undefined and computed the fallback from `baseChance: 0` and no linked
    // attribute — the wrong starting value for a roll-under system the moment
    // someone marked a custom skill.
    const def = resolveSkillCategories(system, character)
      .flatMap(c => c.skills)
      .find(s => s.id === skillId);
    const trained = cs?.trained ?? false;
    // The engine owns the "no stored entry" value for its resolution system.
    const fallbackValue = engine.skill.computeValue(
      { baseChance: def?.baseChance ?? 0, linkedAttributeId: def?.linkedAttributeId },
      character,
      trained,
    );
    const skill = cs ?? { value: fallbackValue, trained: false };

    let updated: CharacterSkill;
    if (!cs?.dragonMarked && !cs?.demonMarked) {
      // Unmarked -> Dragon
      updated = { ...skill, dragonMarked: true, demonMarked: false };
    } else if (cs?.dragonMarked) {
      // Dragon -> Demon
      updated = { ...skill, dragonMarked: false, demonMarked: true };
    } else {
      // Demon -> Clear
      updated = { ...skill, dragonMarked: false, demonMarked: false };
    }
    updateCharacter({ skills: { ...character.skills, [skillId]: updated }, updatedAt: nowISO() });
  }

  const dragonMarkedCount = Object.values(character.skills).filter(s => s?.dragonMarked).length;

  function cycleSkillOverride(skillId: string) {
    const current = sessionState.skillOverrides[skillId];
    if (current === undefined) {
      setSkillOverride(skillId, 'boon');
    } else if (current === 'boon') {
      setSkillOverride(skillId, 'bane');
    } else {
      setSkillOverride(skillId, undefined);
    }
  }

  function buildAttrAbbrMap(attributes: AttributeDefinition[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const attr of attributes) {
      map[attr.id] = attr.abbreviation;
    }
    return map;
  }

  const attrAbbrMap = system ? buildAttrAbbrMap(system.attributes) : {};

  function getProbDisplay(skillId: string, value: number, linkedAttributeId?: string, trained?: boolean): string {
    const hasAutoBane = conditionImposesBane(system, character, linkedAttributeId);
    const override = sessionState.skillOverrides[skillId];
    const effective = resolveEffectiveBoonBane(sessionState.globalBoonBane, override, hasAutoBane);

    if (!engine.skill.supportsMarks) {
      // Non-d20 systems (e.g. Traveller) express success chance through the engine's own
      // display formula. Pass the linked attribute so it can fold in its characteristic
      // DM, the resolved advantage state so the odds reflect boon/bane, and whether the
      // skill is trained so an untrained attempt shows the −3 unskilled odds.
      return engine.skill.display(
        value,
        character
          ? { character, skillId, linkedAttributeId, boonBane: effective, trained, target: rollTarget }
          : undefined,
      );
    }

    // The engine owns the odds maths; the screen only decides which state applies.
    const probContext = character ? { character, skillId, linkedAttributeId, target: rollTarget } : undefined;
    const chance = (state: BoonBaneState) => engine.probability.chance(value, state, probContext);
    const normalPct = formatProb(chance('none'));
    // Natural-1 auto-success is a roll-under convention; other resolutions never show it.
    const isDragon = engine.skill.supportsMarks && value === 1;

    if (effective === 'none') {
      return isDragon ? `${normalPct} (auto-success)` : normalPct;
    }
    if (effective === 'boon') {
      const boonPct = formatProb(chance('boon'));
      return isDragon
        ? `${normalPct} (${boonPct} with boon, auto-success)`
        : `${normalPct} (${boonPct} with boon)`;
    }
    const banePct = formatProb(chance('bane'));
    return isDragon
      ? `${normalPct} (${banePct} with bane, auto-success)`
      : `${normalPct} (${banePct} with bane)`;
  }

  // Grouping/collapse/search rules live in a tested helper — see
  // {@link features/characters/skillCategoryViews!buildSkillCategoryViews}.
  /**
   * The task target every probability on this screen is computed against.
   *
   * @remarks
   * `difficulty` is absent for roll-under systems, where the skill value *is*
   * the target and there is nothing to choose — so no selector renders and this
   * stays undefined, which every engine reads as "use your own default".
   */
  const difficulty = engine.probability.difficulty;
  const rollTarget = sessionState.rollTarget ?? difficulty?.defaultValue;

  const query = search.trim().toLowerCase();
  // The character's own skills are merged in here, so everything downstream —
  // grouping, search, the group action, the rows themselves — treats a custom
  // skill exactly like a declared one.
  const skillCategories = resolveSkillCategories(system, character);
  const categoryViews = buildSkillCategoryViews({
    categories: skillCategories,
    characterSkills: character.skills,
    isRelevant: engine.skill.isRelevant,
    filter,
    search,
    openOverrides,
  });
  const totalVisible = countVisibleSkills(categoryViews);

  function toggleCategory(categoryId: string, currentlyOpen: boolean) {
    setOpenOverrides(prev => ({ ...prev, [categoryId]: !currentlyOpen }));
  }

  /**
   * Grants the level-0 baseline a speciality group gives, for every member the
   * character does not already have.
   *
   * @remarks
   * Additive only — {@link trainGroupAtZero} returns the same bag when nothing
   * is missing, so a no-op never dirties the record or triggers an autosave.
   */
  function trainWholeGroup(groupId: string) {
    if (!character || !system) return;
    const members = groupMembers(skillCategories, groupId);
    const skills = trainGroupAtZero(character.skills, members);
    if (skills === character.skills) return;
    updateCharacter({ skills, updatedAt: nowISO() });
  }

  /**
   * Adds the drafted skill to this character.
   *
   * @remarks
   * The definition goes on the character, never on the shared system: Language
   * (Zhodani) belongs to one Traveller, and editing `system.json` would put it
   * on every character in the library. The id is generated rather than derived
   * from the name so a later rename cannot orphan the stored value.
   *
   * Created trained at 0 — a skill you bothered to write down is one you have,
   * and level 0 is exactly what cancels the unskilled penalty.
   */
  function addCustomSkill() {
    if (!character || !draft) return;
    const name = draft.name.trim();
    if (!isSkillNameAvailable(system, character, name)) return;

    const id = generateId();
    updateCharacter({
      customSkills: [
        ...(character.customSkills ?? []),
        {
          id,
          name,
          categoryId: draft.categoryId,
          ...(draft.linkedAttributeId ? { linkedAttributeId: draft.linkedAttributeId } : {}),
        },
      ],
      skills: { ...character.skills, [id]: { value: 0, trained: true } },
      updatedAt: nowISO(),
    });
    setDraft(null);
  }

  /** Deletes a custom skill's definition and its stored value together. */
  function deleteCustomSkill(skillId: string) {
    if (!character) return;
    updateCharacter({ ...removeCustomSkill(character, skillId), updatedAt: nowISO() });
  }

  function getOverrideLabel(skillId: string): string {
    const override = sessionState.skillOverrides[skillId];
    if (override === 'boon') return '★';
    if (override === 'bane') return '✕';
    return '○';
  }

  function getOverrideTitle(skillId: string): string {
    const override = sessionState.skillOverrides[skillId];
    if (override === 'boon') return 'Override: Boon — tap for Bane';
    if (override === 'bane') return 'Override: Bane — tap to clear';
    return 'No override — tap to set Boon';
  }

  return (
    <div className="p-[var(--space-md)]">
      {/* Header */}
      <div className="flex justify-between items-center mb-[var(--space-md)] flex-wrap gap-[var(--space-sm)]">
        <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)]">Skills</h1>
        <div className="flex gap-2">
          <Chip label="Relevant" active={filter === 'relevant'} onClick={() => setFilter('relevant')} />
          <Chip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        </div>
      </div>

      {/* Skill-mark count badge — only systems whose skills carry marks show it */}
      {engine.skill.supportsMarks && dragonMarkedCount > 0 && (
        <div className="dragon-count-badge" aria-label={`${dragonMarkedCount} skills dragon marked`}>
          🐉 {dragonMarkedCount} marked
        </div>
      )}

      {/* Task difficulty — every skill's odds move together, which is the
          point: "what are my chances if this one is Difficult?" is a question
          about the whole sheet at once. */}
      {difficulty && (
        <div className="mt-[var(--space-sm)] flex items-center gap-[var(--space-sm)] flex-wrap">
          <label
            htmlFor="roll-target"
            className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] font-semibold"
          >
            {difficulty.label}
          </label>
          <select
            id="roll-target"
            value={rollTarget ?? difficulty.defaultValue}
            onChange={e => setRollTarget(Number(e.target.value))}
            className="flex-1 min-w-[10rem] min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
          >
            {difficulty.options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.value}+)
              </option>
            ))}
          </select>
          {rollTarget !== difficulty.defaultValue && (
            <button
              type="button"
              onClick={() => setRollTarget(undefined)}
              className="shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] text-xs font-semibold cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Global Boon/Bane Selector */}
      {engine.skill.supportsBoonBane && (
      <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]" aria-label="Global boon/bane selector" role="group">
        {(['boon', 'none', 'bane'] as BoonBaneState[]).map(seg => (
          <button
            key={seg}
            className={`flex-1 px-4 py-2 min-h-[44px] text-sm font-semibold border-none cursor-pointer transition-colors ${
              sessionState.globalBoonBane === seg
                ? seg === 'boon'
                  ? 'bg-emerald-600 text-white'
                  : seg === 'bane'
                    ? 'bg-red-600 text-white'
                    : 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
            }`}
            onClick={() => setGlobalBoonBane(seg)}
            aria-pressed={sessionState.globalBoonBane === seg}
          >
            {seg === 'none' ? 'Normal' : seg.charAt(0).toUpperCase() + seg.slice(1)}
          </button>
        ))}
      </div>
      )}

      {/* Name search — the only practical way through a 103-skill list */}
      {system && (
        <div className="relative mt-[var(--space-sm)]">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search skills…"
            aria-label="Search skills by name"
            className="w-full min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)]"
          />
        </div>
      )}

      {/* Add a skill the system does not declare — Language (Zhodani), a new
          Profession. Edit Mode only; the definition lands on this character. */}
      {system && skillsEditable && (
        <div className="mt-[var(--space-sm)]">
          <AddCustomSkillForm
            draft={draft}
            onDraftChange={setDraft}
            onOpen={() => setDraft({ name: '', categoryId: system.skillCategories[0]?.id ?? '', linkedAttributeId: '' })}
            onCancel={() => setDraft(null)}
            onSubmit={addCustomSkill}
            categories={system.skillCategories}
            attributes={system.attributes}
            nameAvailable={isSkillNameAvailable(system, character, draft?.name ?? '')}
          />
        </div>
      )}

      {/* Skill list with boon/bane overlays */}
      {system ? (
        <div className="mt-[var(--space-sm)]">
          {categoryViews.map(({ category, skills: visibleSkills, open }) => {
            return (
              <div key={category.id} className="mb-[var(--space-md)]">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id, open)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 mb-[var(--space-sm)] px-[var(--space-sm)] py-[var(--space-xs)] min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[length:var(--font-size-md)] text-[var(--color-text-muted)] font-semibold cursor-pointer"
                >
                  <span>
                    {category.name}
                    <span className="ml-2 font-normal opacity-70">{visibleSkills.length}</span>
                  </span>
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
                {open && visibleSkills.map((skill, index) => {
                  const cs = character.skills[skill.id];
                  // A group header opens each run of specialities. Members are
                  // contiguous in the definition, so a change of groupId marks
                  // the boundary — no separate pass needed.
                  const group = groupFor(system.skillGroups, skill);
                  const startsGroup = !!group && visibleSkills[index - 1]?.groupId !== skill.groupId;
                  const members = startsGroup ? groupMembers(skillCategories, group.id) : [];
                  const groupComplete = startsGroup && groupHasEveryMember(character.skills, members);
                  const computedValue = engine.skill.computeValue(skill, character, cs?.trained ?? false);
                  // Temp modifiers aimed at this skill ("+1 Gun Combat while
                  // the scope is on") fold in here, so the odds, the DM line
                  // and the value input all come from one number.
                  const storedValue = cs?.value ?? computedValue;
                  const resolvedSkill = resolveSkillValue(character, skill.id, storedValue);
                  const skillValue = resolvedSkill.effective;
                  // The rules routinely allow a different characteristic for the
                  // situation (Persuade with INT, Athletics with STR/DEX/END).
                  // The swap is session-scoped, so every number on this row —
                  // abbreviation, DM badge and odds — comes from one resolved id.
                  const linkedAttributeId =
                    sessionState.skillAttributeOverrides[skill.id] ?? skill.linkedAttributeId;
                  const isSwapped = linkedAttributeId !== skill.linkedAttributeId;
                  const attrAbbr = linkedAttributeId ? (attrAbbrMap[linkedAttributeId] ?? '') : '';
                  const characteristicDM = linkedAttributeId ? engine.attributeBadge(linkedAttributeId, character) : null;
                  const probDisplay = getProbDisplay(skill.id, skillValue, linkedAttributeId, cs?.trained ?? false);
                  const overrideLabel = getOverrideLabel(skill.id);
                  const overrideTitle = getOverrideTitle(skill.id);

                  const isDragonMarked = cs?.dragonMarked ?? false;
                  const isDemonMarked = cs?.demonMarked ?? false;

                  const isTrained = cs?.trained ?? false;

                  return (
                    <React.Fragment key={skill.id}>
                    {startsGroup && group && (
                      <SkillGroupHeader
                        name={group.name}
                        editable={skillsEditable}
                        complete={groupComplete}
                        onTrainAll={() => trainWholeGroup(group.id)}
                      />
                    )}
                    <div className={cn(
                      // flex-wrap so a long boon/bane probability string wraps the
                      // controls to a second line on a phone instead of overflowing.
                      "flex flex-wrap items-center gap-[var(--space-sm)] py-[var(--space-xs)] border-b border-[var(--color-border)] min-h-[var(--touch-target-min)]",
                      isDragonMarked && 'bg-amber-900/20 border-l-2 !border-l-amber-500',
                      isDemonMarked && 'bg-purple-900/20 border-l-2 !border-l-purple-500',
                      isTrained && !skillsEditable && 'bg-[var(--color-surface-raised)]/30',
                    )}>
                      {skillsEditable ? (
                        <input
                          type="checkbox"
                          checked={isTrained}
                          onChange={e => {
                            const newTrained = e.target.checked;
                            // Systems whose values are authored directly (e.g. Traveller
                            // levels) must keep the stored number — recomputing would
                            // discard it.
                            const newValue = engine.skill.trainedAffectsValue
                              ? engine.skill.computeValue(skill, character, newTrained)
                              : (cs?.value ?? engine.skill.computeValue(skill, character, newTrained));
                            handleSkillChange(skill.id, { value: newValue, trained: newTrained });
                          }}
                          aria-label={`${skill.name} trained`}
                          className="w-5 h-5 cursor-pointer shrink-0"
                        />
                      ) : (
                        <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                          {isTrained && <GameIcon name="checked-shield" size={18} color="var(--color-accent)" />}
                        </span>
                      )}

                      {/* Name */}
                      <span className={cn(
                        "flex-1 min-w-0 text-[var(--color-text)] text-[length:var(--font-size-md)]",
                        isTrained ? "font-semibold" : "font-normal"
                      )}>
                        {skill.name}
                      </span>

                      {/* Characteristic chip. A select rather than a label: the
                          characteristic a skill rolls against is a
                          per-situation call, and the swap is session-scoped so
                          it never rewrites the character. Blank = declared one.

                          Its own control slot rather than inline in the name —
                          inline it rendered as ~14px of tappable text, which is
                          a third of --touch-target-min on the tablets this app
                          is built for. */}
                      {skill.linkedAttributeId && system.attributes.length > 0 && (
                        <select
                          value={sessionState.skillAttributeOverrides[skill.id] ?? ''}
                          onChange={e => setSkillAttributeOverride(skill.id, e.target.value || undefined)}
                          aria-label={`Characteristic for ${skill.name}`}
                          title={isSwapped
                            ? `Rolling against ${attrAbbr} instead of ${attrAbbrMap[skill.linkedAttributeId] ?? ''} — for this session only`
                            : `Rolling against ${attrAbbr}. Pick another for this session.`}
                          className={cn(
                            'shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-xs)] text-xs rounded-[var(--radius-sm)] cursor-pointer bg-transparent',
                            isSwapped
                              ? 'text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]'
                              : 'text-[var(--color-text-muted)] border border-transparent',
                          )}
                        >
                          <option value="">
                            {attrAbbrMap[skill.linkedAttributeId] ?? ''}
                            {!isSwapped && characteristicDM ? ` ${characteristicDM}` : ''}
                          </option>
                          {system.attributes
                            .filter(a => a.id !== skill.linkedAttributeId)
                            .map(a => (
                              <option key={a.id} value={a.id}>
                                {a.abbreviation} {engine.attributeBadge(a.id, character) ?? ''}
                              </option>
                            ))}
                        </select>
                      )}

                      {/* Probability display */}
                      <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
                        {probDisplay}
                      </span>

                      {/* Value input — bound to the STORED level, never the
                          modified one. Showing the buffed number here would
                          write it back as the character's real level the moment
                          the field was touched, baking a temporary buff in. The
                          modifier is surfaced next to it instead. */}
                      {resolvedSkill.isModified && (
                        <span
                          className="text-xs font-semibold text-[var(--color-accent)] shrink-0 tabular-nums"
                          title={resolvedSkill.modifiers.map(m => `${m.label} ${m.delta >= 0 ? '+' : ''}${m.delta}`).join(', ')}
                        >
                          →{skillValue}
                        </span>
                      )}
                      <input
                        type="number"
                        // The only control in this row with no accessible name:
                        // a screen reader announced a bare spinbutton. The noun
                        // is the ruleset's — "Level" in Traveller, "Die" in
                        // Savage Worlds, "Value" in Dragonbane — which is what
                        // engine.skill.valueLabel exists for.
                        aria-label={`${skill.name} ${engine.skill.valueLabel}`}
                        value={storedValue}
                        min={skillRange.min}
                        max={skillRange.max}
                        disabled={!skillsEditable}
                        onChange={e => handleSkillChange(skill.id, { value: clampSkillValue(Number(e.target.value), skillRange), trained: cs?.trained ?? false })}
                        className={cn(
                          "w-[52px] h-[var(--touch-target-min)] text-center text-[length:var(--font-size-md)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)]",
                          skillsEditable
                            ? "bg-[var(--color-surface-alt)] cursor-text opacity-100"
                            : "bg-[var(--color-surface)] cursor-default opacity-70"
                        )}
                      />

                      {/* Per-skill boon/bane override */}
                      {engine.skill.supportsBoonBane && (
                      <button
                        className={`min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] shrink-0 flex items-center justify-center rounded border-none cursor-pointer text-sm font-bold ${
                          (sessionState.skillOverrides[skill.id] ?? 'inherit') === 'boon'
                            ? 'bg-emerald-600/20 text-emerald-400'
                            : (sessionState.skillOverrides[skill.id] ?? 'inherit') === 'bane'
                              ? 'bg-red-600/20 text-red-400'
                              : 'bg-transparent text-[var(--color-text-muted)] opacity-40'
                        }`}
                        onClick={() => cycleSkillOverride(skill.id)}
                        title={overrideTitle}
                        aria-label={overrideTitle}
                      >
                        {overrideLabel}
                      </button>
                      )}

                      {/* Only a skill this character authored can be deleted;
                          a declared one belongs to the system definition. */}
                      {skillsEditable && isCustomSkill(character, skill.id) && (
                        <button
                          type="button"
                          onClick={() => deleteCustomSkill(skill.id)}
                          title={`Delete ${skill.name}`}
                          aria-label={`Delete ${skill.name}`}
                          className="min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] shrink-0 flex items-center justify-center rounded border-none bg-transparent text-[var(--color-text-muted)] cursor-pointer hover:text-red-400"
                        >
                          ✕
                        </button>
                      )}

                      {/* Skill mark cycle: unmarked -> dragon -> demon -> clear (play mode only) */}
                      {engine.skill.supportsMarks && !skillsEditable && (
                        <button
                          className={cn(
                            'dragon-mark-toggle',
                            isDragonMarked && 'dragon-mark-toggle--active',
                            isDemonMarked && 'dragon-mark-toggle--demon',
                            isDragonMarked ? 'bg-[var(--color-accent)] text-white' : isDemonMarked ? 'bg-[#c0392b] text-white' : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]',
                          )}
                          onClick={() => cycleSkillMark(skill.id)}
                          title={isDragonMarked ? 'Dragon marked — tap for demon mark' : isDemonMarked ? 'Demon marked — tap to clear' : 'Tap to dragon mark'}
                          aria-label={isDragonMarked ? `Dragon mark on ${skill.name}` : isDemonMarked ? `Demon mark on ${skill.name}` : `Mark ${skill.name}`}
                        >
                          {isDragonMarked ? '🐉' : isDemonMarked ? '😈' : '○'}
                        </button>
                      )}
                    </div>
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
          {totalVisible === 0 && (
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] italic">
              {query
                ? `No skills match "${search.trim()}".`
                : filter === 'relevant'
                  ? 'No trained skills yet — switch to All to add some.'
                  : 'This system defines no skills.'}
            </p>
          )}
        </div>
      ) : (
        <SkillList
          categories={[]}
          characterSkills={character.skills}
          onSkillChange={handleSkillChange}
          disabled={!skillsEditable}
          filter={filter}
        />
      )}
    </div>
  );
}
