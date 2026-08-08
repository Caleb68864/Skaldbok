// PrintableSheet — SS-03: Pure render component (zero interactivity, zero side-effects)

import React from 'react';
import type {
  CharacterRecord,
  Spell,
  HeroicAbility,
  Weapon,
} from '../types/character';
import type { SystemDefinition, SkillDefinition } from '../types/system';
import { resolveSkillCategories } from '../features/characters/customSkills';
import { resolveArmorRating } from '../utils/derivedValues';
import { compareSpellsByRankThenName, formatCastingTime, formatRequirements, getSpellRank } from '../utils/spells';
import { toSpells, toHeroicAbilities } from '../utils/abilities';
import type { SystemEngine } from '../features/systems/engine';

// ──────────────────────────────────────────────
// Exported types (consumed by SS-02 screen)
// ──────────────────────────────────────────────

/** Pre-resolved derived stats the print screen computes once and passes down, already accounting for per-character overrides. */
export interface PrintDerivedValues {
  damageBonus: string;
  aglDamageBonus: string;
  movement: number;
  encumbranceLimit: number;
  hpMax: number;
  wpMax: number;
}

/** Props for {@link PrintableSheet}. `colorMode` selects the color vs black-and-white print stylesheet. */
export interface PrintableSheetProps {
  character: CharacterRecord;
  system: SystemDefinition | null;
  derived: PrintDerivedValues;
  colorMode: 'color' | 'bw';
  engine: SystemEngine;
}

// ──────────────────────────────────────────────
// Section 1 — Sheet Header (SS-04)
// ──────────────────────────────────────────────

/**
 * Header identity block.
 *
 * @remarks
 * The fields come from `system.identityFields` rather than a Dragonbane list,
 * so a ruleset that tracks Species/Homeworld prints those instead. The split
 * mirrors the sheet screen: the first three declared fields join Name/Player on
 * the top row, the rest print full-width underneath.
 */
