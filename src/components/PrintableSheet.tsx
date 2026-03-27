// PrintableSheet — SS-03: Pure render component (zero interactivity, zero side-effects)

import React from 'react';
import type {
  CharacterRecord,
  Weapon,
  Spell,
  HeroicAbility,
} from '../types/character';
import type { SystemDefinition, SkillDefinition } from '../types/system';

// ──────────────────────────────────────────────
// Exported types (consumed by SS-02 screen)
// ──────────────────────────────────────────────

export interface PrintDerivedValues {
  damageBonus: string;
  aglDamageBonus: string;
  movement: number;
  encumbranceLimit: number;
  hpMax: number;
  wpMax: number;
}

interface PrintableSheetProps {
  character: CharacterRecord;
  system: SystemDefinition | null;
  derived: PrintDerivedValues;
  colorMode: 'color' | 'bw';
}

// ──────────────────────────────────────────────
// Section 1 — Sheet Header (SS-04)
// ──────────────────────────────────────────────

function SheetHeader({ character }: { character: CharacterRecord }): React.ReactElement {
  return (
    <div className="sheet-header">
      <div className="sheet-title">DRAGONBANE</div>
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
        <div className="sheet-field">
          <span className="sheet-label">Kin</span>
          <span className="sheet-value">{character.metadata?.kin || ''}</span>
        </div>
        <div className="sheet-field">
          <span className="sheet-label">Age</span>
          <span className="sheet-value">{character.metadata?.age || ''}</span>
        </div>
        <div className="sheet-field">
          <span className="sheet-label">Profession</span>
          <span className="sheet-value">{character.metadata?.profession || ''}</span>
        </div>
      </div>
      <div className="sheet-identity-row">
        <div className="sheet-field sheet-field--wide">
          <span className="sheet-label">Weakness</span>
          <span className="sheet-value">{character.metadata?.weakness || ''}</span>
        </div>
        <div className="sheet-field sheet-field--wide">
          <span className="sheet-label">Appearance</span>
          <span className="sheet-value">{character.metadata?.appearance || ''}</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 2 — Attribute Band (SS-05)
// ──────────────────────────────────────────────

function AttributeBand({
  character,
}: {
  character: CharacterRecord;
}): React.ReactElement {
  return (
    <div className="sheet-attribute-band">
      {[
        { label: 'STR', key: 'str' },
        { label: 'CON', key: 'con' },
        { label: 'AGL', key: 'agl' },
        { label: 'INT', key: 'int' },
        { label: 'WIL', key: 'wil' },
        { label: 'CHA', key: 'cha' },
      ].map(({ label, key }) => (
        <div key={key} className="sheet-attribute-box">
          <div className="sheet-attribute-label">{label}</div>
          <div className="sheet-attribute-value">
            {character.attributes?.[key] != null ? character.attributes[key] : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 2b — Conditions (SS-05)
// ──────────────────────────────────────────────

function ConditionBand({
  character,
}: {
  character: CharacterRecord;
}): React.ReactElement {
  return (
    <div className="sheet-conditions">
      {[
        { label: 'Exhausted',    key: 'exhausted' },
        { label: 'Sickly',       key: 'sickly' },
        { label: 'Dazed',        key: 'dazed' },
        { label: 'Angry',        key: 'angry' },
        { label: 'Scared',       key: 'scared' },
        { label: 'Disheartened', key: 'disheartened' },
      ].map(({ label, key }) => {
        const active = character.conditions?.[key] === true;
        return (
          <span key={key} className="sheet-condition">
            <span className="sheet-condition-diamond">{active ? '◆' : '◇'}</span>
            <span className="sheet-condition-label">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 3 — Derived Stats Row (SS-06)
// ──────────────────────────────────────────────

function DerivedStatsRow({
  derived,
}: {
  derived: PrintDerivedValues;
}): React.ReactElement {
  return (
    <div className="sheet-derived-row">
      <div className="sheet-derived-field">
        <span className="sheet-derived-label">Damage Bonus (STR)</span>
        <span className="sheet-derived-value">{derived.damageBonus}</span>
      </div>
      <div className="sheet-derived-field">
        <span className="sheet-derived-label">Damage Bonus (AGL)</span>
        <span className="sheet-derived-value">{derived.aglDamageBonus}</span>
      </div>
      <div className="sheet-derived-field">
        <span className="sheet-derived-label">Movement</span>
        <span className="sheet-derived-value">{derived.movement}</span>
      </div>
      <div className="sheet-derived-field">
        <span className="sheet-derived-label">Encumbrance Limit</span>
        <span className="sheet-derived-value">{derived.encumbranceLimit}</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 4 Left — Abilities & Spells (SS-08)
// ──────────────────────────────────────────────

// SS-15 Mitigation C: reduced slot counts to ensure single-page fit
const ABILITY_SLOTS = 3;
const SPELL_SLOTS = 3;

function AbilitiesSpells({
  character,
}: {
  character: CharacterRecord;
}): React.ReactElement {
  const abilities: HeroicAbility[] = character.heroicAbilities ?? [];
  const spells: Spell[] = character.spells ?? [];

  return (
    <div className="sheet-abilities-spells">
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

      <div className="sheet-section-header">Spells</div>
      {spells.map((spell, i) => (
        <div key={i} className="sheet-ability-row">
          {spell.name}
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

function Currency({ character }: { character: CharacterRecord }): React.ReactElement {
  return (
    <div className="sheet-currency">
      <div className="sheet-section-header">Currency</div>
      <div className="sheet-currency-row">
        <div className="sheet-currency-field">
          <span className="sheet-currency-label">Gold</span>
          <span className="sheet-currency-value">{character.coins?.gold ?? 0}</span>
        </div>
        <div className="sheet-currency-field">
          <span className="sheet-currency-label">Silver</span>
          <span className="sheet-currency-value">{character.coins?.silver ?? 0}</span>
        </div>
        <div className="sheet-currency-field">
          <span className="sheet-currency-label">Copper</span>
          <span className="sheet-currency-value">{character.coins?.copper ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Section 4 Center — Skills (SS-07)
// ──────────────────────────────────────────────

function SkillRow({
  skillKey,
  name,
  value,
  trained,
}: {
  skillKey: string;
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

function SkillsSection({
  character,
  system,
}: {
  character: CharacterRecord;
  system: SystemDefinition | null;
}): React.ReactElement {
  const skillCategories = system?.skillCategories ?? [];

  // Find general (core) and weapon categories by id
  const generalCategory = skillCategories.find((cat) => cat.id === 'core');
  const weaponCategory = skillCategories.find((cat) => cat.id === 'weapon');

  const generalSkills: SkillDefinition[] = generalCategory?.skills ?? [];
  const weaponSkills: SkillDefinition[] = weaponCategory?.skills ?? [];

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
      <div className="sheet-section-header">General Skills</div>
      {generalSkills.map((skill) => {
        const charSkill = character.skills?.[skill.id];
        return (
          <SkillRow
            key={skill.id}
            skillKey={skill.id}
            name={skill.name}
            value={charSkill?.value ?? ''}
            trained={charSkill?.trained ?? false}
          />
        );
      })}

      <div className="sheet-section-header">Weapon Skills</div>
      {weaponSkills.map((skill) => {
        const charSkill = character.skills?.[skill.id];
        return (
          <SkillRow
            key={skill.id}
            skillKey={skill.id}
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
            skillKey={key ?? `secondary-${i}`}
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

function InventorySection({
  character,
}: {
  character: CharacterRecord;
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

      {/* Memento */}
      <div className="sheet-inventory-slot sheet-inventory-memento">
        <span className="sheet-inventory-label">Memento:</span>
        <span className="sheet-inventory-name">{character.memento ?? ''}</span>
      </div>

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

function ArmorHelmet({ character }: { character: CharacterRecord }): React.ReactElement {
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
            <span className="sheet-field-value">{character.armor?.rating ?? ''}</span>
          </div>
          <div className="sheet-equipment-field sheet-equipment-features">
            <span className="sheet-field-label">Features / Bane-on</span>
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
            <span className="sheet-field-value">{character.helmet?.rating ?? ''}</span>
          </div>
          <div className="sheet-equipment-field sheet-equipment-features">
            <span className="sheet-field-label">Features / Bane-on</span>
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

function formatGrip(grip: string | undefined): string {
  if (!grip) return '';
  const lower = grip.toLowerCase();
  if (lower.includes('2') || lower.includes('two')) return '2H';
  if (lower.includes('1') || lower.includes('one')) return '1H';
  return grip; // pass-through for unexpected values
}

function WeaponsTable({ character }: { character: CharacterRecord }): React.ReactElement {
  return (
    <div className="sheet-weapons">
      <div className="sheet-section-header">Weapons</div>
      <table className="sheet-weapons-table">
        <thead>
          <tr>
            <th className="col-name">Name</th>
            <th className="col-grip">Grip</th>
            <th className="col-range">Range</th>
            <th className="col-damage">Damage</th>
            <th className="col-durability">Dur.</th>
            <th className="col-features">Features</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 3 }).map((_, i) => {
            const weapon = character.weapons?.[i];
            return (
              <tr key={i} className={weapon ? '' : 'sheet-blank-row'}>
                <td>{weapon?.name ?? ''}</td>
                <td>{weapon ? formatGrip(weapon.grip) : ''}</td>
                <td>{weapon?.range ?? ''}</td>
                <td>{weapon?.damage ?? ''}</td>
                <td>{weapon?.durability ?? ''}</td>
                <td>{weapon?.features ?? ''}</td>
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

function ResourceTrackers({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: PrintDerivedValues;
}): React.ReactElement {
  return (
    <div className="sheet-resource-trackers">
      <div className="sheet-section-header">Hit Points &amp; Willpower</div>

      <DotTracker
        label="HP"
        current={character.resources?.['hp']?.current ?? 0}
        max={derived.hpMax}
        filledClass="hp-dot-filled"
      />

      <DotTracker
        label="WP"
        current={character.resources?.['wp']?.current ?? 0}
        max={derived.wpMax}
        filledClass="wp-dot-filled"
      />

      {/* Rest Checkboxes */}
      <div className="sheet-rest-row">
        <label className="sheet-rest-checkbox">
          <span className="sheet-checkbox-box" />
          <span className="sheet-checkbox-label">Round Rest</span>
        </label>
        <label className="sheet-rest-checkbox">
          <span className="sheet-checkbox-box" />
          <span className="sheet-checkbox-label">Stretch Rest</span>
        </label>
      </div>

      {/* Death Rolls */}
      <div className="sheet-death-rolls">
        <div className="sheet-section-header">Death Rolls</div>
        <div className="sheet-death-roll-row">
          <span className="sheet-death-label">Success</span>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className="sheet-checkbox-box" />
          ))}
        </div>
        <div className="sheet-death-roll-row">
          <span className="sheet-death-label">Failure</span>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className="sheet-checkbox-box" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Main Export — PrintableSheet
// ══════════════════════════════════════════════

export default function PrintableSheet({
  character,
  system,
  derived,
  colorMode,
}: PrintableSheetProps): React.ReactElement {
  const sheetClass = `print-sheet print-sheet--${colorMode}`;

  return (
    <div className={sheetClass}>
      {/* 1. Header */}
      <SheetHeader character={character} />

      {/* 2. Attribute Band + Conditions (SS-05) */}
      <AttributeBand character={character} />
      <ConditionBand character={character} />

      {/* 3. Derived Stats Row (SS-06) */}
      <DerivedStatsRow derived={derived} />

      {/* 4. Three-column body */}
      <div className="print-body-columns">
        {/* Left: Abilities/Spells + Currency */}
        <div className="print-col print-col--left">
          <AbilitiesSpells character={character} />
          <Currency character={character} />
        </div>

        {/* Center: Skills */}
        <div className="print-col print-col--center">
          <SkillsSection character={character} system={system} />
        </div>

        {/* Right: Inventory */}
        <div className="print-col print-col--right">
          <InventorySection character={character} />
        </div>
      </div>

      {/* 5. Lower section (3 columns) */}
      <div className="print-lower-columns">
        <div className="print-col print-col--left">
          <ArmorHelmet character={character} />
        </div>
        <div className="print-col print-col--center">
          <WeaponsTable character={character} />
        </div>
        <div className="print-col print-col--right">
          <ResourceTrackers character={character} derived={derived} />
        </div>
      </div>
    </div>
  );
}
