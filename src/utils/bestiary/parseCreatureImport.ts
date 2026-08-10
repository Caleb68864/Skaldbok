import type { CreatureStatField } from '../../types/system';
import type {
  CreatureAbility,
  CreatureAttack,
  CreatureSkill,
} from '../../types/creatureTemplate';

/**
 * Parsing for creature JSON written elsewhere — typically animals or NPCs
 * researched in a chat with an AI and handed over as a file.
 *
 * @remarks
 * Sibling of `parseRouteImport`, and deliberately the same bargain: forgiving
 * about *shape*, strict about *stats*. Whatever produced the file will not have
 * read `system.creatures`, so it may wrap the list in an object or hand over a
 * bare array, may write `Armour` where the declaration says `armor`, and may put
 * the stats at the top level instead of under `stats`. None of that is worth
 * rejecting a file over.
 *
 * What it will not do is invent stats. A stat key matching no declared field is
 * dropped and **reported** — storing it would put a number in the record that
 * the sheet does not render, which is worse than losing it visibly. (Stats
 * already *stored* under an undeclared id are treated the opposite way and shown
 * in an "Other" group: those are data somebody entered, not an untrusted file.)
 */

/** One creature as it will be created. `stats` is keyed by declared stat id. */
export interface ParsedCreature {
  name: string;
  category: 'monster' | 'npc' | 'animal';
  role?: string;
  affiliation?: string;
  stats: Record<string, number>;
  attacks: CreatureAttack[];
  abilities: CreatureAbility[];
  skills: CreatureSkill[];
  tags: string[];
  description?: string;
}

/** Outcome of parsing an import file. */
export type CreatureImportResult =
  | { ok: true; creatures: ParsedCreature[]; warnings: string[] }
  | { ok: false; error: string };

/** Pulls the creature array out of the shapes a generator plausibly produces. */
function findCreatureArray(root: unknown): unknown[] | null {
  if (Array.isArray(root)) return root;
  if (root && typeof root === 'object') {
    const obj = root as Record<string, unknown>;
    for (const key of ['creatures', 'bestiary', 'monsters', 'animals', 'npcs', 'entries', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
    // A single creature handed over on its own, not wrapped in a list — the
    // most likely shape when somebody asks for "a stat block for a wolf".
    if (typeof obj.name === 'string') return [obj];
  }
  return null;
}

/** Normalises a key for matching: case- and separator-insensitive. */
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

/** Reads a stat value, accepting the strings a generator often emits ("12", "2d6" → null). */
function asStatNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Accept a leading integer so "12 (average)" and "8m" still land; reject
    // anything with no number at all rather than storing 0 and looking answered.
    const match = /^[+-]?\d+/.exec(trimmed);
    if (match) return Number(match[0]);
  }
  return null;
}

/** Renders a free-text field, tolerating numbers. */
function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

const CATEGORIES = ['monster', 'npc', 'animal'] as const;

/** Maps a category string onto the three the record allows. */
function asCategory(value: unknown): 'monster' | 'npc' | 'animal' {
  const text = normaliseKey(asText(value));
  const direct = CATEGORIES.find(c => c === text);
  if (direct) return direct;
  // Common synonyms from generated files. Anything unrecognised is a monster,
  // which is the bestiary's own default for a hand-created entry.
  if (['beast', 'creature', 'critter', 'fauna'].includes(text)) return 'animal';
  if (['person', 'character', 'humanoid', 'contact'].includes(text)) return 'npc';
  return 'monster';
}

/** Reads the attack list, accepting the field names a generator plausibly uses. */
function readAttacks(value: unknown): CreatureAttack[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(raw => {
    if (typeof raw === 'string') {
      // "Bite 2d6" as a bare string — keep it as a named attack rather than
      // dropping it; the damage column is where a reader will look next.
      return [{ name: raw.trim(), damage: '', range: '', skill: '' }];
    }
    if (!raw || typeof raw !== 'object') return [];
    const entry = raw as Record<string, unknown>;
    const name = asText(entry.name ?? entry.attack ?? entry.title);
    if (!name) return [];
    return [{
      name,
      damage: asText(entry.damage ?? entry.dmg ?? entry.damageDice),
      range: asText(entry.range),
      skill: asText(entry.skill),
      special: asText(entry.special ?? entry.notes ?? entry.note) || undefined,
    }];
  });
}

/** Reads the ability list. */
function readAbilities(value: unknown): CreatureAbility[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(raw => {
    if (typeof raw === 'string') return [{ name: raw.trim(), description: '' }];
    if (!raw || typeof raw !== 'object') return [];
    const entry = raw as Record<string, unknown>;
    const name = asText(entry.name ?? entry.ability ?? entry.title ?? entry.trait);
    if (!name) return [];
    return [{ name, description: asText(entry.description ?? entry.desc ?? entry.text ?? entry.notes) }];
  });
}

