import type { CharacterRecord } from '../types/character';
import type { ConditionDefinition, SystemDefinition } from '../types/system';

/**
 * What the character's active conditions do to a roll.
 *
 * @remarks
 * `boonBane` is the roll-under advantage state; `modifier` is a flat adjustment
 * for systems that express the same idea as a number. A ruleset uses whichever
 * it declares — they are not two spellings of one thing, and a system could in
 * principle produce both.
 */
export interface ConditionPenalty {
  /** Advantage state imposed on this roll, if any. */
  boonBane: 'boon' | 'none' | 'bane';
  /** Flat modifier to the roll, summed across every active condition. */
  modifier: number;
  /** Whether an active condition forbids acting at all. */
  blocksActions: boolean;
  /** Names of the conditions that contributed, for display. */
  sources: string[];
}

/** The roll a penalty is being computed for. */
export interface ConditionContext {
  /** Attribute the skill is linked to, when it has one. */
  linkedAttributeId?: string;
}

/** Active conditions, in the order the system declares them. */
function activeConditions(
  system: SystemDefinition | null | undefined,
  character: CharacterRecord | null | undefined,
): ConditionDefinition[] {
  if (!system || !character) return [];
  return system.conditions.filter(c => character.conditions?.[c.id]);
}

/**
 * Resolves every active condition's declared effect against one roll.
 *
 * @remarks
 * The rules live in `conditions[].effect` in each system's JSON, which is where
 * a ruleset states them. Before this, that field was declared by Savage Worlds
 * and read by nothing: `savageTraitPenalty` hardcoded `distracted` and
 * `entangled` by id and by magnitude, so editing the declaration changed the
 * description a player reads and not the number they roll — and a fourth
 * condition added to the JSON did nothing at all. Dragonbane meanwhile used a
 * different field, `linkedAttributeId`, read by a different helper.
 *
 * Both are handled here. `attribute-linked` is Dragonbane's rule — a condition
 * banes skills linked to its own attribute — and `all-traits` is a flat penalty
 * on everything. `no-actions` reports that the character cannot act rather than
 * silently contributing zero.
 *
 * @param system - The active system definition.
 * @param character - The character whose conditions are active.
 * @param context - The roll being made.
 */
export function conditionPenalty(
  system: SystemDefinition | null | undefined,
  character: CharacterRecord | null | undefined,
  context: ConditionContext = {},
): ConditionPenalty {
  const penalty: ConditionPenalty = {
    boonBane: 'none',
    modifier: 0,
    blocksActions: false,
    sources: [],
  };

  for (const condition of activeConditions(system, character)) {
    const effect = condition.effect;

    // A condition with no declared effect but a linked attribute is
    // Dragonbane's shape, which predates `effect` and is still what
    // classic-fantasy's JSON carries.
    if (!effect) {
      if (condition.linkedAttributeId && condition.linkedAttributeId === context.linkedAttributeId) {
        penalty.boonBane = 'bane';
        penalty.sources.push(condition.name);
      }
      continue;
    }

    switch (effect.scope) {
      case 'all-traits':
        penalty.modifier += effect.modifier;
        penalty.sources.push(condition.name);
        break;
      case 'attribute-linked':
        if (condition.linkedAttributeId === context.linkedAttributeId) {
          penalty.modifier += effect.modifier;
          penalty.boonBane = 'bane';
          penalty.sources.push(condition.name);
        }
        break;
      case 'no-actions':
        penalty.blocksActions = true;
        penalty.sources.push(condition.name);
        break;
    }
  }

  return penalty;
}

/**
 * Whether an active condition imposes a bane on a skill linked to
 * `linkedAttributeId`.
 *
 * @remarks
 * Kept as the narrow question the two skill surfaces ask. It now delegates to
 * {@link conditionPenalty}, so a system expressing the same rule through
 * `effect: { scope: 'attribute-linked' }` gets the bane too — previously only
 * the bare `linkedAttributeId` shape was recognised.
 */
export function conditionImposesBane(
  system: SystemDefinition | null | undefined,
  character: CharacterRecord | null | undefined,
  linkedAttributeId: string | undefined,
): boolean {
  return conditionPenalty(system, character, { linkedAttributeId }).boonBane === 'bane';
}
