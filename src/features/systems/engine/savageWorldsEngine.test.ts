import { describe, it, expect } from 'vitest';
import type { CharacterRecord } from '../../../types/character';
import {
  savageWorldsEngine,
  computeToughness,
  savageTraitPenalty,
  computeSavageWorldsDerivedValues,
  formatSavageSkill,
} from './savageWorldsEngine';

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
  it('appends a signed penalty label', () => {
    expect(formatSavageSkill(8, -2)).toMatch(/^d8 · \d+% \(-2\)$/);
    expect(formatSavageSkill(8, 1)).toContain('(+1)');
  });
});
