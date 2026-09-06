import { describe, it, expect } from 'vitest';
import { conditionPenalty, conditionImposesBane } from './conditionEffects';
import { classicFantasySystem } from '../systems/classic-fantasy';
import { savageWorldsSystem } from '../systems/savage-worlds';
import type { CharacterRecord } from '../types/character';
import type { SystemDefinition } from '../types/system';

/**
 * Two systems state the same idea — "this condition makes rolls worse" — in two
 * different fields. Dragonbane declares `linkedAttributeId` and banes the skills
 * tied to it; Savage Worlds declares `effect: { scope, modifier }`. The second
 * was read by nothing: the adapter matched `distracted` and `entangled` by id
 * and hardcoded their magnitude.
 */

function character(conditions: Record<string, boolean>): CharacterRecord {
  return { conditions } as unknown as CharacterRecord;
}

describe('conditionPenalty', () => {
  it('is empty with no active conditions', () => {
    const p = conditionPenalty(savageWorldsSystem, character({}));
    expect(p).toEqual({ boonBane: 'none', modifier: 0, blocksActions: false, sources: [] });
  });

  it('sums declared all-traits modifiers and names their sources', () => {
    const p = conditionPenalty(savageWorldsSystem, character({ distracted: true, entangled: true }));
    expect(p.modifier).toBe(-4);
    expect(p.sources).toContain('Distracted');
    expect(p.sources).toContain('Entangled');
  });

  it('reports a no-actions condition rather than counting it as zero', () => {
    const p = conditionPenalty(savageWorldsSystem, character({ shaken: true }));
    expect(p.blocksActions).toBe(true);
    expect(p.modifier).toBe(0);
  });

  it('banes only the skills linked to a Dragonbane condition attribute', () => {
    // classic-fantasy declares linkedAttributeId and no `effect`.
    const exhausted = classicFantasySystem.conditions.find(c => c.linkedAttributeId);
    expect(exhausted, 'classic-fantasy should declare a linked-attribute condition').toBeDefined();
    const c = character({ [exhausted!.id]: true });

    expect(conditionPenalty(classicFantasySystem, c, { linkedAttributeId: exhausted!.linkedAttributeId }).boonBane).toBe('bane');
    expect(conditionPenalty(classicFantasySystem, c, { linkedAttributeId: 'not-that-one' }).boonBane).toBe('none');
    expect(conditionPenalty(classicFantasySystem, c, {}).boonBane).toBe('none');
  });

  it('honours the attribute-linked effect scope as well as the bare field', () => {
    // A system stating Dragonbane's rule the newer way must behave the same.
    const system = {
      conditions: [
        {
          id: 'weakened',
          name: 'Weakened',
          description: '',
          linkedAttributeId: 'str',
          effect: { scope: 'attribute-linked' as const, modifier: -2 },
        },
      ],
    } as unknown as SystemDefinition;
    const c = character({ weakened: true });

    const hit = conditionPenalty(system, c, { linkedAttributeId: 'str' });
    expect(hit.boonBane).toBe('bane');
    expect(hit.modifier).toBe(-2);

    const miss = conditionPenalty(system, c, { linkedAttributeId: 'agl' });
    expect(miss.boonBane).toBe('none');
    expect(miss.modifier).toBe(0);
  });

  it('ignores a condition the character does not have', () => {
    expect(conditionPenalty(savageWorldsSystem, character({ distracted: false })).modifier).toBe(0);
  });

  it('is safe with no system or no character', () => {
    expect(conditionPenalty(null, character({ distracted: true })).modifier).toBe(0);
    expect(conditionPenalty(savageWorldsSystem, null).modifier).toBe(0);
  });
});

describe('conditionImposesBane', () => {
  it('still answers the narrow question the skill surfaces ask', () => {
    const linked = classicFantasySystem.conditions.find(c => c.linkedAttributeId)!;
    const c = character({ [linked.id]: true });
    expect(conditionImposesBane(classicFantasySystem, c, linked.linkedAttributeId)).toBe(true);
    expect(conditionImposesBane(classicFantasySystem, c, 'other')).toBe(false);
    expect(conditionImposesBane(classicFantasySystem, character({}), linked.linkedAttributeId)).toBe(false);
  });
});
