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
});

describe('raiseChance', () => {
  it('is the chance of clearing TN + 4 per raise', () => {
    expect(raiseChance(8, 4, 0)).toBeCloseTo(traitChance(8, 4));
    expect(raiseChance(8, 4, 1)).toBeCloseTo(traitChance(8, 8));
  });
});

describe('dieCode', () => {
  it('formats plain, plus, and minus dice', () => {
    expect(dieCode(8)).toBe('d8');
    expect(dieCode(12, 1)).toBe('d12+1');
    expect(dieCode(4, -2)).toBe('d4-2');
  });
});
