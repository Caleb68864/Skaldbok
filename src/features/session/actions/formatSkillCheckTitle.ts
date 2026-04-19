/**
 * The four Dragonbane outcomes applicable to skill checks, spell casts, and
 * heroic ability uses.
 */
export type OutcomeResult = 'success' | 'failure' | 'dragon' | 'demon';

/** Kept as a back-compat alias so older imports keep compiling. */
export type SkillCheckResult = OutcomeResult;

/**
 * Modifier flags that can be applied to a d20 roll.
 */
export interface OutcomeMods {
  boon: boolean;
  bane: boolean;
  pushed: boolean;
}

/** Back-compat alias. */
export type SkillCheckMods = OutcomeMods;

/**
 * Structural `typeData` shape for a logged outcome, shared across
 * `'skill-check'`, `'spell-cast'`, and `'ability-use'` notes.
 *
 * @remarks
 * The `subject` field is whichever thing was rolled: a skill name for a
 * skill check, a spell name for a cast, an ability name for a use. `actor`
 * is the display name of the character/party that performed the action.
 * Older skill-check rows use `skill` / `character` instead — readers
 * should fall back to those.
 */
export interface OutcomeTypeData {
  subject: string;
  actor: string;
  result: OutcomeResult;
  mods?: OutcomeMods;
}

/** Legacy skill-check payload shape still found on rows logged pre-generalisation. */
export interface SkillCheckTypeData {
  skill: string;
  result: OutcomeResult;
  character: string;
  mods?: OutcomeMods;
}

/**
 * Formats active modifiers as a parenthetical tag, e.g. ` (Boon, Pushed)`.
 */
export function formatModTags(mods: OutcomeMods): string {
  const tags: string[] = [];
  if (mods.boon) tags.push('Boon');
  if (mods.bane) tags.push('Bane');
  if (mods.pushed) tags.push('Pushed');
  return tags.length > 0 ? ` (${tags.join(', ')})` : '';
}

/**
 * Rebuilds the canonical title: `"{actor}: {subject}{mods?} — {result}"`.
 */
export function formatOutcomeTitle(data: {
  actor: string;
  subject: string;
  result: OutcomeResult;
  mods?: OutcomeMods;
}): string {
  const modTag = data.mods ? formatModTags(data.mods) : '';
  const who = data.actor || 'Unknown';
  return `${who}: ${data.subject}${modTag} — ${data.result}`;
}

/** Back-compat alias. */
export function formatSkillCheckTitle(data: {
  character: string;
  skill: string;
  result: OutcomeResult;
  mods?: OutcomeMods;
}): string {
  return formatOutcomeTitle({
    actor: data.character,
    subject: data.skill,
    result: data.result,
    mods: data.mods,
  });
}

/**
 * Parses modifier flags out of a title for rows logged before `mods` was
 * stored structurally.
 */
export function parseModsFromTitle(title: string): OutcomeMods {
  const match = title.match(/\(([^)]+)\)/);
  const tokens = match ? match[1].split(',').map(t => t.trim().toLowerCase()) : [];
  return {
    boon: tokens.includes('boon'),
    bane: tokens.includes('bane'),
    pushed: tokens.includes('pushed'),
  };
}

/**
 * Extracts the `subject` / `actor` fields from a note's `typeData` regardless
 * of whether it was stored in the new generalised shape or the legacy
 * skill-check shape.
 */
export function readOutcomeTypeData(
  typeData: unknown,
  fallbackTitle: string,
): OutcomeTypeData {
  const data = (typeData ?? {}) as Partial<OutcomeTypeData & SkillCheckTypeData>;
  const subject = data.subject ?? data.skill ?? '';
  const actor = data.actor ?? data.character ?? '';
  const result = (data.result as OutcomeResult) ?? 'success';
  const mods = data.mods ?? parseModsFromTitle(fallbackTitle);
  return { subject, actor, result, mods };
}
