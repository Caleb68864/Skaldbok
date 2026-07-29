import { describe, it, expect } from 'vitest';
import {
  toSpells,
  toHeroicAbilities,
  fromSpell,
  fromHeroicAbility,
  withSpells,
  withHeroicAbilities,
  ABILITY_TYPE,
} from './abilities';
import type { Ability, Spell, HeroicAbility } from '../types/character';

const spell: Spell = {
  id: 's1',
  name: 'Fireball',
  school: 'Elementalism',
  powerLevel: 2,
  wpCost: 4,
  range: 'Far',
  duration: 'Immediate',
  summary: 'Burns things.',
  prepared: true,
  rank: 2,
  castingTime: 'action',
  powerScaling: ['a', 'b', 'c'],
};

const heroic: HeroicAbility = {
  id: 'h1',
  name: 'Veteran',
  summary: 'Extra attack.',
  wpCost: 3,
  requirement: 'Axes 12',
  requirementSkillId: 'axes',
  requirementSkillLevel: 12,
};

describe('ability projections', () => {
  it('round-trips a spell without losing a field', () => {
    const back = toSpells([fromSpell(spell)])[0];
    expect(back).toEqual(expect.objectContaining(spell));
  });

  it('round-trips a heroic ability without losing a field', () => {
    const back = toHeroicAbilities([fromHeroicAbility(heroic)])[0];
    expect(back).toEqual(expect.objectContaining(heroic));
  });

  it('stores the WP cost as a resource-keyed cost', () => {
    expect(fromSpell(spell).cost).toEqual({ wp: 4 });
    expect(fromHeroicAbility(heroic).cost).toEqual({ wp: 3 });
  });

  it('moves ruleset-specific fields into systemFields, not the top level', () => {
    const stored = fromSpell(spell);
    expect(stored.systemFields).toMatchObject({ school: 'Elementalism', powerLevel: 2 });
    expect(stored).not.toHaveProperty('school');
    expect(stored).not.toHaveProperty('wpCost');
  });

  it('keeps the two types separate', () => {
    const all: Ability[] = [fromSpell(spell), fromHeroicAbility(heroic)];
    expect(toSpells(all).map(s => s.id)).toEqual(['s1']);
    expect(toHeroicAbilities(all).map(a => a.id)).toEqual(['h1']);
  });

  it('withSpells replaces only spells and preserves other types', () => {
    const all: Ability[] = [fromSpell(spell), fromHeroicAbility(heroic)];
    const next = withSpells(all, []);
    expect(toSpells(next)).toHaveLength(0);
    // The heroic ability must survive a spell-only write.
    expect(toHeroicAbilities(next).map(a => a.id)).toEqual(['h1']);
  });

  it('withHeroicAbilities replaces only heroic abilities', () => {
    const all: Ability[] = [fromSpell(spell), fromHeroicAbility(heroic)];
    const next = withHeroicAbilities(all, []);
    expect(toHeroicAbilities(next)).toHaveLength(0);
    expect(toSpells(next).map(s => s.id)).toEqual(['s1']);
  });

  it('leaves a foreign ability type untouched through either write', () => {
    const talent: Ability = { id: 't1', type: 'talent', name: 'Jack of All Trades', summary: '' };
    const next = withHeroicAbilities(withSpells([talent], [spell]), [heroic]);
    expect(next.find(a => a.type === 'talent')).toEqual(talent);
  });

  it('handles an undefined collection', () => {
    expect(toSpells(undefined)).toEqual([]);
    expect(toHeroicAbilities(undefined)).toEqual([]);
  });

  it('defaults a missing cost to 0 WP for spells', () => {
    const bare: Ability = { id: 'x', type: ABILITY_TYPE.spell, name: 'Cantrip', summary: '' };
    expect(toSpells([bare])[0].wpCost).toBe(0);
  });

  // The projection used to read `a.cost?.wp` literally, so a system whose magic
  // pool is named anything else reported every spell as free.
  it('reads the cost under the requested resource id', () => {
    const psionic: Ability = {
      id: 'p1',
      type: ABILITY_TYPE.spell,
      name: 'Telepathy',
      summary: '',
      cost: { psi: 3 },
    };
    expect(toSpells([psionic], 'psi')[0].wpCost).toBe(3);
    // Still 0 under the default id — the cost is genuinely not stored there.
    expect(toSpells([psionic])[0].wpCost).toBe(0);
  });

  it('round-trips a non-default resource id through fromSpell', () => {
    const spell = toSpells([{
      id: 'p1',
      type: ABILITY_TYPE.spell,
      name: 'Telepathy',
      summary: '',
      cost: { psi: 3 },
    }], 'psi')[0];
    const stored = fromSpell(spell, 'psi');
    expect(stored.cost).toEqual({ psi: 3 });
    expect(toSpells([stored], 'psi')[0].wpCost).toBe(3);
  });
});