function SheetHeader({ character, system }: { character: CharacterRecord; system: SystemDefinition | null }): React.ReactElement {
  const title = (system?.displayName ?? 'Character Sheet').toUpperCase();
  const identityFields = system?.identityFields ?? [];
  const topRowFields = identityFields.slice(0, 3);
  const wideRowFields = identityFields.slice(3);
  return (
    <div className="sheet-header">
      <div className="sheet-title">{title}</div>
      <div className="sheet-header-bar" />
      <div className="sheet-identity-row">
        <div className="sheet-field">
          <span className="sheet-label">Name</span>
          <span className="sheet-value">{character.name || ''}</span>
        </div>
        <div className="sheet-field">
          <span className="sheet-label">Player</span>
          <span className="sheet-value">{/* intentionally blank */}</span>
        </div>
        {topRowFields.map(field => (
          <div key={field.id} className="sheet-field">
            <span className="sheet-label">{field.label}</span>
            <span className="sheet-value">{character.metadata?.[field.id] || ''}</span>
          </div>
        ))}
      </div>
      {wideRowFields.length > 0 && (
        <div className="sheet-identity-row">
          {wideRowFields.map(field => (
            <div key={field.id} className="sheet-field sheet-field--wide">
              <span className="sheet-label">{field.label}</span>
              <span className="sheet-value">{character.metadata?.[field.id] || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 2 — Attribute Band (SS-05)
// ──────────────────────────────────────────────

/**
 * Builds the attribute/condition pairs for the band from system data.
 *
 * The attribute order comes from the engine; labels come from the system's own
 * attribute definitions, and each condition is matched to its attribute through
 * `linkedAttributeId` rather than a hardcoded Dragonbane list.
 */
function buildAttributePairs(
  engine: SystemEngine,
  system: SystemDefinition | null,
): Array<{ attrKey: string; attr: string; conditions: Array<{ id: string; name: string }> }> {
  return engine.attributeIds.map(attrKey => {
    const def = system?.attributes?.find(a => a.id === attrKey);
    // `find` printed only the first condition per attribute, which silently
    // dropped two of Traveller's three — all of them hang off END.
    const conditions = (system?.conditions ?? [])
      .filter(c => c.linkedAttributeId === attrKey)
      .map(c => ({ id: c.id, name: c.name }));
    return {
      attrKey,
      attr: def?.abbreviation ?? attrKey.toUpperCase(),
      conditions,
    };
  });
}

/** Prints the row of attribute values alongside their linked condition checkboxes. */
function AttributeBand({
  character,
  system,
  engine,
}: {
  character: CharacterRecord;
  system: SystemDefinition | null;
  engine: SystemEngine;
}): React.ReactElement {
  const pairs = buildAttributePairs(engine, system);
  return (
    <div className="sheet-attribute-grid">
      {pairs.map(({ attr, attrKey, conditions }) => (
        <div key={attrKey} className="sheet-attribute-column">
          <div className="sheet-attribute-box">
            <div className="sheet-attribute-label">{attr}</div>
            <div className="sheet-attribute-value">
              {character.attributes?.[attrKey] != null ? character.attributes[attrKey] : ''}
            </div>
          </div>
          {conditions.length > 0 ? (
            conditions.map(condition => (
              <div key={condition.id} className="sheet-condition">
                <span className="sheet-condition-diamond">
                  {character.conditions?.[condition.id] === true ? '◆' : '◇'}
                </span>
                <span className="sheet-condition-label">{condition.name}</span>
              </div>
            ))
          ) : (
            // Keeps column heights aligned for systems whose attributes have
            // no linked condition.
            <div className="sheet-condition">&nbsp;</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 3 — Derived Stats Row (SS-06)
// ──────────────────────────────────────────────

/**
 * Print-specific label wording, and the order the printed row uses.
 *
 * @remarks
 * The engine's `label` reads "STR Damage Bonus"/"AGL Damage Bonus" and lists
 * movement first, but the printed Dragonbane sheet has always read
 * "Damage Bonus (STR)" in damage-first order. Changing it would alter existing
 * printouts, so the print layer keeps its own wording/order for the keys it
 * knows about; unknown keys fall through to the engine's label and order.
 */
const PRINT_DERIVED_LABELS: Record<string, string> = {
  damageBonus: 'Damage Bonus (STR)',
  aglDamageBonus: 'Damage Bonus (AGL)',
};
const PRINT_DERIVED_ORDER = ['damageBonus', 'aglDamageBonus', 'movement', 'encumbranceLimit'];

/** Prints the derived-stats strip (damage bonus, movement, encumbrance limit, …) in a fixed order. */
function DerivedStatsRow({
  derived,
  engine,
}: {
  derived: PrintDerivedValues;
  engine: SystemEngine;
}): React.ReactElement {
  const values = derived as unknown as Record<string, string | number | undefined>;

  const fields = engine.derivedFields
    .filter(field => !field.surfaces || field.surfaces.includes('print'))
    // A system may declare derived stats the print screen does not compute
    // (Traveller's initiative DM); printing a blank field helps nobody.
    .filter(field => values[field.key] !== undefined)
    .map((field, index) => ({ field, index }))
    .sort((a, b) => {
      const rank = (key: string) => {
        const i = PRINT_DERIVED_ORDER.indexOf(key);
        return i === -1 ? PRINT_DERIVED_ORDER.length : i;
      };
      return rank(a.field.key) - rank(b.field.key) || a.index - b.index;
    })
    .map(({ field }) => field);

  return (
    <div className="sheet-derived-row">
      {fields.map(field => (
        <div key={field.key} className="sheet-derived-field">
          <span className="sheet-derived-label">{PRINT_DERIVED_LABELS[field.key] ?? field.label}</span>
          <span className="sheet-derived-value">{values[field.key]}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 4 Left — Abilities & Spells (SS-08)
// ──────────────────────────────────────────────

// SS-15 Mitigation C: reduced slot counts to ensure single-page fit
const ABILITY_SLOTS = 3;
const SPELL_SLOTS = 3;

/** Prints heroic abilities and spells, padded to a fixed number of blank slots for handwriting. */
function AbilitiesSpells({
  character,
  engine,
}: {
  character: CharacterRecord;
  engine: SystemEngine;
}): React.ReactElement | null {
  // Systems without magic have no ability/spell lists to print — rendering them
  // would emit blank Dragonbane rows on, e.g., a Traveller sheet.
  if (!engine.hasMagic) return null;

  const abilities: HeroicAbility[] = toHeroicAbilities(character.abilities);
  const spells: Spell[] = toSpells(character.abilities).sort(compareSpellsByRankThenName);

  return (
    <div className="sheet-abilities-spells">
      {/* NOTE: heading intentionally not `engine.terms.abilities` — that reads
          "Heroic Abilities" for classic-fantasy and would change the printed
          Dragonbane sheet. Override via `terms.abilities` in system.json. */}
      <div className="sheet-section-header">Abilities</div>
      {abilities.map((ability, i) => (
        <div key={i} className="sheet-ability-row">
          {ability.name}
        </div>
      ))}
      {/* Blank filler lines for abilities */}
      {Array.from({ length: Math.max(0, ABILITY_SLOTS - abilities.length) }).map((_, i) => (
        <div key={`ability-blank-${i}`} className="sheet-ability-row sheet-blank-row">&nbsp;</div>
      ))}

      <div className="sheet-section-header">{engine.terms.spells}</div>
      {spells.map((spell, i) => (
        <div key={i} className="sheet-ability-row sheet-spell-row">
          <span className="sheet-spell-name">{spell.name}</span>
          <span className="sheet-spell-meta">
            Rank {getSpellRank(spell)} · {formatCastingTime(spell.castingTime)} · {spell.range} · {spell.duration}
            {formatRequirements(spell.requirements) ? ` · Prereq: ${formatRequirements(spell.requirements)}` : ''}
          </span>
        </div>
      ))}
      {/* Blank filler lines for spells */}
      {Array.from({ length: Math.max(0, SPELL_SLOTS - spells.length) }).map((_, i) => (
        <div key={`spell-blank-${i}`} className="sheet-ability-row sheet-blank-row">&nbsp;</div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 4 Left — Currency (SS-09)
// ──────────────────────────────────────────────

/** Prints the character's money per the engine's currency denominations. */
function Currency({ character, engine }: { character: CharacterRecord; engine: SystemEngine }): React.ReactElement {
  const denominations = engine.currency.denominations;
  const amounts = engine.currency.read(character);
  // A lone denomination carries its unit in the label ("Credits (Cr)") since
  // there is no second box to give it context.
  const showAbbr = denominations.length === 1;
  // Optional Traveller Finances lines, printed only when the sheet records one.
  const financeLines: Array<[string, string]> = [
    ['shipShares', 'Ship Shares'],
    ['debt', 'Debt'],
    ['income', 'Income'],
    ['livingCost', 'Cost of Living'],
    ['annualPension', 'Annual Pension'],
    ['shipPayments', 'Ship Payments'],
  ];
  return (
    <div className="sheet-currency">
      <div className="sheet-section-header">Currency</div>
      <div className="sheet-currency-row">
        {denominations.map(denom => (
          <div key={denom.id} className="sheet-currency-field">
            <span className="sheet-currency-label">
              {showAbbr ? `${denom.label} (${denom.abbr})` : denom.label}
            </span>
            <span className="sheet-currency-value">{amounts[denom.id] ?? 0}</span>
          </div>
        ))}
        {financeLines.map(([key, label]) =>
          character.systemData?.[key] ? (
            <div key={key} className="sheet-currency-field">
              <span className="sheet-currency-label">{label}</span>
              <span className="sheet-currency-value">{String(character.systemData[key])}</span>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 4 Center — Skills (SS-07)
// ──────────────────────────────────────────────

/** Prints one skill's name and value as a single table row. */
function SkillRow({
  name,
  value,
  trained,
}: {
  name: string;
  value: number | string;
  trained: boolean;
}): React.ReactElement {
  return (
    <div className="sheet-skill-row">
      <span className="sheet-skill-trained">{trained ? '◆' : '◇'}</span>
      <span className="sheet-skill-name">{name}</span>
      <span className="sheet-skill-value">{value}</span>
    </div>
  );
}

/** Prints the skills column, grouped by the system's skill categories. */
function SkillsSection({
  character,
  system,
}: {
  character: CharacterRecord;
  system: SystemDefinition | null;
}): React.ReactElement {
  // The character's own custom skills are merged in, so they print inside their
  // category like any declared skill instead of falling through to the
  // write-in "Secondary Skills" slots as a bare id.
  const skillCategories = resolveSkillCategories(system, character);

  // Find general (core) and weapon categories by id
  const generalCategory = skillCategories.find((cat) => cat.id === 'core');
  const weaponCategory = skillCategories.find((cat) => cat.id === 'weapon');

  const generalSkills: SkillDefinition[] = generalCategory?.skills ?? [];
  const weaponSkills: SkillDefinition[] = weaponCategory?.skills ?? [];

  /**
   * Systems that do not use the legacy `core`/`weapon` category ids print each
   * category they declare, under its own name.
   *
   * @remarks
   * Looking up those two ids and nothing else meant a system with different
   * categories printed *no skills at all* — a Traveller sheet lost every one of
   * its six groups. Keyed off the legacy ids being absent so the Dragonbane
   * layout, which is tuned to a fixed page, is left exactly as it was.
   */
  const usesLegacyCategories = Boolean(generalCategory || weaponCategory);
  const declaredCategories = usesLegacyCategories ? [] : skillCategories;

  // Build set of all system skill IDs to identify secondary/custom skills
  const allSystemSkillIds = new Set<string>(
    skillCategories.flatMap((cat) => cat.skills.map((s: SkillDefinition) => s.id)),
  );

  // Secondary skills: character skills whose keys don't appear in any system category
  const secondarySkills = Object.entries(character.skills ?? {}).filter(
    ([key]) => !allSystemSkillIds.has(key),
  );
  // SS-07: 6 secondary skill slots per spec (7.5)
  const secondarySlots = 6;

  return (
    <div className="sheet-skills-section">
      {declaredCategories.map((category) => (
        <React.Fragment key={category.id}>
          <div className="sheet-section-header">{category.name}</div>
          {category.skills.map((skill: SkillDefinition) => {
            const charSkill = character.skills?.[skill.id];
            return (
              <SkillRow
                key={skill.id}
                name={skill.name}
                value={charSkill?.value ?? ''}
                trained={charSkill?.trained ?? false}
              />
            );
          })}
        </React.Fragment>
      ))}

      {usesLegacyCategories && <div className="sheet-section-header">General Skills</div>}
      {generalSkills.map((skill) => {
        const charSkill = character.skills?.[skill.id];
        return (
          <SkillRow
            key={skill.id}
            name={skill.name}
            value={charSkill?.value ?? ''}
            trained={charSkill?.trained ?? false}
          />
        );
      })}

      {usesLegacyCategories && <div className="sheet-section-header">Weapon Skills</div>}
      {weaponSkills.map((skill) => {
        const charSkill = character.skills?.[skill.id];
        return (
          <SkillRow
            key={skill.id}
            name={skill.name}
            value={charSkill?.value ?? ''}
            trained={charSkill?.trained ?? false}
          />
        );
      })}

      <div className="sheet-section-header">Secondary Skills</div>
      {Array.from({ length: secondarySlots }).map((_, i) => {
        const entry = secondarySkills[i];
        const key = entry ? entry[0] : null;
        const charSkill = entry ? entry[1] : null;
        return (
          <SkillRow
            key={key ?? `secondary-${i}`}
            name={key ?? ''}
            value={charSkill?.value ?? ''}
            trained={charSkill?.trained ?? false}
          />
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 4 Right — Inventory (SS-10)
// ──────────────────────────────────────────────

/** Prints carried inventory with a few blank rows for additions. */
function InventorySection({
  character,
  engine,
}: {
  character: CharacterRecord;
  engine: SystemEngine;
}): React.ReactElement {
  return (
    <div className="sheet-inventory">
      <div className="sheet-section-header">Inventory</div>

      {/* 10 numbered slots */}
      {Array.from({ length: 10 }).map((_, i) => {
        const item = character.inventory?.[i];
        return (
          <div key={i} className="sheet-inventory-slot">
            <span className="sheet-inventory-number">{i + 1}.</span>
            <span className="sheet-inventory-name">{item?.name ?? ''}</span>
          </div>
        );
      })}

      {/* Keepsake slot — hidden for systems with no such concept. */}
      {engine.labels.memento && (
        <div className="sheet-inventory-slot sheet-inventory-memento">
          <span className="sheet-inventory-label">{engine.labels.memento}</span>
          <span className="sheet-inventory-name">{character.memento ?? ''}</span>
        </div>
      )}

      {/* Tiny Items */}
      <div className="sheet-tiny-items">
        <span className="sheet-inventory-label">Tiny Items:</span>
        <span className="sheet-tiny-items-value">
          {(character.tinyItems ?? []).join(', ')}
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 5 Left — Armor & Helmet (SS-11)
// ──────────────────────────────────────────────

/** Prints the equipped armor and helmet with their ratings. */
function ArmorHelmet({ character, engine }: { character: CharacterRecord; engine: SystemEngine }): React.ReactElement {
  return (
    <div className="sheet-armor-section">
      <div className="sheet-section-header">Armor &amp; Helmet</div>

      {/* Armor row */}
      <div className="sheet-equipment-row">
        <span className="sheet-equipment-type-label">Armor</span>
        <div className="sheet-equipment-fields">
          <div className="sheet-equipment-field sheet-equipment-name">
            <span className="sheet-field-label">Name</span>
            <span className="sheet-field-value">{character.armor?.name ?? ''}</span>
          </div>
          <div className="sheet-equipment-field sheet-equipment-rating">
            <span className="sheet-field-label">Rating</span>
            {/* Resolved, so a temp modifier on the rating prints too. */}
            <span className="sheet-field-value">{character.armor ? resolveArmorRating(character, 'armor') : ''}</span>
          </div>
          <div className="sheet-equipment-field sheet-equipment-features">
            <span className="sheet-field-label">{engine.labels.armorFeatures}</span>
            <span className="sheet-field-value">{character.armor?.features ?? ''}</span>
          </div>
        </div>
      </div>

      {/* Helmet row */}
      <div className="sheet-equipment-row">
        <span className="sheet-equipment-type-label">Helmet</span>
        <div className="sheet-equipment-fields">
          <div className="sheet-equipment-field sheet-equipment-name">
            <span className="sheet-field-label">Name</span>
            <span className="sheet-field-value">{character.helmet?.name ?? ''}</span>
          </div>
          <div className="sheet-equipment-field sheet-equipment-rating">
            <span className="sheet-field-label">Rating</span>
            <span className="sheet-field-value">{character.helmet ? resolveArmorRating(character, 'helmet') : ''}</span>
          </div>
          <div className="sheet-equipment-field sheet-equipment-features">
            <span className="sheet-field-label">{engine.labels.armorFeatures}</span>
            <span className="sheet-field-value">{character.helmet?.features ?? ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 5 Center — Weapons Table (SS-12)
// ──────────────────────────────────────────────

/** Formats a weapon grip value into its short printed label. */
function formatGrip(grip: string | undefined): string {
  if (!grip) return '';
  const lower = grip.toLowerCase();
  if (lower.includes('2') || lower.includes('two')) return '2H';
  if (lower.includes('1') || lower.includes('one')) return '1H';
  return grip; // pass-through for unexpected values
}

/** One weapon column: a header plus how to read its cell off a weapon. */
interface WeaponColumn {
  key: string;
  label: string;
  className: string;
  read: (weapon: Weapon) => string;
}

/**
 * Builds the weapon columns the active system actually uses.
 *
 * @remarks
 * The printed table used to hardcode Grip and Dur., so a Traveller sheet
 * printed two empty fantasy columns and omitted the TL, range in metres and
 * magazine the player had filled in. Columns now follow the same
 * `itemFields` / `hiddenBuiltIns` contract as the on-screen editor.
 */
function buildWeaponColumns(system: SystemDefinition | null): WeaponColumn[] {
  const hidden = system?.itemFields?.hiddenBuiltIns?.weapon ?? [];
  const shows = (id: string) => !hidden.includes(id);
  const columns: WeaponColumn[] = [
    { key: 'name', label: 'Name', className: 'col-name', read: w => w.name ?? '' },
  ];

  if (shows('grip')) {
    columns.push({ key: 'grip', label: 'Grip', className: 'col-grip', read: w => formatGrip(w.grip) });
  }
  if (shows('range')) {
    columns.push({ key: 'range', label: 'Range', className: 'col-range', read: w => String(w.range ?? '') });
  }
  columns.push({ key: 'damage', label: 'Damage', className: 'col-damage', read: w => String(w.damage ?? '') });
  if (shows('durability')) {
    columns.push({
      key: 'durability',
      label: 'Dur.',
      className: 'col-durability',
      read: w => String(w.durability ?? ''),
    });
  }

  for (const field of system?.itemFields?.weapon ?? []) {
    columns.push({
      key: field.id,
      label: field.label,
      className: 'col-features',
      read: w => {
        const raw = w.systemFields?.[field.id];
        return raw === undefined || raw === null ? '' : String(raw);
      },
    });
  }

  columns.push({ key: 'features', label: 'Features', className: 'col-features', read: w => w.features ?? '' });
  return columns;
}

/** Prints the weapons table with columns resolved from the system via {@link buildWeaponColumns}. */
function WeaponsTable({
  character,
  system,
}: {
  character: CharacterRecord;
  system: SystemDefinition | null;
}): React.ReactElement {
  const columns = buildWeaponColumns(system);
  return (
    <div className="sheet-weapons">
      <div className="sheet-section-header">Weapons</div>
      <table className="sheet-weapons-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className={col.className}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 3 }).map((_, i) => {
            const weapon = character.weapons?.[i];
            return (
              <tr key={i} className={weapon ? '' : 'sheet-blank-row'}>
                {columns.map(col => (
                  <td key={col.key}>{weapon ? col.read(weapon) : ''}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 5 Right — Resource Trackers (SS-13)
// ──────────────────────────────────────────────

/**
 * Print-specific wording for the death tracks.
 *
 * @remarks
 * Same rationale as {@link PRINT_DERIVED_LABELS}: the engine's plural
 * "Failures"/"Successes" read well in the play UI, but the printed sheet has
 * always used the singular column headings. Unknown track ids print the
 * engine's label unchanged.
 */
const PRINT_DEATH_TRACK_LABELS: Record<string, string> = {
  deathSuccesses: 'Success',
  deathRolls: 'Failure',
};

/** Prints a row of fillable dots/boxes for tracking a countable value (e.g. death-roll failures) by hand. */
function DotTracker({
  label,
  current,
  max,
  filledClass,
}: {
  label: string;
  current: number;
  max: number;
  filledClass: string; // 'hp-dot-filled' or 'wp-dot-filled'
}): React.ReactElement {
  const safeCurrent = Math.max(0, Math.min(current, max));
  return (
    <div className="sheet-dot-tracker">
      <div className="sheet-dot-label">{label}</div>
      <div className="sheet-dot-grid">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`sheet-dot ${i < safeCurrent ? filledClass : 'dot-empty'}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Prints the resource trackers (HP/WP and any death/condition dot trackers) for the lower-right column. */
function ResourceTrackers({
  character,
  derived,
  system,
  engine,
}: {
  character: CharacterRecord;
  derived: PrintDerivedValues;
  system: SystemDefinition | null;
  engine: SystemEngine;
}): React.ReactElement {
  // `hp` / `wp` are data keys (of `character.resources` and the derived struct),
  // not labels — the user-facing text comes from the engine's terms.
  const hasHpWpPools = engine.resourceIds.includes('hp') && engine.resourceIds.includes('wp');

  const labelFor = (id: string): string => {
    if (id === 'hp') return engine.terms.healthResource;
    if (id === 'wp') return engine.terms.magicResource;
    return system?.resources?.find(r => r.id === id)?.name ?? id.toUpperCase();
  };

  const maxFor = (id: string): number => {
    if (id === 'hp') return derived.hpMax;
    if (id === 'wp') return derived.wpMax;
    return character.resources?.[id]?.max ?? 0;
  };

  // NOTE: not `engine.labels.resourcesPanel` for the HP/WP shape — that reads
  // "Resources" for classic-fantasy and would change the printed Dragonbane
  // sheet. Override via `labels.resourcesPanel` in system.json.
  const heading = hasHpWpPools ? 'Hit Points & Willpower' : engine.labels.resourcesPanel;

  return (
    <div className="sheet-resource-trackers">
      <div className="sheet-section-header">{heading}</div>

      {engine.resourceIds.map(id => (
        <DotTracker
          key={id}
          label={labelFor(id)}
          current={character.resources?.[id]?.current ?? 0}
          max={maxFor(id)}
          filledClass={id === 'wp' ? 'wp-dot-filled' : 'hp-dot-filled'}
        />
      ))}

      {/* Rest Checkboxes — one per rest the system defines */}
      {engine.rest && engine.rest.length > 0 && (
        <div className="sheet-rest-row">
          {engine.rest.map(rest => (
            <label key={rest.id} className="sheet-rest-checkbox">
              <span className="sheet-checkbox-box" />
              <span className="sheet-checkbox-label">{rest.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Death Rolls — only for systems that model a dying character */}
      {engine.death && (
        <div className="sheet-death-rolls">
          <div className="sheet-section-header">Death Rolls</div>
          {/* Printed order has always been successes first; the engine lists
              failures first because that is the order the play UI stacks them. */}
          {[...engine.death.tracks]
            .sort((a, b) => Number(a.tone === 'danger') - Number(b.tone === 'danger'))
            .map(track => (
              <div key={track.id} className="sheet-death-roll-row">
                <span className="sheet-death-label">{PRINT_DEATH_TRACK_LABELS[track.id] ?? track.label}</span>
                {Array.from({ length: track.max }).map((_, i) => (
                  <span key={i} className="sheet-checkbox-box" />
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Main Export — PrintableSheet
// ══════════════════════════════════════════════

/**
 * Full print layout for a character sheet — a pure, side-effect-free render.
 *
 * @remarks
 * Composes the section sub-components (header, attribute band, derived row, and the
 * three-column body/lower sections) into a single printable page. Everything that
 * varies by ruleset is resolved through the passed-in {@link SystemEngine} and
 * `system` definition rather than any Dragonbane-specific logic, so a different
 * system prints its own fields, currency, and stats. Interactivity and data loading
 * live in `PrintScreen` (the `/print` route); this component only renders.
 */
export default function PrintableSheet({
  character,
  system,
  derived,
  colorMode,
  engine,
}: PrintableSheetProps): React.ReactElement {
  const sheetClass = `print-sheet print-sheet--${colorMode}`;

  return (
    <div className={sheetClass}>
      {/* 1. Header */}
      <SheetHeader character={character} system={system} />

      {/* 2. Attribute Band + Conditions (SS-05) */}
      <AttributeBand character={character} system={system} engine={engine} />

      {/* 3. Derived Stats Row (SS-06) */}
      <DerivedStatsRow derived={derived} engine={engine} />

      {/* 4. Three-column body */}
      <div className="print-body-columns">
        {/* Left: Abilities/Spells + Currency */}
        <div className="print-col print-col--left">
          <AbilitiesSpells character={character} engine={engine} />
          <Currency character={character} engine={engine} />
        </div>

        {/* Center: Skills */}
        <div className="print-col print-col--center">
          <SkillsSection character={character} system={system} />
        </div>

        {/* Right: Inventory */}
        <div className="print-col print-col--right">
          <InventorySection character={character} engine={engine} />
        </div>
      </div>

      {/* 5. Lower section (3 columns) */}
      <div className="print-lower-columns">
        <div className="print-col print-col--left">
          <ArmorHelmet character={character} engine={engine} />
        </div>
        <div className="print-col print-col--center">
          <WeaponsTable character={character} system={system} />
        </div>
        <div className="print-col print-col--right">
          <ResourceTrackers character={character} derived={derived} system={system} engine={engine} />
        </div>
      </div>
    </div>
  );
}