/** Reads the skill list; a skill with no numeric value is kept at 0. */
function readSkills(value: unknown): CreatureSkill[] {
  if (Array.isArray(value)) {
    return value.flatMap(raw => {
      if (typeof raw === 'string') return [{ name: raw.trim(), value: 0 }];
      if (!raw || typeof raw !== 'object') return [];
      const entry = raw as Record<string, unknown>;
      const name = asText(entry.name ?? entry.skill ?? entry.title);
      if (!name) return [];
      return [{ name, value: asStatNumber(entry.value ?? entry.level ?? entry.rating) ?? 0 }];
    });
  }
  // `{"Survival": 2, "Recon": 1}` — the shape a generator reaches for when the
  // skills are just name/level pairs.
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([name, v]) => ({
      name,
      value: asStatNumber(v) ?? 0,
    }));
  }
  return [];
}

/** Reads the tag list, accepting a comma-separated string. */
function readTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(t => t.trim()).filter(Boolean);
  return [];
}

/** Keys handled explicitly, so they are never reported as unrecognised stats. */
const STRUCTURAL_KEYS = new Set(
  [
    'name', 'category', 'type', 'kind', 'role', 'affiliation', 'faction',
    'stats', 'statblock', 'attributes', 'attacks', 'abilities', 'traits',
    'skills', 'tags', 'description', 'notes', 'text', 'imageurl', 'image',
  ].map(normaliseKey),
);

/**
 * Parses creature JSON against a system's declared stat fields.
 *
 * @param text - Raw file contents.
 * @param statFields - `system.creatures.statFields` for the active ruleset (or
 * the default set). Every stat key in the file must match one of these, by id or
 * label, loosely — anything else is dropped and reported.
 * @param maxCreatures - Guard against a runaway file, far above any plausible
 * bestiary import, so a malformed 100k-element array cannot lock the UI.
 */
export function parseCreatureImport(
  text: string,
  statFields: CreatureStatField[],
  maxCreatures = 200,
): CreatureImportResult {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  const raws = findCreatureArray(root);
  if (!raws) {
    return {
      ok: false,
      error:
        'Could not find any creatures. Expected a JSON array, an object with a "creatures" array, or a single creature with a "name".',
    };
  }
  if (raws.length === 0) return { ok: false, error: 'That file has no creatures in it.' };
  if (raws.length > maxCreatures) {
    return { ok: false, error: `That file has ${raws.length} creatures — more than ${maxCreatures}.` };
  }

  // Match on id, label and abbreviation, so a file written from what the screen
  // prints ("Hits") lands as readily as one written from the declaration ("hp").
  const byKey = new Map<string, string>();
  for (const field of statFields) {
    byKey.set(normaliseKey(field.id), field.id);
    byKey.set(normaliseKey(field.label), field.id);
    if (field.abbr) byKey.set(normaliseKey(field.abbr), field.id);
  }

  const creatures: ParsedCreature[] = [];
  const warnings: string[] = [];
  const unknownStats = new Set<string>();
  let skipped = 0;

  raws.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      skipped += 1;
      return;
    }
    const entry = raw as Record<string, unknown>;
    const name = asText(entry.name);
    if (!name) {
      skipped += 1;
      warnings.push(`Creature ${index + 1} has no name and was skipped.`);
      return;
    }

    // Stats may arrive nested under `stats`/`statblock`/`attributes`, or spread
    // across the creature itself. Read both; the nested block wins on a clash.
    const statSources: Array<Record<string, unknown>> = [entry];
    for (const key of ['stats', 'statblock', 'attributes']) {
      const nested = entry[key] ?? entry[normaliseKey(key)];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        statSources.push(nested as Record<string, unknown>);
      }
    }

    const stats: Record<string, number> = {};
    statSources.forEach((source, sourceIndex) => {
      const isNested = sourceIndex > 0;
      for (const [key, value] of Object.entries(source)) {
        const normalised = normaliseKey(key);
        const statId = byKey.get(normalised);
        if (!statId) {
          // Only a *nested* stat block can report unknown keys. At the top level
          // an unrecognised key is far more likely to be some other property of
          // the creature ("habitat", "sources") than a mistyped stat, and
          // reporting those as ignored stats is noise that hides the real ones.
          if (isNested && !STRUCTURAL_KEYS.has(normalised)) unknownStats.add(key);
          continue;
        }
        const numeric = asStatNumber(value);
        if (numeric !== null) stats[statId] = numeric;
      }
    });

    creatures.push({
      name,
      category: asCategory(entry.category ?? entry.type ?? entry.kind),
      role: asText(entry.role) || undefined,
      affiliation: asText(entry.affiliation ?? entry.faction) || undefined,
      stats,
      attacks: readAttacks(entry.attacks),
      abilities: readAbilities(entry.abilities ?? entry.traits),
      skills: readSkills(entry.skills),
      tags: readTags(entry.tags),
      description: asText(entry.description ?? entry.notes ?? entry.text) || undefined,
    });
  });

  if (creatures.length === 0) {
    return { ok: false, error: 'None of the creatures in that file had a name.' };
  }
  if (unknownStats.size > 0) {
    warnings.push(
      `Ignored ${unknownStats.size} unrecognised stat${unknownStats.size === 1 ? '' : 's'}: ${[...unknownStats].join(', ')}.`,
    );
  }
  if (skipped > 0 && !warnings.some(w => w.includes('no name'))) {
    warnings.push(`${skipped} entr${skipped === 1 ? 'y was' : 'ies were'} not readable and were skipped.`);
  }

  return { ok: true, creatures, warnings };
}
