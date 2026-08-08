import { describe, it, expect } from 'vitest';
import type { CharacterRecord } from '../../../types/character';
import {
  savageWorldsEngine,
  computeToughness,
  savageTraitPenalty,
  computeSavageWorldsDerivedValues,
  formatSavageSkill,
} from './savageWorldsEngine';
import { decodeTraitDie, traitLadder, traitChance } from '../../../systems/savage-worlds/savageMath';
import { BUNDLED_SYSTEMS } from '../../../systems/registry';

/** Minimal SWADE-shaped character for the pure derived/damage math. */
const swChar = (o: Partial<CharacterRecord> = {}) =>
  ({ attributes: { vigor: 6 }, armor: { rating: 4 }, resources: {}, conditions: {}, skills: {}, ...o } as unknown as CharacterRecord);

describe('computeToughness', () => {
  it('folds in armor with an odd-vigor floor and defaults ap to 0', () => {
    // 2 + floor(5/2)=2 + 3 = 7
    expect(computeToughness(swChar({ attributes: { vigor: 5 }, armor: { rating: 3 } } as never))).toBe(7);
  });
  it('never lets AP push effective armor below zero', () => {
    // ap 9 vs armor 2 → armor contributes 0, not -7; 2 + 3 + 0 = 5
    expect(computeToughness(swChar({ attributes: { vigor: 6 }, armor: { rating: 2 } } as never), 9)).toBe(5);
  });
  it('clamps a negative ap to 0 so it cannot add armor', () => {
    // 2 + 3 + 2 = 7
    expect(computeToughness(swChar({ attributes: { vigor: 6 }, armor: { rating: 2 } } as never), -4)).toBe(7);
  });
});

describe('savageWorldsEngine.resolveDamage', () => {
  it('bounces when total is under Toughness (armor intact)', () => {
    // Tough = 2 + floor(6/2) + 4 = 9
    const r = savageWorldsEngine.resolveDamage!(swChar(), { total: 8 });
    expect(r.noEffect).toBe(true);
    expect(r.levels).toEqual({});
    expect(r.setsConditions).toEqual([]);
  });
  it('armor-piercing lowers Toughness so the same hit now Shakes', () => {
    // ap 4 strips all armor → Tough 5; total 8 >= 5, 0 extra wounds
    const r = savageWorldsEngine.resolveDamage!(swChar(), { total: 8, ap: 4 });
    expect(r.noEffect).toBeFalsy();
    expect(r.setsConditions).toEqual(['shaken']);
    expect(r.levels).toEqual({});
  });
  it('adds a wound when already Shaken, plus one per 4 over Toughness', () => {
    // ap 4 → Tough 5; total 13 = Tough + 8 → 2 extra, +1 already-Shaken = 3
    const r = savageWorldsEngine.resolveDamage!(
      swChar({ conditions: { shaken: true } as never }),
      { total: 13, ap: 4 },
    );
    expect(r.levels).toEqual({ wounds: 3 });
    expect(r.setsConditions).toEqual(['shaken']);
  });
});

describe('savageTraitPenalty', () => {
  it('clamps an over-max Wounds/Fatigue import to -3 / -2', () => {
    const c = { resources: { wounds: { current: 9 }, fatigue: { current: 9 } }, conditions: {} } as never;
    expect(savageTraitPenalty(c)).toBe(-5); // not -18
  });
  it('adds -2 each for Distracted and Entangled on top of the tracks', () => {
    const c = {
      resources: { wounds: { current: 1 }, fatigue: { current: 0 } },
      conditions: { distracted: true, entangled: true },
    } as never;
    expect(savageTraitPenalty(c)).toBe(-5); // -1 wound, -2, -2
  });
  it('is 0 for an undamaged, unconditioned character', () => {
    expect(savageTraitPenalty({ resources: {}, conditions: {} } as never)).toBe(0);
  });
});

describe('computeSavageWorldsDerivedValues', () => {
  it('Parry is 2 for unskilled Fighting; Load = Str x 5', () => {
    expect(computeSavageWorldsDerivedValues(swChar({ attributes: { strength: 8 }, skills: {} } as never)))
      .toMatchObject({ parry: 2, pace: 6, encumbranceLimit: 40 });
  });
  it('Parry is 2 + half the Fighting die when trained', () => {
    expect(computeSavageWorldsDerivedValues(swChar({ attributes: { strength: 6 }, skills: { fighting: { value: 8 } } } as never)))
      .toMatchObject({ parry: 6 }); // 2 + floor(8/2)
  });
});

describe('formatSavageSkill', () => {
  it('shows the die and exploding odds with no label at zero penalty', () => {
    expect(formatSavageSkill(8)).toBe('d8 · 81%');
  });
  it('appends a signed penalty label and actually lowers the odds', () => {
    expect(formatSavageSkill(8, -2)).toMatch(/^d8 · \d+% \(-2\)$/);
    expect(formatSavageSkill(8, 1)).toContain('(+1)');
    // The penalty must flow through the probability, not just the label: a -2 die
    // has to read a lower % than the unpenalised one (guards a dropped `bonus`).
    const pct = (s: string) => Number(s.match(/· (\d+)%/)![1]);
    expect(pct(formatSavageSkill(8, -2))).toBeLessThan(pct(formatSavageSkill(8)));
    expect(pct(formatSavageSkill(8, 2))).toBeGreaterThan(pct(formatSavageSkill(8)));
  });
});

