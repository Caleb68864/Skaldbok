/**
 * The stored id of a roll outcome.
 *
 * @remarks
 * Deliberately `string`, not a union. Outcome ids are **engine data** —
 * `engine.outcomes` supplies them and they differ per ruleset: Dragonbane has
 * `dragon`/`demon`, Traveller has `exceptional-success`/`exceptional-failure`,
 * Savage Worlds has `raise`/`critical-failure`. A closed union here was a
 * consumer-side vocabulary pretending to be authoritative, and the one place
 * the compiler could have objected was suppressed by an `as OutcomeResult`
 * cast at the call site.
 *
 * The id is the stable persisted key; display strings come from the engine's
 * `label`. Never derive one from the other.
 */
export type OutcomeResult = string;

/** Kept as a back-compat alias so older imports keep compiling. */
export type SkillCheckResult = OutcomeResult;

/**
 * Which roll modifiers were active, keyed by the engine's modifier id.
 *
 * @remarks
 * Also engine data: Dragonbane has boon/bane/pushed, Traveller drops pushed,
 * Savage Worlds has gang-up/cover/wild-attack. Absent means inactive, so a
 * partial object is valid.
 */
export type OutcomeMods = Record<string, boolean>;

/** An engine-supplied id/label pair, as `outcomes` and `rollModifiers` provide. */
export interface LabelledId {
  id: string;
  label: string;
}

/** Label sources for rendering a stored outcome back into human words. */
export interface OutcomeVocabulary {
  outcomes?: LabelledId[];
  rollModifiers?: LabelledId[];
}

/**
 * Best-effort display label for an id the supplied vocabulary does not contain.
 *
 * @remarks
 * Reached when a row was logged under a system that has since been edited, or
 * when a caller has no engine to hand. `exceptional-success` reads as
 * "Exceptional Success" rather than leaking the machine id into the timeline.
 */
function humanise(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Resolves an id to its label, falling back to {@link humanise}. */
function labelFor(id: string, vocabulary: LabelledId[] | undefined): string {
  return vocabulary?.find(entry => entry.id === id)?.label ?? humanise(id);
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
export function formatModTags(mods: OutcomeMods, rollModifiers?: LabelledId[]): string {
  // Order by the engine's vocabulary when we have one, so the tag reads the
  // same way every time regardless of which chip the user tapped first. With no
  // vocabulary, fall back to insertion order.
  const activeIds = Object.keys(mods).filter(id => mods[id]);
  const ordered = rollModifiers
    ? [
        ...rollModifiers.filter(m => activeIds.includes(m.id)).map(m => m.id),
        ...activeIds.filter(id => !rollModifiers.some(m => m.id === id)),
      ]
    : activeIds;
  const tags = ordered.map(id => labelFor(id, rollModifiers));
  return tags.length > 0 ? ` (${tags.join(', ')})` : '';
}

/**
 * Rebuilds the canonical title: `"{actor}: {subject}{mods?} — {result}"`.
 */
export function formatOutcomeTitle(
  data: {
    actor: string;
    subject: string;
    result: OutcomeResult;
    mods?: OutcomeMods;
  },
  vocabulary?: OutcomeVocabulary,
): string {
  const modTag = data.mods ? formatModTags(data.mods, vocabulary?.rollModifiers) : '';
  const who = data.actor || 'Unknown';
  // The stored value is the id; the timeline shows the label. Printing the id
  // read acceptably only because Dragonbane's happen to be English words —
  // Traveller's rendered as "— exceptional-success".
  return `${who}: ${data.subject}${modTag} — ${labelFor(data.result, vocabulary?.outcomes)}`;
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
