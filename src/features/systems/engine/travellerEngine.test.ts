import { describe, it, expect } from 'vitest';
import {
  effectiveCharacteristic,
  travellerEngine,
  computeTravellerDerivedValues,
  TRAVELLER_DEFAULT_TARGET,
} from './travellerEngine';
import type { CharacterRecord, TempModifier } from '../../../types/character';

/** A one-effect temp modifier targeting `stat`. */
function modifier(stat: TempModifier['effects'][number]['stat'], delta: number): TempModifier {
  return {
    id: `mod-${stat}-${delta}`,
    label: 'Test buff',
    effects: [{ stat, delta }],
    duration: 'scene',
    createdAt: '2026-07-28T00:00:00.000Z',
  };
}

/** A minimal Traveller character: all characteristics 7, an empty damage track. */
function character(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    attributes: { str: 7, dex: 7, end: 7, int: 7, edu: 7, soc: 7 },
    resources: {
      str: { current: 0, max: 7 },
      dex: { current: 0, max: 7 },
      end: { current: 0, max: 7 },
    },
    ...overrides,
  } as CharacterRecord;
}

describe('effectiveCharacteristic', () => {
  it('returns the raw score when undamaged', () => {
    expect(effectiveCharacteristic(character(), 'end')).toBe(7);
  });

  it('subtracts damage taken to that characteristic', () => {
    const wounded = character({
      resources: { str: { current: 0, max: 7 }, dex: { current: 0, max: 7 }, end: { current: 5, max: 7 } },
    });
    expect(effectiveCharacteristic(wounded, 'end')).toBe(2);
  });

  it('does not let damage push a characteristic below zero', () => {
    const downed = character({
      resources: { end: { current: 99, max: 7 } } as CharacterRecord['resources'],
    });
    expect(effectiveCharacteristic(downed, 'end')).toBe(0);
  });

  it('leaves characteristics without a damage track untouched', () => {
    // INT/EDU/SOC have no matching resource; a same-named resource must not leak in.
    expect(effectiveCharacteristic(character(), 'int')).toBe(7);
  });

  it('reads the characteristic, not the same-named resource', () => {
    // attr:str and res:str collide by id — the score must win here.
    const c = character({
      attributes: { str: 12, dex: 7, end: 7, int: 7, edu: 7, soc: 7 },
      resources: { str: { current: 2, max: 12 } } as CharacterRecord['resources'],
    });
    expect(effectiveCharacteristic(c, 'str')).toBe(10);
  });

  it('folds in an active temp modifier on the characteristic', () => {
    const buffed = character({ tempModifiers: [modifier('attr:dex', 2)] });
    expect(effectiveCharacteristic(buffed, 'dex')).toBe(9);
  });

  it('composes a modifier with damage', () => {
    // Battle Dress +1 STR while carrying 3 points of Strength damage.
    const c = character({
      resources: { str: { current: 3, max: 7 } } as CharacterRecord['resources'],
      tempModifiers: [modifier('attr:str', 1)],
    });
    expect(effectiveCharacteristic(c, 'str')).toBe(5);
  });

  it('ignores a modifier aimed at the same-named resource', () => {
    // res:dex is the damage track, not the characteristic. Distinct targets.
    const c = character({ tempModifiers: [modifier('res:dex', 2)] });
    expect(effectiveCharacteristic(c, 'dex')).toBe(7);
  });

  it('ignores an unnamespaced legacy key so it cannot hit twice', () => {
    // resolveLegacy would resolve a bare 'dex' to the characteristic, but the
    // migration namespaces stored keys on read, so nothing should still be bare.
    const c = character({ tempModifiers: [modifier('dex' as TempModifier['effects'][number]['stat'], 2)] });
    expect(effectiveCharacteristic(c, 'dex')).toBe(7);
  });

  it('does not let a negative modifier push a characteristic below zero', () => {
    const c = character({ tempModifiers: [modifier('attr:soc', -99)] });
    expect(effectiveCharacteristic(c, 'soc')).toBe(0);
  });
});

describe('attributeBadge', () => {
  it('reports the DM of the modified characteristic, not the base', () => {
    // DEX 7 is DM +0; DEX 9 is DM +1. Before the stat-key fix the badge read +0
    // because the modifier never matched the bare key the sheet passed in.
    const buffed = character({ tempModifiers: [modifier('attr:dex', 2)] });
    expect(travellerEngine.attributeBadge!('dex', buffed)).toBe('+1');
  });

  it('still returns null for a characteristic the record does not have', () => {
    const c = character({ attributes: { str: 7 } as CharacterRecord['attributes'] });
    expect(travellerEngine.attributeBadge!('psi', c)).toBeNull();
  });
});