describe('advancing past d12', () => {
  /**
   * @remarks
   * `allowsPlus` was declared on all five SWADE attributes, validated by the
   * schema, and read by nothing. SWADE advances past d12 by adding a flat bonus
   * — d12+1, d12+2 — not by rolling a bigger die.
   */
  it('reads a stored 13 as d12+1, not as a d13', () => {
    expect(decodeTraitDie(13)).toEqual({ sides: 12, bonus: 1 });
    expect(decodeTraitDie(14)).toEqual({ sides: 12, bonus: 2 });
  });

  it('passes ordinary die values through untouched', () => {
    // Every existing character must be unaffected.
    for (const sides of [4, 6, 8, 10, 12]) {
      expect(decodeTraitDie(sides)).toEqual({ sides, bonus: 0 });
    }
  });

  it('prints d12+1 rather than d13', () => {
    expect(formatSavageSkill(13)).toContain('d12+1');
    expect(formatSavageSkill(13)).not.toContain('d13');
  });

  it('rolls d12+1 as a d12 with +1, which is a different distribution from a d13', () => {
    // Not uniformly better or worse, which is what makes the old behaviour
    // insidious: a flat +1 shifts the whole distribution while a bigger die
    // dilutes the probability per face, so at TN 8 the d12+1 is *better* than
    // the d13 it was being rolled as, and at other targets it is worse. Either
    // way the number shown was for a die that does not exist.
    const asBonus = traitChance(12, 8, { wild: true, bonus: 1 });
    const asBiggerDie = traitChance(13, 8, { wild: true });
    expect(asBonus).not.toBeCloseTo(asBiggerDie, 3);
    // The engine reports the rule's number, not the phantom die's.
    // formatSavageSkill always shows odds against TN 4, so compare against that.
    const displayed = Number(/(\d+)%/.exec(formatSavageSkill(13, 0, true))?.[1]);
    expect(displayed).toBe(Math.round(traitChance(12, 4, { wild: true, bonus: 1 }) * 100));
    expect(displayed).not.toBe(Math.round(traitChance(13, 4, { wild: true }) * 100));
  });

  it('keeps the extra rungs on the ladder so an edit cannot snap them away', () => {
    // Without 13/14 on the ladder, SkillsScreen's snap-to-nearest pulls a
    // Legendary advance back to d12 the first time the field is touched.
    expect(savageWorldsEngine.skill.ladder).toEqual([4, 6, 8, 10, 12, 13, 14]);
    expect(savageWorldsEngine.skill.range.max).toBe(14);
  });

  it('adds the die bonus whole to Parry and Toughness, not halved', () => {
    // Half the *die*, plus the flat bonus: d12+1 Fighting is Parry 2+6+1 = 9.
    const c = { attributes: { vigor: 13 }, skills: { fighting: { value: 13, trained: true } } } as unknown as CharacterRecord;
    const derived = computeSavageWorldsDerivedValues(c);
    expect(derived.parry).toBe(9);
    expect(derived.toughness).toBe(2 + 6 + 1);
  });

  it('does not extend a ladder for a system that disallows it', () => {
    expect(traitLadder([4, 6, 8], false)).toEqual([4, 6, 8]);
  });
});

describe('the SWADE skill list', () => {
  const savage = BUNDLED_SYSTEMS.find(s => s.id === 'savage-worlds')!;
  const ids = savage.skillCategories.flatMap(c => c.skills).map(s => s.id);

  it('carries the five Core Skills every character starts with at d4', () => {
    // These five are not optional in SWADE — every character has them.
    for (const id of ['athletics', 'common-knowledge', 'notice', 'persuasion', 'stealth']) {
      expect(ids, `Core Skill "${id}" is missing`).toContain(id);
    }
  });

  it('declares the full core list rather than a sample', () => {
    expect(ids.length).toBeGreaterThanOrEqual(33);
  });

  it('has no duplicate ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the "fighting" id, which Parry is computed from', () => {
    // computeSavageWorldsDerivedValues reads skills['fighting'] by literal id.
    // Renaming it in system.json would silently drop every character's Parry to
    // 2 with nothing failing — the derived stat would just quietly be wrong.
    expect(ids).toContain('fighting');
    const c = { skills: { fighting: { value: 8, trained: true } }, attributes: {} } as unknown as CharacterRecord;
    expect(computeSavageWorldsDerivedValues(c).parry).toBe(2 + 4);
  });

  it('links every skill to a real attribute', () => {
    const attrs = new Set(savage.attributes.map(a => a.id));
    for (const cat of savage.skillCategories) {
      for (const skill of cat.skills) {
        expect(attrs.has(skill.linkedAttributeId ?? ''), `${skill.id} -> ${skill.linkedAttributeId}`).toBe(true);
      }
    }
  });
});
