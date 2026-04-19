/**
 * The four Dragonbane skill-check outcomes.
 */
export type SkillCheckResult = 'success' | 'failure' | 'dragon' | 'demon';

/**
 * Modifier flags that can be applied to a skill-check roll.
 */
export interface SkillCheckMods {
  boon: boolean;
  bane: boolean;
  pushed: boolean;
}

/**
 * The shape of `note.typeData` on skill-check notes. Older rows may be missing
 * `mods` — callers should treat it as optional and fall back to parsing the
 * title when necessary.
 */
export interface SkillCheckTypeData {
  skill: string;
  result: SkillCheckResult;
  character: string;
  mods?: SkillCheckMods;
}

/**
 * Formats active modifiers as a parenthetical tag, e.g. ` (Boon, Pushed)`.
 * Empty string when no modifiers are active.
 */
export function formatModTags(mods: SkillCheckMods): string {
  const tags: string[] = [];
  if (mods.boon) tags.push('Boon');
  if (mods.bane) tags.push('Bane');
  if (mods.pushed) tags.push('Pushed');
  return tags.length > 0 ? ` (${tags.join(', ')})` : '';
}

/**
 * Rebuilds the canonical skill-check note title from structured data:
 *   "{character}: {skill}{mods?} — {result}"
 */
export function formatSkillCheckTitle(data: {
  character: string;
  skill: string;
  result: SkillCheckResult;
  mods?: SkillCheckMods;
}): string {
  const modTag = data.mods ? formatModTags(data.mods) : '';
  const who = data.character || 'Unknown';
  return `${who}: ${data.skill}${modTag} — ${data.result}`;
}

/**
 * Parses modifier flags out of a legacy skill-check title. Used when a note
 * was logged before `typeData.mods` existed.
 */
export function parseModsFromTitle(title: string): SkillCheckMods {
  const match = title.match(/\(([^)]+)\)/);
  const tokens = match ? match[1].split(',').map(t => t.trim().toLowerCase()) : [];
  return {
    boon: tokens.includes('boon'),
    bane: tokens.includes('bane'),
    pushed: tokens.includes('pushed'),
  };
}