describe('damage feeds through to DMs', () => {
  it('drops the attribute badge as damage accumulates', () => {
    const healthy = character();
    expect(travellerEngine.attributeBadge('end', healthy)).toBe('+0');

    // END 7 - 5 damage = END 2, which is DM -2.
    const wounded = character({
      resources: { str: { current: 0, max: 7 }, dex: { current: 0, max: 7 }, end: { current: 5, max: 7 } },
    });
    expect(travellerEngine.attributeBadge('end', wounded)).toBe('-2');
  });

  it('drops the derived characteristic DM as damage accumulates', () => {
    const wounded = character({
      resources: { str: { current: 5, max: 7 }, dex: { current: 0, max: 7 }, end: { current: 0, max: 7 } },
    });
    const derived = computeTravellerDerivedValues(wounded);
    expect(derived.characteristicDMs['str']).toBe(-2);
    expect(derived.characteristicDMs['dex']).toBe(0);
  });

  it('lowers a skill check chance when the linked characteristic is damaged', () => {
    const healthy = character();
    const wounded = character({
      resources: { str: { current: 0, max: 7 }, dex: { current: 5, max: 7 }, end: { current: 0, max: 7 } },
    });
    const display = travellerEngine.skill.display;
    const healthyText = display(1, { character: healthy, linkedAttributeId: 'dex' });
    const woundedText = display(1, { character: wounded, linkedAttributeId: 'dex' });

    expect(healthyText).not.toContain('DM -2');
    expect(woundedText).toContain('DM -2');

    const pct = (s: string) => Number(/(\d+)%/.exec(s)?.[1]);
    expect(pct(woundedText)).toBeLessThan(pct(healthyText));
  });

  it('applies the -3 unskilled DM when the skill is untrained', () => {
    const c = character();
    const display = travellerEngine.skill.display;
    const pct = (s: string) => Number(/(\d+)%/.exec(s)?.[1]);
    // Same skill (level 0, DEX-linked): trained shows the level-0 baseline,
    // untrained folds in -3 and reads "Unskilled" with lower odds.
    const trainedText = display(0, { character: c, linkedAttributeId: 'dex', trained: true });
    const untrainedText = display(0, { character: c, linkedAttributeId: 'dex', trained: false });
    expect(trainedText).toContain('Level 0');
    expect(untrainedText).toContain('Unskilled');
    expect(untrainedText).toContain('-3');
    expect(pct(untrainedText)).toBeLessThan(pct(trainedText));
  });

  it('treats an undefined trained flag as trained (no unskilled penalty)', () => {
    const c = character();
    const display = travellerEngine.skill.display;
    expect(display(0, { character: c, linkedAttributeId: 'dex' })).toContain('Level 0');
  });

  it('states the target the odds assume', () => {
    // The app shows eight difficulty targets in its own Quick Reference while
    // the odds are always computed against Average (8+). Unlabelled, an 83%
    // reads as "83% at whatever the GM just called".
    const c = character();
    const text = travellerEngine.skill.display(2, { character: c, linkedAttributeId: 'dex' });
    expect(text).toContain(`vs ${TRAVELLER_DEFAULT_TARGET}+`);
  });
});

describe('carry limit', () => {
  it('is STR + END', () => {
    expect(computeTravellerDerivedValues(character()).encumbranceLimit).toBe(14);
  });

  it('uses base characteristics, so damage does not change carry capacity mid-fight', () => {
    const wounded = character({
      resources: { str: { current: 5, max: 7 }, dex: { current: 0, max: 7 }, end: { current: 3, max: 7 } },
    });
    expect(computeTravellerDerivedValues(wounded).encumbranceLimit).toBe(14);
  });

  it('is surfaced on the dashboard and print, not the sheet panel', () => {
    const field = travellerEngine.derivedFields.find(f => f.key === 'encumbranceLimit');
    expect(field?.surfaces).toEqual(['dashboard', 'print']);
    expect(field?.overridable).toBe(true);
  });
});

describe('currency', () => {
  it('steps credits in hundreds, not single units', () => {
    // Traveller prices run to thousands; a step of 1 makes purchases unusable.
    expect(travellerEngine.currency.denominations[0].step).toBe(100);
  });
});
