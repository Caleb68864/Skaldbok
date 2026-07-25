import { describe, it, expect } from 'vitest';
import { explodingChance, traitChance, raiseChance, dieCode } from './savageMath';

const approx = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('explodingChance', () => {
  it('counts faces at or above the target when target <= sides', () => {
    expect(explodingChance(4, 4)).toBeCloseTo(1 / 4); // only a 4 on a d4
    expect(explodingChance(6, 4)).toBeCloseTo(3 / 6); // 4,5,6 on a d6
    expect(explodingChance(8, 4)).toBeCloseTo(5 / 8);
    expect(explodingChance(6, 1)).toBe(1);
  });

  it('requires an explosion when target exceeds the die', () => {
    // d6 vs 8: must roll a 6 (1/6) then reach 2 more (5/6) => 5/36
    expect(approx(explodingChance(6, 8), (1 / 6) * (5 / 6))).toBe(true);
    // d4 vs 8: roll 4 (1/4) then reach 4 on the reroll (1/4) => 1/16
    expect(approx(explodingChance(4, 8), (1 / 4) * (1 / 4))).toBe(true);
  });

  it('recurses through multiple explosions', () => {
    // d4 vs 13: 4 → 4 → 4 (each 1/4), then the reroll must reach 1 (certain) => (1/4)^3
    expect(approx(explodingChance(4, 13), (1 / 4) ** 3)).toBe(true);
  });

  it('guards degenerate dice and trivially-met targets', () => {
    expect(explodingChance(0, 4)).toBe(0);
    expect(explodingChance(-2, 4)).toBe(0);
    expect(explodingChance(NaN, 4)).toBe(0);
    expect(explodingChance(6, 0)).toBe(1);
    expect(explodingChance(6, -3)).toBe(1);
  });
});

describe('traitChance', () => {
  it('uses the trait die alone for an Extra', () => {
    expect(traitChance(6, 4)).toBeCloseTo(0.5);
  });

  it('takes the higher of trait die and Wild Die for a Wild Card', () => {
    // d4 (0.25) + wild d6 (0.5) vs TN 4 => 1 - 0.75*0.5 = 0.625
    expect(traitChance(4, 4, { wild: true })).toBeCloseTo(0.625);
  });

  it('applies a flat bonus by lowering the effective target', () => {
    // d6 with +2 vs TN 6 behaves like d6 vs TN 4
    expect(traitChance(6, 6, { bonus: 2 })).toBeCloseTo(traitChance(6, 4));
    // untrained d4-2 vs TN 4 behaves like d4 vs TN 6
    expect(traitChance(4, 4, { bonus: -2 })).toBeCloseTo(explodingChance(4, 6));
  });

  it('caps at certainty for a large positive bonus', () => {
    expect(traitChance(4, 4, { bonus: 10 })).toBe(1);
  });

  it('stays within [0, 1] for a Wild Card under a large negative penalty', () => {
    const p = traitChance(4, 4, { wild: true, bonus: -12 });
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});

describe('raiseChance', () => {
  it('is the chance of clearing TN + 4 per raise', () => {
    expect(raiseChance(8, 4, 0)).toBeCloseTo(traitChance(8, 4));
    expect(raiseChance(8, 4, 1)).toBeCloseTo(traitChance(8, 8));
  });

  it('clamps a negative raise count to a plain success', () => {
    expect(raiseChance(8, 4, -1)).toBeCloseTo(raiseChance(8, 4, 0));
  });
});

describe('dieCode', () => {
  it('formats plain, plus, and minus dice', () => {
    expect(dieCode(8)).toBe('d8');
    expect(dieCode(12, 1)).toBe('d12+1');
    expect(dieCode(4, -2)).toBe('d4-2');
  });
});
